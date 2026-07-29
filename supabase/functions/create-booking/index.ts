// @ts-nocheck
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
    const {
      userId,
      salonId,
      bookingDate,
      bookingTime,
      status,
      paymentMethod,
      paymentStatus,
      totalAmount,
      subtotal,
      offerDiscount,
      platformFee,
      gstAmount,
      personCount,
      durationMinutes,
      services,
      razorpayPaymentId,
      phonepeMerchantTransactionId,
      phonepeTransactionId,
      serviceNames,
      customerName,
      slotTimeLabel,
    } = body;

    // ── 1. Validate required fields ──
    if (!userId || !salonId || !bookingDate || !bookingTime) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Verify user exists in customers table ──
    const { data: customer } = await supabase
      .from("customers")
      .select("id, full_name, phone")
      .eq("id", userId)
      .maybeSingle();

    if (!customer) {
      return new Response(
        JSON.stringify({ success: false, error: "Customer not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Verify salon exists ──
    const { data: salon } = await supabase
      .from("salons")
      .select("id, name, owner_id, total_seats")
      .eq("id", salonId)
      .single();

    if (!salon) {
      return new Response(
        JSON.stringify({ success: false, error: "Salon not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Check slot availability (explicitly blocked slots) ──
    const { data: blockedSlot } = await supabase
      .from("slots")
      .select("id")
      .eq("salon_id", salonId)
      .eq("slot_date", bookingDate)
      .eq("slot_time", bookingTime)
      .eq("status", "blocked")
      .maybeSingle();

    if (blockedSlot) {
      return new Response(
        JSON.stringify({ success: false, error: "This slot is blocked and not available for booking." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4b. Check seat capacity ──
    const totalSeats = salon.total_seats || 4;

    const { data: activeBookings, error: bookingsErr } = await supabase
      .from("bookings")
      .select("person_count")
      .eq("salon_id", salonId)
      .eq("booking_date", bookingDate)
      .eq("booking_time", bookingTime)
      .neq("status", "cancelled")
      .neq("status", "pending_payment");

    if (bookingsErr) {
      console.error("Error checking bookings capacity:", bookingsErr);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to verify slot capacity." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bookedSeats = (activeBookings || []).reduce((sum: number, b: any) => sum + (b.person_count || 1), 0);
    const remainingSeats = Math.max(0, totalSeats - bookedSeats);
    const requestedSeats = personCount || 1;

    if (requestedSeats > remainingSeats) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Only ${remainingSeats} seat(s) are remaining for this slot time. You requested ${requestedSeats} seat(s).` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 5. Create booking record ──
    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .insert({
        customer_id: userId,
        salon_id: salonId,
        booking_date: bookingDate,
        booking_time: bookingTime,
        status: status || "upcoming", // 'upcoming', 'completed', 'cancelled'
        payment_method: paymentMethod, // 'razorpay', 'upi_direct', 'cash'
        payment_status: paymentStatus, // 'paid', 'pending', 'failed'
        total_amount: totalAmount,
        subtotal: subtotal,
        offer_discount: offerDiscount,
        platform_fee: platformFee,
        gst_amount: gstAmount || 0,
        person_count: personCount || 1,
        duration_minutes: durationMinutes,
        service_names: serviceNames,
        razorpay_payment_id: razorpayPaymentId || null,
        phonepe_merchant_transaction_id: phonepeMerchantTransactionId || null,
        phonepe_transaction_id: phonepeTransactionId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (bookingErr) {
      console.error("Booking creation failed:", bookingErr);
      return new Response(
        JSON.stringify({ success: false, error: bookingErr.message || "Booking creation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 6. Owner notification is intentionally NOT sent here ──
    // Owner is only notified AFTER payment is verified (in verify-razorpay-payment).
    // This prevents ghost bookings appearing in the owner panel when customer cancels payment.

    // ── 7. Send customer pending notification only (if not pending_payment state) ──
    if (status !== "pending_payment") {
      await supabase
        .from("notifications")
        .insert({
          target_user_id: userId,
          type: "booking_confirmed",
          title: `Booking Confirmed at ${salon.name}`,
          message: `Your booking for ${bookingDate} at ${slotTimeLabel} is confirmed.`,
          booking_id: booking.id,
          is_read: false,
          created_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();
    }

    // ── 8. Return success response ──
    return new Response(
      JSON.stringify({
        success: true,
        data: booking,
        message: "Booking created successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("create-booking edge function error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

