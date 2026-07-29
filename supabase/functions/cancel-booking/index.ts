// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function sha256Str(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function triggerPhonePeRefund(supabaseAdmin: any, booking: any, refundAmount: number) {
  try {
    const { data: config } = await supabaseAdmin
      .from("platform_config")
      .select("phonepe_merchant_id, phonepe_salt_key, phonepe_salt_index, phonepe_env")
      .maybeSingle();

    const merchantId = config?.phonepe_merchant_id || Deno.env.get("PHONEPE_MERCHANT_ID") || "PGTESTPAYUAT";
    const saltKey = config?.phonepe_salt_key || Deno.env.get("PHONEPE_SALT_KEY") || "099eb0cd-02fc-4e41-88db-1032db451407";
    const saltIndex = config?.phonepe_salt_index || Deno.env.get("PHONEPE_SALT_INDEX") || "1";
    const env = (config?.phonepe_env || Deno.env.get("PHONEPE_ENV") || "UAT").toUpperCase();

    const refundUrl = env === "PROD"
      ? "https://api.phonepe.com/apis/hermes/pg/v1/refund"
      : "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/refund";

    const originalTxnId = booking.phonepe_merchant_transaction_id;
    if (!originalTxnId) return null;

    const refundMerchantTransactionId = `RF_${booking.id.replace(/-/g, "").slice(0, 8)}_${Date.now()}`;

    const payloadObj = {
      merchantId,
      merchantTransactionId: refundMerchantTransactionId,
      originalTransactionId: originalTxnId,
      amount: Math.round(refundAmount * 100),
      callbackUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/verify-phonepe-payment`,
    };

    const base64Payload = btoa(JSON.stringify(payloadObj));
    const stringToSign = base64Payload + "/pg/v1/refund" + saltKey;
    const hash = await sha256Str(stringToSign);
    const xVerify = `${hash}###${saltIndex}`;

    const res = await fetch(refundUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": xVerify,
      },
      body: JSON.stringify({ request: base64Payload }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return data.data?.transactionId || refundMerchantTransactionId;
    } else {
      console.error("PhonePe refund failed:", data);
      return null;
    }
  } catch (err) {
    console.error("triggerPhonePeRefund error:", err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { booking_id, cancel_reason, silent, cancelled_by = 'customer', action, refund_type } = body

    if (!booking_id) {
      throw new Error("Missing booking_id")
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ── 1. Fetch the booking with salon and customer details ──
    const { data: booking, error: fetchErr } = await supabaseAdmin
      .from('bookings')
      .select('*, salons(name, owner_id)')
      .eq('id', booking_id)
      .single()

    if (fetchErr || !booking) {
      throw new Error('Booking not found')
    }

    const nowIso = new Date().toISOString()
    const totalAmount = Number(booking.total_amount ?? 0)
    const platformFee = Number(booking.platform_fee ?? 25)

    // ── 2. Handle Action: Customer choosing refund for owner-cancelled booking ──
    if (action === 'customer_choose_refund') {
      if (booking.cancelled_by !== 'owner' || booking.refund_status !== 'pending_choice') {
        throw new Error("Booking is not eligible for customer choice refund.")
      }

      // Owner cancelled booking gets FULL refund
      const refundAmount = totalAmount
      let refundId = null
      let refundStatus = 'failed'

      if (
        booking.payment_method === 'razorpay' &&
        booking.razorpay_payment_id &&
        booking.payment_status === 'paid' &&
        refundAmount > 0
      ) {
        const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')
        const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')

        if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
          const rzpAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
          const refundRes = await fetch(
            `https://api.razorpay.com/v1/payments/${booking.razorpay_payment_id}/refund`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${rzpAuth}`,
              },
              body: JSON.stringify({
                amount: refundAmount * 100, // paise
                speed: 'normal',
                notes: {
                  reason: 'Customer chose full refund for owner cancellation',
                  booking_id,
                  refund_type: 'full_refund_owner_cancelled',
                },
              }),
            }
          )

          const refundData = await refundRes.json()
          if (refundRes.ok && refundData.id) {
            refundId = refundData.id
            refundStatus = 'processing'
          } else {
            console.error('Razorpay refund failed:', refundData)
          }
        }
      } else if (
        (booking.payment_method === 'phonepe' || booking.phonepe_merchant_transaction_id) &&
        booking.payment_status === 'paid' &&
        refundAmount > 0
      ) {
        const ppTxnId = await triggerPhonePeRefund(supabaseAdmin, booking, refundAmount)
        if (ppTxnId) {
          refundId = ppTxnId
          refundStatus = 'processing'
        }
      } else {
        // If not razorpay/phonepe or not paid, mark as manually refunded / completed
        refundStatus = 'refunded'
      }

      const { error: updateErr } = await supabaseAdmin
        .from('bookings')
        .update({
          refund_status: refundStatus,
          refund_amount: refundAmount,
          refund_id: refundId || booking.refund_id,
          payment_status: refundStatus === 'processing' ? 'refund_processing' : 'refunded',
          updated_at: nowIso
        })
        .eq('id', booking_id)

      if (updateErr) throw updateErr

      return new Response(
        JSON.stringify({
          success: true,
          message: "Full refund initiated successfully.",
          refund_amount: refundAmount,
          refund_status: refundStatus
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // ── 3. Handle Action: Admin Manual Refund (or retry) ──
    if (action === 'admin_manual_refund') {
      // Determine how much to refund
      let refundAmount = Number(booking.refund_amount ?? 0)
      if (refundAmount <= 0) {
        // If not set, compute based on who cancelled
        if (booking.cancelled_by === 'owner') {
          refundAmount = totalAmount
        } else {
          // Customer cancelled: total_amount - platform_fee (clamped)
          refundAmount = Math.max(0, totalAmount - platformFee)
        }
      }

      let refundId = null
      let refundStatus = 'failed'

      if (
        booking.payment_method === 'razorpay' &&
        booking.razorpay_payment_id &&
        refundAmount > 0
      ) {
        const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')
        const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')

        if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
          const rzpAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
          const refundRes = await fetch(
            `https://api.razorpay.com/v1/payments/${booking.razorpay_payment_id}/refund`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${rzpAuth}`,
              },
              body: JSON.stringify({
                amount: refundAmount * 100, // paise
                speed: 'normal',
                notes: {
                  reason: 'Admin manually processed refund',
                  booking_id,
                  refund_type: 'admin_manual',
                },
              }),
            }
          )

          const refundData = await refundRes.json()
          if (refundRes.ok && refundData.id) {
            refundId = refundData.id
            refundStatus = 'processing'
          } else {
            console.error('Razorpay refund failed:', refundData)
          }
        }
      } else if (
        (booking.payment_method === 'phonepe' || booking.phonepe_merchant_transaction_id) &&
        refundAmount > 0
      ) {
        const ppTxnId = await triggerPhonePeRefund(supabaseAdmin, booking, refundAmount)
        if (ppTxnId) {
          refundId = ppTxnId
          refundStatus = 'processing'
        }
      } else {
        refundStatus = 'refunded'
      }

      const { error: updateErr } = await supabaseAdmin
        .from('bookings')
        .update({
          refund_status: refundStatus,
          refund_amount: refundAmount,
          refund_id: refundId || booking.refund_id,
          payment_status: refundStatus === 'processing' ? 'refund_processing' : 'refunded',
          updated_at: nowIso
        })
        .eq('id', booking_id)

      if (updateErr) throw updateErr

      return new Response(
        JSON.stringify({
          success: true,
          message: "Refund processed by admin.",
          refund_amount: refundAmount,
          refund_status: refundStatus
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // ── 4. Standard Cancellation flow (Customer or Owner) ──
    if (booking.status === 'cancelled') {
      return new Response(JSON.stringify({ success: true, message: 'Already cancelled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse appointment slot date time
    const slotTimeStr = `${booking.booking_date}T${booking.booking_time.padStart(5, '0')}:00`
    const slotTime = new Date(slotTimeStr)
    const now = new Date()
    const diffMs = slotTime.getTime() - now.getTime()
    const diffMins = diffMs / (1000 * 60)

    let refundAmount = 0
    let refundStatus = null
    let refundId = null
    let platformFeeStatus = 'retained' // default

    if (cancelled_by === 'owner') {
      // ── Owner cancellation rules ──
      // Must be before 3 hours of appointment slot time
      if (diffMins < 180) {
        return new Response(
          JSON.stringify({ success: false, error: "Salon owners can only cancel bookings before 3 hours of slot time." }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Owner cancellation is eligible for full refund OR reschedule
      // We set refund_status as 'pending_choice' to let customer select option later
      refundAmount = totalAmount // eligible for full refund
      refundStatus = 'pending_choice'
      platformFeeStatus = 'waived'
    } else {
      // ── Customer cancellation rules ──
      if (slotTime.getTime() < now.getTime()) {
        return new Response(
          JSON.stringify({ success: false, error: "Cannot cancel a booking slot that has already passed." }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Must be cancelled before 45 minutes of slot for partial refund
      if (diffMins >= 45) {
        // eligible for refund of service amount (total_amount - platform_fee)
        refundAmount = Math.max(0, totalAmount - platformFee)
        platformFeeStatus = 'retained'

        // Trigger Razorpay Refund immediately
        if (
          booking.payment_method === 'razorpay' &&
          booking.razorpay_payment_id &&
          booking.payment_status === 'paid' &&
          refundAmount > 0
        ) {
          const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')
          const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')

          if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
            const rzpAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
            const refundRes = await fetch(
              `https://api.razorpay.com/v1/payments/${booking.razorpay_payment_id}/refund`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Basic ${rzpAuth}`,
                },
                body: JSON.stringify({
                  amount: refundAmount * 100, // paise
                  speed: 'normal',
                  notes: {
                    reason: cancel_reason || 'Cancelled by customer before 45 mins',
                    booking_id,
                    refund_type: 'service_amount_only',
                  },
                }),
              }
            )

            const refundData = await refundRes.json()
            if (refundRes.ok && refundData.id) {
              refundId = refundData.id
              refundStatus = 'processing'
            } else {
              console.error('Razorpay refund failed:', refundData)
              refundStatus = 'failed'
            }
          }
        } else if (
          (booking.payment_method === 'phonepe' || booking.phonepe_merchant_transaction_id) &&
          booking.payment_status === 'paid' &&
          refundAmount > 0
        ) {
          const ppTxnId = await triggerPhonePeRefund(supabaseAdmin, booking, refundAmount)
          if (ppTxnId) {
            refundId = ppTxnId
            refundStatus = 'processing'
          } else {
            refundStatus = 'failed'
          }
        } else {
          // If Direct UPI or cash, mark as manual refund pending
          refundStatus = 'refunded'
        }
      } else {
        // Late customer cancellation: No refund
        refundAmount = 0
        refundStatus = 'none'
        platformFeeStatus = 'retained'
      }
    }

    // ── Update booking status, cancellation initiator and refund details ──
    const updatePayload: Record<string, any> = {
      status: 'cancelled',
      cancelled_by: cancelled_by,
      cancel_reason: cancel_reason || (cancelled_by === 'owner' ? 'Emergency cancellation by owner' : 'Cancelled by customer'),
      cancelled_at: nowIso,
      updated_at: nowIso,
      refund_amount: refundAmount,
      platform_fee: platformFee,
    }

    if (refundId) {
      updatePayload.refund_id = refundId
    }
    if (refundStatus) {
      updatePayload.refund_status = refundStatus
      // If it is processing or refunded, set payment status
      if (refundStatus === 'processing') {
        updatePayload.payment_status = 'refund_processing'
      } else if (refundStatus === 'refunded') {
        updatePayload.payment_status = 'refunded'
      }
    } else {
      updatePayload.refund_status = 'none'
    }

    const { error: updateErr } = await supabaseAdmin
      .from('bookings')
      .update(updatePayload)
      .eq('id', booking_id)

    if (updateErr) throw updateErr

    // ── Process Notification broadcasts (unless silent) ──
    if (!silent) {
      const salonName = booking.salons?.name || 'the salon'
      const formattedTime = booking.booking_time
      const formattedDate = booking.booking_date

      if (cancelled_by === 'owner') {
        // ── 1. Owner cancels: Notify customer about options ──
        const customerMessage = `Emergency: your booking at ${salonName} on ${formattedDate} at ${formattedTime} was cancelled by the salon owner. Please open your bookings list to choose a reschedule slot or get a full refund.`

        await supabaseAdmin.from('notifications').insert({
          target_type: 'individual',
          target_id: booking.customer_id,
          target_user_id: booking.customer_id,
          type: 'booking_cancelled_by_owner',
          notif_type: 'booking',
          title: '⚠️ Booking Cancelled by Salon',
          message: customerMessage,
          booking_id,
          is_read: false,
          created_at: nowIso,
        })
      } else {
        // ── 2. Customer cancels: Notify owner and customer ──
        let customerName = 'A customer'
        try {
          const { data: custData } = await supabaseAdmin
            .from('customers')
            .select('full_name')
            .eq('id', booking.customer_id)
            .maybeSingle()
          if (custData?.full_name) customerName = custData.full_name
        } catch (_) {}

        // Notification to customer
        let refundMsg = ''
        if (refundAmount > 0) {
          refundMsg = ` ₹${refundAmount} (service amount) refund has been initiated to your original payment method. Platform fee ₹${platformFee} is retained.`
        } else {
          refundMsg = ` No refund is initiated as cancellation occurred within 45 minutes of the slot.`
        }

        await supabaseAdmin.from('notifications').insert({
          target_type: 'individual',
          target_id: booking.customer_id,
          target_user_id: booking.customer_id,
          type: 'booking_cancelled_by_customer',
          notif_type: 'booking',
          title: '❌ Booking Cancelled',
          message: `Your booking at ${salonName} on ${formattedDate} at ${formattedTime} has been cancelled.${refundMsg}`,
          booking_id,
          is_read: false,
          created_at: nowIso,
        })

        // 8a. owner_booking_alerts — shown in the owner panel alert feed
        const { error: alertErr } = await supabaseAdmin.from('owner_booking_alerts').insert({
          owner_id: booking.salons?.owner_id,
          salon_id: booking.salon_id,
          booking_id,
          customer_name: `❌ ${customerName} cancelled`,
          service_summary: booking.service_names || 'Service',
          booking_time: formattedTime,
          is_read: false,
        })
        if (alertErr) console.error('Owner alert insert error:', alertErr.message)

        // 8b. notifications table — persisted in owner's notification bell
        await supabaseAdmin.from('notifications').insert({
          target_user_id: booking.salons?.owner_id,
          type: 'booking_cancelled',
          title: `❌ Booking Cancelled by ${customerName}`,
          message: `${customerName} cancelled booking on ${formattedDate} at ${formattedTime}. Refund status: ${refundStatus}.`,
          booking_id,
          is_read: false,
          created_at: nowIso,
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        refund_amount: refundAmount,
        refund_id: refundId,
        refund_status: refundStatus,
        platform_fee: platformFee,
        cancelled_by: cancelled_by,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (err: any) {
    console.error('Cancel Booking Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

