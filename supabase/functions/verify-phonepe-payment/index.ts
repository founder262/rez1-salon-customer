// @ts-nocheck
// Deno Edge Function: verify-phonepe-payment
// Supports PhonePe PG 2.0 (OAuth) AND PG 1.x (Salt Key) as fallback
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function formatSlotLabel(time: string): string {
  if (!time) return "";
  if (time.includes("AM") || time.includes("PM")) return time;
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return time;
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let merchantTransactionId: string | null = null;
    let bookingId: string | null = null;

    // ── Parse body or query string ──
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body.response) {
        // S2S Callback base64 payload
        try {
          const decoded = JSON.parse(atob(body.response));
          merchantTransactionId = decoded.data?.merchantTransactionId || decoded.merchantOrderId;
        } catch (_) {}
      } else {
        merchantTransactionId = body.merchantTransactionId || body.merchantOrderId;
        bookingId = body.bookingId;
      }
    } else if (req.method === "GET") {
      const url = new URL(req.url);
      merchantTransactionId = url.searchParams.get("merchantTransactionId")
        || url.searchParams.get("transactionId")
        || url.searchParams.get("merchantOrderId");
      bookingId = url.searchParams.get("bookingId");
    }

    // PhonePe Webhook validation ping
    if (!merchantTransactionId && !bookingId) {
      return new Response(
        JSON.stringify({ success: true, message: "PhonePe Webhook verification endpoint active" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Locate booking ──
    let bookingRecord: any = null;
    if (bookingId) {
      const { data } = await supabaseAdmin.from("bookings").select("*").eq("id", bookingId).maybeSingle();
      bookingRecord = data;
      if (!merchantTransactionId) {
        merchantTransactionId = bookingRecord?.phonepe_merchant_transaction_id;
      }
    } else if (merchantTransactionId) {
      const { data } = await supabaseAdmin
        .from("bookings")
        .select("*")
        .eq("phonepe_merchant_transaction_id", merchantTransactionId)
        .maybeSingle();
      bookingRecord = data;
    }

    if (!bookingRecord || !merchantTransactionId) {
      return new Response(
        JSON.stringify({ success: false, error: "Booking transaction record not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If already paid, return success immediately
    if (bookingRecord?.payment_status === "paid") {
      return new Response(
        JSON.stringify({ success: true, message: "Payment already verified", booking: bookingRecord }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Fetch PhonePe Config ──
    const { data: config } = await supabaseAdmin
      .from("platform_config")
      .select("phonepe_merchant_id, phonepe_client_id, phonepe_client_secret, phonepe_client_version, phonepe_salt_key, phonepe_salt_index, phonepe_env")
      .maybeSingle();

    const merchantId   = config?.phonepe_merchant_id   || Deno.env.get("PHONEPE_MERCHANT_ID")   || "PGTESTPAYUAT";
    const clientId     = config?.phonepe_client_id     || Deno.env.get("PHONEPE_CLIENT_ID")     || "";
    const clientSecret = config?.phonepe_client_secret || Deno.env.get("PHONEPE_CLIENT_SECRET") || "";
    const clientVersion= config?.phonepe_client_version|| Deno.env.get("PHONEPE_CLIENT_VERSION")|| "1";
    const saltKey      = config?.phonepe_salt_key      || Deno.env.get("PHONEPE_SALT_KEY")      || "099eb0cd-02fc-4e41-88db-1032db451407";
    const saltIndex    = config?.phonepe_salt_index    || Deno.env.get("PHONEPE_SALT_INDEX")    || "1";
    const env          = (config?.phonepe_env || Deno.env.get("PHONEPE_ENV") || "UAT").toUpperCase();

    let isSuccess     = false;
    let transactionId: string | null = null;
    let providerReferenceId: string | null = null;
    let statusCode    = "";

    // ══════════════════════════════════════════════════════════
    // PG 2.0 Status Check — OAuth flow
    // ══════════════════════════════════════════════════════════
    if (clientId && clientSecret) {
      console.log("[verify-phonepe] Using PG 2.0 OAuth flow for status check");

      const tokenUrl = env === "PROD"
        ? "https://api.phonepe.com/apis/pg/v1/oauth/token"
        : "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token";

      const tokenRes = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
          client_version: String(clientVersion),
        }),
      });

      const tokenData = await tokenRes.json();
      console.log("[verify-phonepe] Token status:", tokenRes.status);

      if (!tokenRes.ok || !tokenData.access_token) {
        return new Response(
          JSON.stringify({ success: false, error: tokenData.error_description || "Failed to get OAuth token for status check" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const accessToken = tokenData.access_token;
      const statusUrl   = env === "PROD"
        ? `https://api.phonepe.com/apis/pg/checkout/v2/order/${merchantTransactionId}/status`
        : `https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/order/${merchantTransactionId}/status`;

      const statusRes = await fetch(statusUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `O-Bearer ${accessToken}`,
        },
      });

      const statusData = await statusRes.json();
      console.log("[verify-phonepe] PG 2.0 status response:", JSON.stringify(statusData));

      isSuccess   = statusData.state === "COMPLETED";
      statusCode  = statusData.state || "UNKNOWN";
      transactionId       = statusData.paymentDetails?.[0]?.transactionId || null;
      providerReferenceId = statusData.paymentDetails?.[0]?.paymentMode || null;

      if (!isSuccess) {
        if (statusData.state === "FAILED") {
          await supabaseAdmin
            .from("bookings")
            .update({ payment_status: "failed", updated_at: new Date().toISOString() })
            .eq("id", bookingRecord.id);
        }
        return new Response(
          JSON.stringify({ success: false, code: statusCode, message: `Payment ${statusData.state || "not completed"}`, booking: bookingRecord }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

    } else {
      // ══════════════════════════════════════════════════════════
      // PG 1.x Status Check — Salt Key signing
      // ══════════════════════════════════════════════════════════
      console.log("[verify-phonepe] Using PG 1.x salt-key flow for status check");

      const statusApiUrl = env === "PROD"
        ? `https://api.phonepe.com/apis/hermes/pg/v1/status/${merchantId}/${merchantTransactionId}`
        : `https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status/${merchantId}/${merchantTransactionId}`;

      const stringToSign = `/pg/v1/status/${merchantId}/${merchantTransactionId}` + saltKey;
      const hash         = await sha256(stringToSign);
      const xVerify      = `${hash}###${saltIndex}`;

      const statusRes = await fetch(statusApiUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json", "X-VERIFY": xVerify, "X-MERCHANT-ID": merchantId },
      });

      const statusData = await statusRes.json();
      console.log("[verify-phonepe] PG 1.x status response:", JSON.stringify(statusData));

      isSuccess           = statusData.success && statusData.code === "PAYMENT_SUCCESS";
      statusCode          = statusData.code || "";
      transactionId       = statusData.data?.transactionId || null;
      providerReferenceId = statusData.data?.providerReferenceId || null;

      if (!isSuccess) {
        if (statusCode === "PAYMENT_ERROR" || statusCode === "PAYMENT_DECLINED") {
          await supabaseAdmin
            .from("bookings")
            .update({ payment_status: "failed", updated_at: new Date().toISOString() })
            .eq("id", bookingRecord.id);
        }
        return new Response(
          JSON.stringify({ success: false, code: statusCode, message: statusData.message || "Payment verification failed or pending", booking: bookingRecord }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Payment Verified — Update Booking ──
    const { data: updatedBooking, error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({
        payment_status: "paid",
        status: "upcoming",
        phonepe_transaction_id: transactionId,
        phonepe_provider_reference_id: providerReferenceId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingRecord.id)
      .select("*")
      .single();

    if (updateError) {
      console.error("[verify-phonepe] DB update error:", updateError);
      throw updateError;
    }

    // ── Notifications ──
    let customerName = "Customer";
    try {
      const { data: custData } = await supabaseAdmin
        .from("customers")
        .select("full_name")
        .eq("id", updatedBooking.customer_id)
        .maybeSingle();
      if (custData?.full_name) customerName = custData.full_name;
    } catch (_) {}

    let salonOwnerId: string | null = null;
    let salonName = "the salon";
    if (updatedBooking.salon_id) {
      try {
        const { data: salonData } = await supabaseAdmin
          .from("salons")
          .select("owner_id, name")
          .eq("id", updatedBooking.salon_id)
          .maybeSingle();
        if (salonData) { salonOwnerId = salonData.owner_id; salonName = salonData.name; }
      } catch (_) {}
    }

    const formattedTime  = formatSlotLabel(updatedBooking.booking_time || "");
    const serviceNames   = updatedBooking.service_names || "Service";

    if (salonOwnerId && updatedBooking.salon_id) {
      await supabaseAdmin.from("owner_booking_alerts").insert({
        owner_id: salonOwnerId,
        salon_id: updatedBooking.salon_id,
        booking_id: updatedBooking.id,
        customer_name: customerName,
        service_summary: serviceNames,
        booking_time: formattedTime,
        is_read: false,
      });

      await supabaseAdmin.from("notifications").insert({
        target_user_id: salonOwnerId,
        type: "booking_created",
        title: `🔔 New Booking — ${formattedTime}`,
        message: `${customerName} booked ${serviceNames} at ${formattedTime}. Amount: ₹${updatedBooking.total_amount}.`,
        booking_id: updatedBooking.id,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    }

    await supabaseAdmin.from("notifications").insert({
      target_user_id: updatedBooking.customer_id,
      type: "booking_confirmed",
      title: "✅ Booking Confirmed",
      message: `Your PhonePe payment of ₹${updatedBooking.total_amount} is verified. Booking at ${salonName} on ${formattedTime} is confirmed!`,
      booking_id: updatedBooking.id,
      is_read: false,
      created_at: new Date().toISOString(),
    });

    console.log("[verify-phonepe] SUCCESS — booking updated:", updatedBooking.id);

    return new Response(
      JSON.stringify({ success: true, message: "Payment verified successfully", booking: updatedBooking }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[verify-phonepe] FATAL:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
