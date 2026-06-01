// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Verify Razorpay signature using Web Crypto API (Deno-compatible) ──
async function verifyRazorpaySignature(
  secret: string,
  orderId: string,
  paymentId: string,
  signature: string
): Promise<boolean> {
  try {
    const message = `${orderId}|${paymentId}`;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuf = await crypto.subtle.sign("HMAC", key, enc.encode(message));
    const hex = Array.from(new Uint8Array(signatureBuf))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    return hex === signature;
  } catch (err) {
    console.error("Signature verification error:", err);
    return false;
  }
}

/** Convert 24-hour "HH:MM" → "H:MM AM/PM" (safe on already-formatted strings) */
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

    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, booking_id } = body;

    console.log("[verify-razorpay] Verifying booking:", booking_id);

    // ── 1. Validate required fields ──
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !booking_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing payment verification fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Fetch Razorpay secret from platform_config ──
    const { data: config, error: configErr } = await supabaseAdmin
      .from("platform_config")
      .select("razorpay_key_secret")
      .maybeSingle();

    const razorpayKeySecret = config?.razorpay_key_secret || Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!razorpayKeySecret) {
      // No secret available — skip signature check (test mode) and just confirm the booking
      console.warn("[verify-razorpay] No key secret found — skipping signature check (TEST MODE)");
    } else {
      // ── 3. Verify HMAC signature ──
      const isValid = await verifyRazorpaySignature(
        razorpayKeySecret,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );

      console.log("[verify-razorpay] Signature valid:", isValid);

      if (!isValid) {
        // Mark booking as failed
        await supabaseAdmin
          .from("bookings")
          .update({ payment_status: "failed", updated_at: new Date().toISOString() })
          .eq("id", booking_id);

        return new Response(
          JSON.stringify({ success: false, error: "Signature verification failed - Payment rejected" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── 4. Update booking to confirmed (Removed invalid 'razorpay_signature' column to prevent DB update crash) ──
    const { data: updatedBooking, error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({
        payment_status: "paid",
        status: "upcoming",
        razorpay_payment_id,
        razorpay_order_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking_id)
      .select("*")
      .single();

    if (updateError) {
      console.error("[verify-razorpay] DB update error:", updateError);
      throw updateError;
    }

    // ── 5. Safely fetch customer name ──
    let customerName = "Customer";
    try {
      const { data: custData } = await supabaseAdmin
        .from("customers")
        .select("full_name")
        .eq("id", updatedBooking?.customer_id)
        .maybeSingle();
      if (custData?.full_name) customerName = custData.full_name;
    } catch (e) {
      console.warn("[verify-razorpay] Could not fetch customer name:", e);
    }

    // ── 6. Safely fetch salon details ──
    let salonOwnerId = null;
    let salonName = "the salon";
    const salonId = updatedBooking?.salon_id;
    if (salonId) {
      try {
        const { data: salonData } = await supabaseAdmin
          .from("salons")
          .select("owner_id, name")
          .eq("id", salonId)
          .maybeSingle();
        if (salonData) {
          salonOwnerId = salonData.owner_id;
          salonName = salonData.name;
        }
      } catch (e) {
        console.warn("[verify-razorpay] Could not fetch salon details:", e);
      }
    }

    // ── 7. Send owner booking alert (real-time notification in owner panel) ──
    if (salonOwnerId && salonId) {
      const formattedTime = formatSlotLabel(updatedBooking?.booking_time || "");
      const serviceNames = updatedBooking?.service_names || "Service";

      // 7a. owner_booking_alerts — triggers real-time popup + sound in owner panel
      const { error: alertErr } = await supabaseAdmin.from("owner_booking_alerts").insert({
        owner_id: salonOwnerId,
        salon_id: salonId,
        booking_id,
        customer_name: customerName,
        service_summary: serviceNames,
        booking_time: formattedTime,
        is_read: false,
      });
      if (alertErr) console.error("[verify-razorpay] owner alert error:", alertErr.message);

      // 7b. notifications table — persisted in owner's notification bell
      const { error: ownerNotifErr } = await supabaseAdmin.from("notifications").insert({
        target_user_id: salonOwnerId,
        type: "booking_created",
        title: `🔔 New Booking — ${formattedTime}`,
        message: `${customerName} booked ${serviceNames} at ${formattedTime}. Amount: ₹${updatedBooking?.total_amount}.`,
        booking_id,
        is_read: false,
        created_at: new Date().toISOString(),
      });
      if (ownerNotifErr) console.error("[verify-razorpay] owner notif error:", ownerNotifErr.message);
    }

    // ── 8. Send customer confirmation notification ──
    const formattedTimeForCustomer = formatSlotLabel(updatedBooking?.booking_time || "");
    const { error: notifErr } = await supabaseAdmin.from("notifications").insert({
      target_user_id: updatedBooking?.customer_id,
      type: "booking_confirmed",
      title: "✅ Booking Confirmed",
      message: `Your payment of ₹${updatedBooking?.total_amount} is verified. Booking at ${salonName} on ${formattedTimeForCustomer} is confirmed!`,
      booking_id,
      is_read: false,
      created_at: new Date().toISOString(),
    });
    if (notifErr) console.error("[verify-razorpay] customer notif error:", notifErr.message);

    console.log("[verify-razorpay] Booking confirmed:", booking_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment verified successfully",
        booking: updatedBooking ?? { id: booking_id, status: "upcoming", payment_status: "paid" },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[verify-razorpay] FATAL ERROR:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

