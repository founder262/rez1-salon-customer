// @ts-nocheck
// Deno Edge Function: verify-phonepe-payment
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

    // Parse body or query string
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body.response) {
        // S2S Callback base64 decoded
        try {
          const decoded = JSON.parse(atob(body.response));
          merchantTransactionId = decoded.data?.merchantTransactionId;
        } catch (_) {}
      } else {
        merchantTransactionId = body.merchantTransactionId;
        bookingId = body.bookingId;
      }
    }

    if (!merchantTransactionId && !bookingId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing merchantTransactionId or bookingId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 1. Locate booking if only bookingId passed ──
    let bookingRecord: any = null;
    if (bookingId) {
      const { data } = await supabaseAdmin.from("bookings").select("*").eq("id", bookingId).maybeSingle();
      bookingRecord = data;
      if (!merchantTransactionId) {
        merchantTransactionId = bookingRecord?.phonepe_merchant_transaction_id;
      }
    } else if (merchantTransactionId) {
      const { data } = await supabaseAdmin.from("bookings").select("*").eq("phonepe_merchant_transaction_id", merchantTransactionId).maybeSingle();
      bookingRecord = data;
    }

    if (!bookingRecord && !merchantTransactionId) {
      return new Response(
        JSON.stringify({ success: false, error: "Booking transaction record not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If already paid, return early with success
    if (bookingRecord?.payment_status === "paid") {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Payment already verified",
          booking: bookingRecord,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Fetch PhonePe Config ──
    const { data: config } = await supabaseAdmin
      .from("platform_config")
      .select("phonepe_merchant_id, phonepe_salt_key, phonepe_salt_index, phonepe_env")
      .maybeSingle();

    const merchantId = config?.phonepe_merchant_id || Deno.env.get("PHONEPE_MERCHANT_ID") || "PGTESTPAYUAT";
    const saltKey = config?.phonepe_salt_key || Deno.env.get("PHONEPE_SALT_KEY") || "099eb0cd-02fc-4e41-88db-1032db451407";
    const saltIndex = config?.phonepe_salt_index || Deno.env.get("PHONEPE_SALT_INDEX") || "1";
    const env = (config?.phonepe_env || Deno.env.get("PHONEPE_ENV") || "UAT").toUpperCase();

    const statusApiUrl = env === "PROD"
      ? `https://api.phonepe.com/apis/hermes/pg/v1/status/${merchantId}/${merchantTransactionId}`
      : `https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status/${merchantId}/${merchantTransactionId}`;

    // Calculate X-VERIFY for status API
    const stringToSign = `/pg/v1/status/${merchantId}/${merchantTransactionId}` + saltKey;
    const hash = await sha256(stringToSign);
    const xVerify = `${hash}###${saltIndex}`;

    // ── 3. Call PhonePe Status API ──
    const statusResponse = await fetch(statusApiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": xVerify,
        "X-MERCHANT-ID": merchantId,
      },
    });

    const statusData = await statusResponse.json();
    console.log("[verify-phonepe] Status response:", statusData);

    const isSuccess = statusData.success && statusData.code === "PAYMENT_SUCCESS";
    const transactionId = statusData.data?.transactionId || null;
    const providerReferenceId = statusData.data?.providerReferenceId || null;

    if (!isSuccess) {
      // Mark as failed if pending/failed
      if (statusData.code === "PAYMENT_ERROR" || statusData.code === "PAYMENT_DECLINED") {
        await supabaseAdmin
          .from("bookings")
          .update({ payment_status: "failed", updated_at: new Date().toISOString() })
          .eq("id", bookingRecord.id);
      }

      return new Response(
        JSON.stringify({
          success: false,
          code: statusData.code,
          message: statusData.message || "Payment verification failed or pending",
          booking: bookingRecord,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Payment Verified — Update Booking ──
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

    // ── 5. Notifications & Alerts ──
    let customerName = "Customer";
    try {
      const { data: custData } = await supabaseAdmin
        .from("customers")
        .select("full_name")
        .eq("id", updatedBooking.customer_id)
        .maybeSingle();
      if (custData?.full_name) customerName = custData.full_name;
    } catch (_) {}

    let salonOwnerId = null;
    let salonName = "the salon";
    if (updatedBooking.salon_id) {
      try {
        const { data: salonData } = await supabaseAdmin
          .from("salons")
          .select("owner_id, name")
          .eq("id", updatedBooking.salon_id)
          .maybeSingle();
        if (salonData) {
          salonOwnerId = salonData.owner_id;
          salonName = salonData.name;
        }
      } catch (_) {}
    }

    const formattedTime = formatSlotLabel(updatedBooking.booking_time || "");
    const serviceNames = updatedBooking.service_names || "Service";

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

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment verified successfully",
        booking: updatedBooking,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[verify-phonepe] FATAL ERROR:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
