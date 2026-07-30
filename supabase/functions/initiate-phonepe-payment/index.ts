// @ts-nocheck
// Deno Edge Function: initiate-phonepe-payment
// Supports PhonePe PG 2.0 (OAuth / Client ID+Secret) AND PG 1.x (Salt Key) as fallback
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

    const body = await req.json();
    const { bookingId, amount, customerPhone, redirectUrl } = body;

    if (!bookingId || !amount) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required bookingId or amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Fetch PhonePe credentials from platform_config ──
    const { data: config } = await supabaseAdmin
      .from("platform_config")
      .select("phonepe_enabled, phonepe_merchant_id, phonepe_client_id, phonepe_client_secret, phonepe_client_version, phonepe_salt_key, phonepe_salt_index, phonepe_env")
      .maybeSingle();

    const merchantId   = config?.phonepe_merchant_id   || Deno.env.get("PHONEPE_MERCHANT_ID")   || "PGTESTPAYUAT";
    const clientId     = config?.phonepe_client_id     || Deno.env.get("PHONEPE_CLIENT_ID")     || "";
    const clientSecret = config?.phonepe_client_secret || Deno.env.get("PHONEPE_CLIENT_SECRET") || "";
    const clientVersion= config?.phonepe_client_version|| Deno.env.get("PHONEPE_CLIENT_VERSION")|| "1";
    const saltKey      = config?.phonepe_salt_key      || Deno.env.get("PHONEPE_SALT_KEY")      || "099eb0cd-02fc-4e41-88db-1032db451407";
    const saltIndex    = config?.phonepe_salt_index    || Deno.env.get("PHONEPE_SALT_INDEX")    || "1";
    const env          = (config?.phonepe_env || Deno.env.get("PHONEPE_ENV") || "UAT").toUpperCase();

    // ── Create unique Merchant Transaction / Order ID ──
    const cleanBookingId = bookingId.replace(/-/g, "").slice(0, 10);
    const merchantTransactionId = `MT${cleanBookingId}${Date.now()}`.slice(0, 35);

    const supabaseUrl  = Deno.env.get("SUPABASE_URL") ?? "";
    const callbackUrl  = `${supabaseUrl}/functions/v1/verify-phonepe-payment`;
    const finalRedirectUrl = redirectUrl || callbackUrl;

    let finalRedirectLink: string | null = null;

    // ══════════════════════════════════════════════════════════
    // PG 2.0 Flow — OAuth Client Credentials (clientId + secret)
    // ══════════════════════════════════════════════════════════
    if (clientId && clientSecret) {
      console.log("[initiate-phonepe] Using PG 2.0 OAuth flow");

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
      console.log("[initiate-phonepe] Token response status:", tokenRes.status, "| body:", JSON.stringify(tokenData));

      if (!tokenRes.ok || !tokenData.access_token) {
        const errMsg = tokenData.error_description || tokenData.error || "Failed to obtain PhonePe OAuth token";
        console.error("[initiate-phonepe] Token error:", errMsg);
        return new Response(
          JSON.stringify({ success: false, error: errMsg }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const accessToken = tokenData.access_token;

      const payUrl = env === "PROD"
        ? "https://api.phonepe.com/apis/pg/checkout/v2/pay"
        : "https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay";

      const payRes = await fetch(payUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `O-Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          merchantOrderId: merchantTransactionId,
          amount: Math.round(amount * 100), // paise
          expireAfter: 1200,
          metaInfo: {
            udf1: bookingId,
            udf2: "REZ1_SALON",
          },
          paymentFlow: {
            type: "PG_CHECKOUT",
            message: "REZ1 Salon Booking",
            merchantUrls: {
              redirectUrl: finalRedirectUrl,
            },
          },
        }),
      });

      const payData = await payRes.json();
      console.log("[initiate-phonepe] PG 2.0 pay response status:", payRes.status, "| body:", JSON.stringify(payData));

      if (!payRes.ok || !payData.redirectUrl) {
        const errMsg = payData.message || payData.error || payData.code || "PhonePe PG 2.0 payment initiation failed";
        console.error("[initiate-phonepe] PG 2.0 pay error:", errMsg);
        return new Response(
          JSON.stringify({ success: false, error: errMsg, raw: payData }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      finalRedirectLink = payData.redirectUrl;

    } else {
      // ══════════════════════════════════════════════════════════
      // PG 1.x Fallback — Salt Key / SHA256 signing
      // ══════════════════════════════════════════════════════════
      console.log("[initiate-phonepe] Using PG 1.x salt-key flow");

      const baseUrl = env === "PROD"
        ? "https://api.phonepe.com/apis/hermes/pg/v1/pay"
        : "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay";

      const payloadObj = {
        merchantId,
        merchantTransactionId,
        merchantUserId: `CUST_${cleanBookingId}`,
        amount: Math.round(amount * 100),
        redirectUrl: finalRedirectUrl,
        redirectMode: "REDIRECT",
        callbackUrl,
        mobileNumber: customerPhone ? customerPhone.replace(/\D/g, "").slice(-10) : "9999999999",
        paymentInstrument: { type: "PAY_PAGE" },
      };

      const base64Payload  = btoa(JSON.stringify(payloadObj));
      const stringToSign   = base64Payload + "/pg/v1/pay" + saltKey;
      const hash           = await sha256(stringToSign);
      const xVerify        = `${hash}###${saltIndex}`;

      const phonepeRes = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-VERIFY": xVerify },
        body: JSON.stringify({ request: base64Payload }),
      });

      const phonepeData = await phonepeRes.json();
      console.log("[initiate-phonepe] PG 1.x response status:", phonepeRes.status, "| body:", JSON.stringify(phonepeData));

      if (!phonepeRes.ok || !phonepeData.success) {
        const errMsg = phonepeData.message || phonepeData.code || "PhonePe PG 1.x payment initiation failed";
        console.error("[initiate-phonepe] PG 1.x error:", errMsg);
        return new Response(
          JSON.stringify({ success: false, error: errMsg, raw: phonepeData }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      finalRedirectLink = phonepeData.data?.instrumentResponse?.redirectInfo?.url;
    }

    if (!finalRedirectLink) {
      return new Response(
        JSON.stringify({ success: false, error: "PhonePe did not return a redirect URL" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Save merchantTransactionId to booking ──
    await supabaseAdmin
      .from("bookings")
      .update({
        phonepe_merchant_transaction_id: merchantTransactionId,
        payment_status: "initiated",
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    console.log("[initiate-phonepe] SUCCESS → redirectUrl:", finalRedirectLink);

    return new Response(
      JSON.stringify({
        success: true,
        redirectUrl: finalRedirectLink,
        merchantTransactionId,
        merchantId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[initiate-phonepe] FATAL:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
