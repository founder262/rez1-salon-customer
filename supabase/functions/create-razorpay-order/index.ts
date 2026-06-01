// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { salonId, amount, currency = "INR", receipt, description } = body;

    // ── 1. Fetch platform config (Razorpay credentials + admin account id) ──
    const { data: config, error: configErr } = await supabase
      .from("platform_config")
      .select("razorpay_key_id, razorpay_key_secret, razorpay_account_id, booking_fee")
      .single();

    if (configErr || !config) {
      return new Response(
        JSON.stringify({ success: false, error: "Platform config not found" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      razorpay_key_id,
      razorpay_key_secret,
      razorpay_account_id: adminAccountId,
      booking_fee,
    } = config as any;

    if (!razorpay_key_id || !razorpay_key_secret) {
      return new Response(
        JSON.stringify({ success: false, error: "Razorpay credentials not configured in Admin settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const platformFeeInPaise = Math.round((booking_fee ?? 25) * 100);
    const totalInPaise = Math.round(amount * 100); // amount is in INR from client
    const ownerAmountInPaise = totalInPaise - platformFeeInPaise;

    // ── 2. Fetch salon owner's Razorpay linked account id ──
    const { data: salon, error: salonErr } = await supabase
      .from("salons")
      .select("owner_id, name")
      .eq("id", salonId)
      .single();

    if (salonErr || !salon) {
      return new Response(
        JSON.stringify({ success: false, error: "Salon not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch owner's razorpay_account_id from owners table (if they've linked it)
    const { data: owner } = await supabase
      .from("owners")
      .select("razorpay_account_id")
      .eq("id", salon.owner_id)
      .maybeSingle();

    const ownerAccountId = (owner as any)?.razorpay_account_id || null;

    // ── 3. Build transfers array for Razorpay Route ──
    const transfers: any[] = [];

    // Transfer platform fee to admin's account
    if (adminAccountId && platformFeeInPaise > 0) {
      transfers.push({
        account: adminAccountId,
        amount: platformFeeInPaise,
        currency,
        notes: {
          type: "platform_fee",
          description: "REZ1 Booking Charge",
        },
      });
    }

    // Transfer service amount to salon owner's account
    if (ownerAccountId && ownerAmountInPaise > 0) {
      transfers.push({
        account: ownerAccountId,
        amount: ownerAmountInPaise,
        currency,
        notes: {
          type: "service_amount",
          description: `Service fee for ${salon.name}`,
          salonId,
        },
      });
    }

    // ── 4. Create Razorpay Order ──
    const orderPayload: any = {
      amount: totalInPaise,
      currency,
      receipt: receipt || `rez1_${Date.now()}`,
      notes: {
        description: description || `Booking at ${salon.name}`,
        salonId,
      },
    };

    // Only add transfers if we have valid Route accounts
    if (transfers.length > 0) {
      orderPayload.transfers = transfers;
    }

    const authHeader = `Basic ${btoa(`${razorpay_key_id}:${razorpay_key_secret}`)}`;

    const rzpResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    const rzpOrder = await rzpResponse.json();

    if (!rzpResponse.ok) {
      console.error("Razorpay order creation failed:", rzpOrder);
      return new Response(
        JSON.stringify({
          success: false,
          error: rzpOrder?.error?.description || "Razorpay order creation failed",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderId: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        keyId: razorpay_key_id,
        transfersConfigured: transfers.length > 0,
        ownerLinked: !!ownerAccountId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("razorpay-order edge function error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

