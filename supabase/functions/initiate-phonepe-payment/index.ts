// @ts-nocheck
// Deno Edge Function: initiate-phonepe-payment
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

    // ── 1. Fetch PhonePe credentials from platform_config ──
    const { data: config } = await supabaseAdmin
      .from("platform_config")
      .select("phonepe_enabled, phonepe_merchant_id, phonepe_salt_key, phonepe_salt_index, phonepe_env")
      .maybeSingle();

    const merchantId = config?.phonepe_merchant_id || Deno.env.get("PHONEPE_MERCHANT_ID") || "PGTESTPAYUAT";
    const saltKey = config?.phonepe_salt_key || Deno.env.get("PHONEPE_SALT_KEY") || "099eb0cd-02fc-4e41-88db-1032db451407";
    const saltIndex = config?.phonepe_salt_index || Deno.env.get("PHONEPE_SALT_INDEX") || "1";
    const env = (config?.phonepe_env || Deno.env.get("PHONEPE_ENV") || "UAT").toUpperCase();

    const baseUrl = env === "PROD"
      ? "https://api.phonepe.com/apis/hermes/pg/v1/pay"
      : "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay";

    // ── 2. Create unique Merchant Transaction ID ──
    const cleanBookingId = bookingId.replace(/-/g, "").slice(0, 10);
    const merchantTransactionId = `MT_${cleanBookingId}_${Date.now()}`;

    // ── 3. Build PhonePe Payload ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const callbackUrl = `${supabaseUrl}/functions/v1/verify-phonepe-payment`;

    const payloadObj = {
      merchantId,
      merchantTransactionId,
      merchantUserId: `CUST_${cleanBookingId}`,
      amount: Math.round(amount * 100), // in paise
      redirectUrl: redirectUrl || callbackUrl,
      redirectMode: "REDIRECT",
      callbackUrl,
      mobileNumber: customerPhone ? customerPhone.replace(/\D/g, "").slice(-10) : "9999999999",
      paymentInstrument: {
        type: "PAY_PAGE",
      },
    };

    const base64Payload = btoa(JSON.stringify(payloadObj));
    const stringToSign = base64Payload + "/pg/v1/pay" + saltKey;
    const hash = await sha256(stringToSign);
    const xVerify = `${hash}###${saltIndex}`;

    // ── 4. Call PhonePe Pay API ──
    const phonepeResponse = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": xVerify,
      },
      body: JSON.stringify({ request: base64Payload }),
    });

    const phonepeData = await phonepeResponse.json();

    if (!phonepeResponse.ok || !phonepeData.success) {
      console.error("PhonePe Pay API error:", phonepeData);
      return new Response(
        JSON.stringify({
          success: false,
          error: phonepeData.message || phonepeData.code || "PhonePe payment initiation failed",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 5. Save PhonePe merchantTransactionId to booking ──
    await supabaseAdmin
      .from("bookings")
      .update({
        phonepe_merchant_transaction_id: merchantTransactionId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    const redirectInfo = phonepeData.data?.instrumentResponse?.redirectInfo;
    const targetRedirectUrl = redirectInfo?.url;

    return new Response(
      JSON.stringify({
        success: true,
        redirectUrl: targetRedirectUrl,
        merchantTransactionId,
        merchantId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("initiate-phonepe-payment fatal error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
