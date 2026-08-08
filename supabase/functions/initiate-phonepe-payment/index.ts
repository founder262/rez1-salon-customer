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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Fetch PhonePe credentials from platform_config ──
    const { data: config } = await supabaseAdmin
      .from("platform_config")
      .select("phonepe_enabled, phonepe_merchant_id, phonepe_client_id, phonepe_client_secret, phonepe_client_version, phonepe_salt_key, phonepe_salt_index, phonepe_env")
      .maybeSingle();

    const merchantId    = (config?.phonepe_merchant_id    || Deno.env.get("PHONEPE_MERCHANT_ID")    || "PGTESTPAYUAT").trim();
    const clientId      = (config?.phonepe_client_id      || Deno.env.get("PHONEPE_CLIENT_ID")      || "").trim();
    const clientSecret  = (config?.phonepe_client_secret  || Deno.env.get("PHONEPE_CLIENT_SECRET")  || "").trim();
    const clientVersion = (config?.phonepe_client_version || Deno.env.get("PHONEPE_CLIENT_VERSION") || "1").trim();
    const saltKey       = (config?.phonepe_salt_key       || Deno.env.get("PHONEPE_SALT_KEY")       || "").trim();
    const saltIndex     = (config?.phonepe_salt_index     || Deno.env.get("PHONEPE_SALT_INDEX")     || "1").trim();
    const rawEnv        = (config?.phonepe_env || Deno.env.get("PHONEPE_ENV") || "UAT").toUpperCase().trim();
    const isProd        = ["PROD", "PRODUCTION", "LIVE"].includes(rawEnv);

    console.log(`[initiate-phonepe] Environment: ${rawEnv} | isProd: ${isProd} | MerchantID: ${merchantId}`);

    // ── Create unique Merchant Transaction / Order ID ──
    const cleanBookingId = bookingId.replace(/-/g, "").slice(0, 10);
    const merchantTransactionId = `MT${cleanBookingId}${Date.now()}`.slice(0, 35);

    const supabaseUrl      = Deno.env.get("SUPABASE_URL") ?? "";
    const callbackUrl      = `${supabaseUrl}/functions/v1/verify-phonepe-payment`;
    const finalRedirectUrl = redirectUrl || callbackUrl;

    let finalRedirectLink: string | null = null;
    let pg2Failed = false;
    let lastPgError = "";

    // ══════════════════════════════════════════════════════════
    // PG 2.0 Flow — OAuth Client Credentials (clientId + secret)
    // ══════════════════════════════════════════════════════════
    if (clientId && clientSecret) {
      console.log("[initiate-phonepe] Attempting PG 2.0 OAuth flow");

      const tokenUrl = isProd
        ? "https://api.phonepe.com/apis/identity-manager/v1/oauth/token"
        : "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token";

      try {
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
        console.log("[initiate-phonepe] Token response:", tokenRes.status, JSON.stringify(tokenData));

        if (tokenRes.ok && tokenData.access_token) {
          const accessToken = tokenData.access_token;

          const payUrl = isProd
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
              amount: Math.round(amount * 100),
              expireAfter: 1200,
              metaInfo: { udf1: bookingId, udf2: "REZ1_SALON" },
              paymentFlow: {
                type: "PG_CHECKOUT",
                message: "REZ1 Salon Booking",
                merchantUrls: { redirectUrl: finalRedirectUrl },
              },
            }),
          });

          const payData = await payRes.json();
          console.log("[initiate-phonepe] PG 2.0 pay response:", payRes.status, JSON.stringify(payData));

          if (payRes.ok && payData.redirectUrl) {
            finalRedirectLink = payData.redirectUrl;
          } else {
            const code = payData?.code || payRes.status;
            const msg = payData?.message || "PhonePe PG 2.0 checkout failed";
            lastPgError = `PhonePe PG 2.0 (${code}): ${msg}`;
            console.warn("[initiate-phonepe] PG 2.0 failed:", lastPgError);
            pg2Failed = true;
          }
        } else {
          const code = tokenData?.code || tokenRes.status;
          const msg = tokenData?.message || "OAuth authentication failed";
          lastPgError = `PhonePe OAuth (${code}): ${msg}`;
          console.warn("[initiate-phonepe] OAuth token failed:", lastPgError);
          pg2Failed = true;
        }
      } catch (oauthErr: any) {
        lastPgError = `OAuth Exception: ${oauthErr.message}`;
        console.error("[initiate-phonepe] OAuth exception:", oauthErr);
        pg2Failed = true;
      }
    }

    // ══════════════════════════════════════════════════════════
    // PG 1.x Fallback — Salt Key / SHA256 signing (only if saltKey provided)
    // ══════════════════════════════════════════════════════════
    const activeSaltKey = saltKey || (!isProd ? "099eb0cd-02fc-4e41-88db-1032db451407" : "");

    if (!finalRedirectLink && (pg2Failed || !clientId || !clientSecret) && activeSaltKey) {
      console.log("[initiate-phonepe] Executing PG 1.x salt-key flow");

      const baseUrl = isProd
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

      const base64Payload = btoa(JSON.stringify(payloadObj));
      const stringToSign  = base64Payload + "/pg/v1/pay" + activeSaltKey;
      const hash          = await sha256(stringToSign);
      const xVerify       = `${hash}###${saltIndex}`;

      const phonepeRes = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-VERIFY": xVerify },
        body: JSON.stringify({ request: base64Payload }),
      });

      const phonepeData = await phonepeRes.json();
      console.log("[initiate-phonepe] PG 1.x response:", phonepeRes.status, JSON.stringify(phonepeData));

      if (phonepeRes.ok && phonepeData.success) {
        finalRedirectLink = phonepeData.data?.instrumentResponse?.redirectInfo?.url;
      } else {
        const errMsg = phonepeData.message || phonepeData.code || "PhonePe payment initiation failed";
        lastPgError = `PhonePe PG 1.x (${phonepeData.code || phonepeRes.status}): ${errMsg}`;
        console.error("[initiate-phonepe] PG 1.x error:", lastPgError);
      }
    }

    if (!finalRedirectLink) {
      const displayError = lastPgError || "PhonePe Gateway checkout unavailable. Please use Direct UPI.";
      return new Response(
        JSON.stringify({ success: false, error: displayError }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
