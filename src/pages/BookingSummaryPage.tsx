import { useMemo, useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, Clock, MapPin, Scissors, 
  Users, ShieldCheck, 
  ArrowRight, QrCode
} from "lucide-react";
import BackButton from "@/components/BackButton";
import Logo from "@/components/Logo";
import { BUFFER_TIME } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const BookingSummaryPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [salon, setSalon] = useState<any>(null);
  const [platformConfig, setPlatformConfig] = useState<any>(null);
  
  const state = location.state as any;
  const selectedServiceIds = state?.selectedServices || [];
  const selectedServices = state?.servicesContent || [];
  const selectedSlot = state?.selectedSlot || "";
  const selectedDay = state?.selectedDay ? new Date(state.selectedDay) : new Date();
  const personCount = state?.personCount || 1;

  const [isProcessing, setIsProcessing] = useState(false);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [originalBooking, setOriginalBooking] = useState<any>(null);

  useEffect(() => {
    if (state?.reschedulingBookingId) {
      supabase.from('bookings').select('*').eq('id', state.reschedulingBookingId).maybeSingle().then(({ data }) => {
        if (data) setOriginalBooking(data);
      });
    }
  }, [state?.reschedulingBookingId]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: salonData } = await supabase
        .from("salons")
        .select("*")
        .eq("id", id)
        .single();

      const { data: offersData } = await supabase
        .from("salon_offers")
        .select("*")
        .eq("salon_id", id);

      setSalon({ ...salonData, salon_offers: offersData || [] });

      const { data: configData } = await supabase
        .from("platform_config")
        .select("*")
        .maybeSingle();
      setPlatformConfig(configData);
    };
    if (id) fetchData();
  }, [id]);

  const totalDuration = selectedServices.reduce((sum: number, s: any) => sum + (Number(s.duration) || 0), 0) * personCount;
  const totalPrice = selectedServices.reduce((sum: number, s: any) => sum + s.price, 0) * personCount;
  const offerPercent = useMemo(() => {
    if (!salon?.salon_offers?.[0]) return 0;
    const offer = salon.salon_offers[0];
    const type = offer.active_type;
    if (!type || type === 'none') return 0;
    if (type === 'all_days') return offer.all_days_percentage || 0;
    if (type === "specific_day") {
      const selectedDateStr = selectedDay.toISOString().split("T")[0];
      if (offer.specific_day_date === selectedDateStr) return offer.specific_day_percentage || 0;
    } else if (type === "weekday_weekend") {
      const day = selectedDay.getDay();
      const isWeekend = day === 0 || day === 6;
      return isWeekend ? (offer.weekend_percentage || 0) : (offer.weekday_percentage || 0);
    }
    return 0;
  }, [salon, selectedDay]);

  const discountedPrice = salon ? Math.round(totalPrice * (1 - offerPercent / 100)) : totalPrice;
  const discountAmount = totalPrice - discountedPrice;
  const BOOKING_CHARGES = platformConfig?.booking_fee ?? 25;
  const finalPayableAmount = discountedPrice + BOOKING_CHARGES;

  const formatSlotLabel = (time: string) => {
    if (!time) return "";
    const [h, m] = time.split(":").map(Number);
    const hour12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
    const ampm = h >= 12 ? "PM" : "AM";
    return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  const insertBooking = async (userId: string, paymentMethod: string, status: string, paymentStatus: string, rzpPaymentId?: string) => {
    // Fetch customer details to get name
    const { data: customerData } = await supabase.from('customers').select('full_name').eq('id', userId).maybeSingle();
    const { data: { user } } = await supabase.auth.getUser();
    const customerName = customerData?.full_name || user?.user_metadata?.full_name || 'Customer';

    const serviceNames = selectedServices.map((s: any) => s.name).join(", ");

    // Use the edge function to bypass RLS - it runs with service role permissions
    const { data: result, error: fnError } = await supabase.functions.invoke('create-booking', {
      body: {
        userId,
        salonId: salon.id,
        bookingDate: selectedDay.toISOString().split("T")[0],
        bookingTime: selectedSlot,
        status,
        paymentMethod,
        paymentStatus,
        totalAmount: finalPayableAmount,
        subtotal: totalPrice,
        offerDiscount: discountAmount,
        platformFee: BOOKING_CHARGES,
        gstAmount: 0,
        personCount,
        durationMinutes: totalDuration,
        services: selectedServices,
        razorpayPaymentId: rzpPaymentId || null,
        serviceNames,
        customerName,
        slotTimeLabel: formatSlotLabel(selectedSlot),
      }
    });

    if (fnError || !result?.success) {
      const errMsg = result?.error || fnError?.message || 'Booking creation failed';
      console.error('create-booking error:', errMsg);
      return { data: null, error: { message: errMsg } };
    }

    return { data: result.data, error: null };
  };

  const handleConfirmPayment = async () => {
    if (isProcessing) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in to book");
      return;
    }

    if (platformConfig?.razorpay_enabled) {
      setIsProcessing(true);

      try {
        // ── Fetch customer phone for prefill (prevents Razorpay account-creation prompt) ──
        const { data: customerData } = await supabase
          .from("customers")
          .select("phone, full_name")
          .eq("id", user.id)
          .maybeSingle();

        const customerPhone = customerData?.phone || user?.phone || "";
        const customerName = customerData?.full_name || user?.user_metadata?.full_name || user?.email || "";

        // ── STEP 1: Create booking as 'upcoming' with payment_status 'pending' ──
        // Owner panel filters out payment_status='pending' so this won't show until payment confirmed
        const { data: pendingBooking, error: bookingErr } = await insertBooking(
          user.id,
          "razorpay",
          "upcoming",
          "pending"
        );

        if (bookingErr || !pendingBooking) {
          toast.error("Failed to create booking. Please try again.");
          setIsProcessing(false);
          return;
        }

        // ── STEP 2: Create Razorpay Order ──
        const { data: orderResult, error: orderErr } = await supabase.functions.invoke('create-razorpay-order', {
          body: {
            salonId: salon.id,
            amount: finalPayableAmount,
            currency: "INR",
            receipt: `rez1_${pendingBooking.id.slice(0, 8)}_${Date.now()}`,
            description: `Booking at ${salon.name}`,
          }
        });

        if (orderErr || !orderResult?.success) {
          toast.error(orderResult?.error || "Failed to create payment order");
          setIsProcessing(false);
          return;
        }

        setIsProcessing(false);

        // ── STEP 3: Open Razorpay Checkout (BookMyShow-style UPI-first config) ──
        const options = {
          key: orderResult.keyId,
          amount: orderResult.amount,
          currency: orderResult.currency,
          order_id: orderResult.orderId,
          name: "REZ1",
          description: `Booking at ${salon.name}`,
          image: window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" 
            ? "https://ui-avatars.com/api/?name=REZ1&background=B8860B&color=fff&size=256&rounded=true&font-size=0.33&bold=true" 
            : `${window.location.origin}/rez1-logo.svg`,

          // ── Pre-fill user details so no account creation prompt ──
          prefill: {
            name: customerName,
            email: user?.email || "",
            contact: customerPhone,
          },

          // ── Mark fields readonly so Razorpay doesn't prompt user to fill them ──
          readonly: {
            contact: !!customerPhone,
            email: !!user?.email,
            name: !!customerName,
          },

          // ── Disable Razorpay account creation / save card prompts ──
          remember_customer: false,

          notes: {
            bookingId: pendingBooking.id,
            salonId: salon.id,
          },

          // ── REZ1 dark-gold theme ──
          theme: {
            color: "#B8860B",
            hide_topbar: false,
            backdrop_color: "rgba(0,0,0,0.85)",
          },

          modal: {
            // When user dismisses Razorpay, silently cancel the booking to free the slot
            ondismiss: async () => {
              setIsProcessing(false);
              if (pendingBooking?.id) {
                // Direct DB update via admin-api — no notifications sent (not a real cancellation)
                await supabase.functions.invoke("admin-api", {
                  body: {
                    action: "UPDATE",
                    table: "bookings",
                    id: pendingBooking.id,
                    data: {
                      status: "cancelled",
                      payment_status: "failed",
                      cancel_reason: "Payment dismissed by customer",
                      updated_at: new Date().toISOString(),
                    },
                  },
                });
              }
            },
            confirm_close: true,
            escape: true,
          },

          handler: async function (response: any) {
            // ── STEP 4: Verify Signature Server-Side (SECURE) ──
            setIsProcessing(true);

            try {
              const verifyResult = await supabase.functions.invoke('verify-razorpay-payment', {
                body: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  booking_id: pendingBooking.id,
                }
              });

              if (verifyResult.error || !verifyResult.data?.success) {
                console.error("Payment verification failed:", verifyResult);
                toast.error("Payment verification failed. Please contact support.");
                setIsProcessing(false);
                return;
              }

              // ── STEP 5: Payment Verified - Booking Confirmed ──
              toast.success("Payment verified! Booking confirmed.");
              setIsProcessing(false);
              navigate(`/confirmation/${salon.id}`, {
                state: {
                  booking: verifyResult.data.booking,
                  finalPayableAmount,
                  paymentVerified: true
                }
              });
            } catch (err: any) {
              console.error("Payment verification error:", err);
              toast.error("Failed to verify payment. Please contact support.");
              setIsProcessing(false);
            }
          },
        };

        const rzp = new (window as any).Razorpay(options);
        
        rzp.on('payment.failed', async function (response: any) {
          toast.error(response.error.description || "Payment failed. Please try again.");
          setIsProcessing(false);
          
          // Silently cancel booking via admin-api (no notifications — not a real customer cancellation)
          if (pendingBooking?.id) {
            await supabase.functions.invoke("admin-api", {
              body: {
                action: "UPDATE",
                table: "bookings",
                id: pendingBooking.id,
                data: {
                  status: "cancelled",
                  payment_status: "failed",
                  cancel_reason: "Payment failed",
                  updated_at: new Date().toISOString(),
                },
              },
            });
          }
        });
        
        rzp.open();

      } catch (err: any) {
        console.error("Razorpay payment error:", err);
        toast.error("Payment initialization failed. Please try again.");
        setIsProcessing(false);
      }
    } else {
      // Show UPI flow modal
      setShowUpiModal(true);
    }
  };

  const handleUpiPaymentConfirmed = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setShowUpiModal(false);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in to book");
      setIsProcessing(false);
      return;
    }

    const { data, error } = await insertBooking(user.id, "upi_direct", "upcoming", "pending");

    if (error) {
      console.error(error);
      toast.error("Failed to save booking. Please try again.");
      setIsProcessing(false);
    } else {
      toast.success("Booking Confirmed! Pending payment verification.");
      navigate(`/confirmation/${salon.id}`, { state: { booking: data, finalPayableAmount } });
    }
  };

  const handleConfirmReschedule = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in to reschedule");
      setIsProcessing(false);
      return;
    }

    const newDateStr = selectedDay.toISOString().split("T")[0];
    const newTimeStr = selectedSlot;
    const formattedTime = formatSlotLabel(newTimeStr);
    const serviceNames = selectedServices.map((s: any) => s.name).join(", ");

    try {
      // 1. Fetch customer details
      const { data: customerData } = await supabase
        .from('customers')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      const customerName = customerData?.full_name || user?.user_metadata?.full_name || 'Customer';

      // 2. Fetch salon details
      const { data: salonData } = await supabase
        .from('salons')
        .select('owner_id, name')
        .eq('id', salon.id)
        .single();

      // 3. Update the booking via admin-api proxy
      const { data: updateRes, error: updateErr } = await supabase.functions.invoke("admin-api", {
        body: {
          action: "UPDATE",
          table: "bookings",
          id: state.reschedulingBookingId,
          data: {
            booking_date: newDateStr,
            booking_time: newTimeStr,
            status: "upcoming",
            payment_status: "paid",
            refund_status: "rescheduled",
            updated_at: new Date().toISOString(),
          }
        }
      });

      if (updateErr || !updateRes) {
        throw new Error(updateRes?.error?.message || updateErr?.message || "Failed to update booking date/time");
      }

      // 4. Send owner booking alert (real-time notification in owner panel)
      if (salonData?.owner_id) {
        // Insert owner alert
        await supabase.functions.invoke("admin-api", {
          body: {
            action: "INSERT",
            table: "owner_booking_alerts",
            data: {
              owner_id: salonData.owner_id,
              salon_id: salon.id,
              booking_id: state.reschedulingBookingId,
              customer_name: `🔄 ${customerName} rescheduled`,
              service_summary: serviceNames,
              booking_time: formattedTime,
              is_read: false,
            }
          }
        });

        // Insert owner notification
        await supabase.functions.invoke("admin-api", {
          body: {
            action: "INSERT",
            table: "notifications",
            data: {
              target_user_id: salonData.owner_id,
              type: "booking_rescheduled",
              title: `🔄 Booking Rescheduled — ${formattedTime}`,
              message: `${customerName} rescheduled their cancelled booking at ${salonData.name} to ${newDateStr} at ${formattedTime}.`,
              booking_id: state.reschedulingBookingId,
              is_read: false,
              created_at: new Date().toISOString(),
            }
          }
        });
      }

      // 5. Insert customer notification
      await supabase.functions.invoke("admin-api", {
        body: {
          action: "INSERT",
          table: "notifications",
          data: {
            target_user_id: user.id,
            type: "booking_rescheduled",
            title: "🔄 Reschedule Confirmed",
            message: `Your booking at ${salon.name} has been successfully rescheduled to ${newDateStr} at ${formattedTime}!`,
            booking_id: state.reschedulingBookingId,
            is_read: false,
            created_at: new Date().toISOString(),
          }
        }
      });

      toast.success("Booking rescheduled successfully!");
      setIsProcessing(false);
      navigate(`/confirmation/${salon.id}`, {
        state: {
          booking: {
            id: state.reschedulingBookingId,
            booking_date: newDateStr,
            booking_time: newTimeStr,
            status: "upcoming",
            payment_status: "paid",
            total_amount: finalPayableAmount,
          },
          finalPayableAmount: 0,
          paymentVerified: true,
          isRescheduled: true,
        }
      });

    } catch (err: any) {
      console.error("Rescheduling error:", err);
      toast.error("Failed to reschedule: " + err.message);
      setIsProcessing(false);
    }
  };

  if (!salon) return <div className="p-4 text-foreground">Loading...</div>;

  return (
    <div className="min-h-[100dvh] bg-background pb-44">
      {/* Processing Overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 backdrop-blur-xl"
          >
            <div className="relative flex h-24 w-24 items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary"
              />
              <Logo size="sm" showText={false} />
            </div>
            <motion.h3 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6 font-display text-xl font-bold text-foreground"
            >
              Processing...
            </motion.h3>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Options Modal - REZ1 Premium UPI Style */}
      <AnimatePresence>
        {showUpiModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-end justify-end sm:items-center sm:justify-center"
            style={{ background: "rgba(0,0,0,0.85)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowUpiModal(false); }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-full max-w-md sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl"
              style={{ background: "#0D0D10", border: "1px solid rgba(184,134,11,0.2)" }}
            >
              {/* Header strip */}
              <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: "rgba(184,134,11,0.15)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-base font-bold text-white">Pay via UPI</h3>
                    <p className="text-xs mt-0.5" style={{ color: "#888" }}>
                      Choose your preferred UPI app
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium" style={{ color: "#888" }}>Amount</p>
                    <p className="text-lg font-bold" style={{ color: "#B8860B" }}>₹{finalPayableAmount}</p>
                  </div>
                </div>
              </div>

              <div className="px-4 pt-4 pb-2">
                {/* UPI Intent Apps */}
                {salon.upi_number && (
                  <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#555" }}>
                      Pay by UPI App
                    </p>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      {/* PhonePe */}
                      <a
                        href={`phonepe://pay?pa=${salon.upi_number}&pn=${encodeURIComponent(salon.name)}&am=${finalPayableAmount}&cu=INR&tn=${encodeURIComponent("REZ1 Booking")}`}
                        className="flex flex-col items-center gap-1.5 active:opacity-70"
                        target="_blank" rel="noreferrer"
                      >
                        <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg"
                          style={{ background: "linear-gradient(135deg, #5f259f, #7b2fbe)" }}>
                          P
                        </div>
                        <span className="text-[10px] font-medium text-center" style={{ color: "#aaa" }}>PhonePe</span>
                      </a>

                      {/* Google Pay */}
                      <a
                        href={`tez://upi/pay?pa=${salon.upi_number}&pn=${encodeURIComponent(salon.name)}&am=${finalPayableAmount}&cu=INR&tn=${encodeURIComponent("REZ1 Booking")}`}
                        className="flex flex-col items-center gap-1.5 active:opacity-70"
                        target="_blank" rel="noreferrer"
                      >
                        <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg"
                          style={{ background: "linear-gradient(135deg, #1a73e8, #34a853)" }}>
                          G
                        </div>
                        <span className="text-[10px] font-medium text-center" style={{ color: "#aaa" }}>GPay</span>
                      </a>

                      {/* Paytm */}
                      <a
                        href={`paytmmp://pay?pa=${salon.upi_number}&pn=${encodeURIComponent(salon.name)}&am=${finalPayableAmount}&cu=INR&tn=${encodeURIComponent("REZ1 Booking")}`}
                        className="flex flex-col items-center gap-1.5 active:opacity-70"
                        target="_blank" rel="noreferrer"
                      >
                        <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg"
                          style={{ background: "linear-gradient(135deg, #00b9f1, #0079be)" }}>
                          ₹
                        </div>
                        <span className="text-[10px] font-medium text-center" style={{ color: "#aaa" }}>Paytm</span>
                      </a>

                      {/* BHIM / Other */}
                      <a
                        href={`upi://pay?pa=${salon.upi_number}&pn=${encodeURIComponent(salon.name)}&am=${finalPayableAmount}&cu=INR&tn=${encodeURIComponent("REZ1 Booking")}`}
                        className="flex flex-col items-center gap-1.5 active:opacity-70"
                        target="_blank" rel="noreferrer"
                      >
                        <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg"
                          style={{ background: "linear-gradient(135deg, #ff6b35, #f72585)" }}>
                          B
                        </div>
                        <span className="text-[10px] font-medium text-center" style={{ color: "#aaa" }}>BHIM</span>
                      </a>
                    </div>

                    {/* Generic UPI redirect */}
                    <a
                      href={`upi://pay?pa=${salon.upi_number}&pn=${encodeURIComponent(salon.name)}&am=${finalPayableAmount}&cu=INR&tn=${encodeURIComponent("REZ1 Salon Booking")}`}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 w-full transition-all active:opacity-70"
                      style={{ background: "rgba(184,134,11,0.08)", border: "1px solid rgba(184,134,11,0.2)" }}
                      target="_blank" rel="noreferrer"
                    >
                      <QrCode className="h-5 w-5" style={{ color: "#B8860B" }} />
                      <div className="flex-1 text-left">
                        <p className="text-sm font-semibold text-white">Any UPI App</p>
                        <p className="text-xs" style={{ color: "#666" }}>Open with your preferred UPI app</p>
                      </div>
                      <ArrowRight className="h-4 w-4" style={{ color: "#B8860B" }} />
                    </a>
                  </div>
                )}

                {/* QR Code */}
                {salon.upi_scanner_url && (
                  <div className="mb-4 rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(184,134,11,0.25)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#555" }}>
                      Or Scan QR Code
                    </p>
                    <div className="flex flex-col items-center gap-2">
                      <div className="rounded-xl border-2 p-2 bg-white" style={{ borderColor: "rgba(184,134,11,0.3)" }}>
                        <img src={salon.upi_scanner_url} alt="UPI QR Code" className="h-24 w-24 object-contain" />
                      </div>
                      <p className="text-xs" style={{ color: "#666" }}>Scan with any UPI app</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="px-4 pb-6 space-y-2 pt-2">
                <button
                  onClick={handleUpiPaymentConfirmed}
                  className="w-full py-4 rounded-2xl text-sm font-bold text-black transition-all active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #F5D07A, #B8860B)" }}
                >
                  ✓ I've Completed the Payment
                </button>
                <button
                  onClick={() => setShowUpiModal(false)}
                  className="w-full py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
                  style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#888" }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-md px-4 py-3">
        <div className="flex items-center gap-3">
          <BackButton />
          <h2 className="font-display text-base font-semibold text-foreground">
            Booking Summary
          </h2>
        </div>
        <Logo size="sm" showText={false} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-lg px-4 pt-6"
      >
        {/* Salon Info */}
        <div className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <img
              src={salon.salon_images?.[0] || "/assets/placeholder.jpg"}
              alt={salon.name}
              className="h-14 w-14 rounded-xl object-cover"
            />
            <div>
              <h3 className="font-display text-base font-semibold text-foreground">
                {salon.name}
              </h3>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {salon.address}
              </p>
            </div>
          </div>
        </div>

        {/* Date & Time */}
        <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                {selectedDay.toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              <p className="text-xs text-muted-foreground font-medium">
                {formatSlotLabel(selectedSlot)}
              </p>
            </div>
          </div>
        </div>

        {/* Duration */}
        <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
              <Clock className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {totalDuration} min service + {BUFFER_TIME} min buffer
            </p>
          </div>
        </div>

        {/* Persons */}
        {personCount > 1 && (
          <div className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                <Users className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-foreground">
                For {personCount} persons
              </p>
            </div>
          </div>
        )}

        {/* Services List */}
        <div className="mb-6 rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="border-b border-border bg-muted/30 px-5 py-3">
            <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Scissors className="h-3.5 w-3.5" />
              Selected Services
            </h4>
          </div>
          <div className="p-5">
            <div className="space-y-3">
              {selectedServices.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{s.name}</span>
                  <span className="text-sm font-bold text-foreground">₹{s.price}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Total Amount</span>
                <span>₹{totalPrice}</span>
              </div>
              {offerPercent > 0 && (
                <div className="flex items-center justify-between text-xs font-bold text-[#e31837]">
                  <span>Offer Discount ({offerPercent}% off)</span>
                  <span>- ₹{discountAmount}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm font-bold text-foreground">
                <span>Final Salon Fee</span>
                <span>₹{discountedPrice}</span>
              </div>
              <div className="flex items-center justify-between border-t border-dashed border-border pt-3">
                <span className="text-xs font-medium text-primary">Rez1 Booking Charges</span>
                <span className="text-xs font-bold text-primary">₹{BOOKING_CHARGES}</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <h3 className="text-lg font-bold text-foreground">Grand Total</h3>
                <h3 className="text-xl font-bold text-primary">₹{finalPayableAmount}</h3>
              </div>
              {state?.reschedulingBookingId && (
                <>
                  <div className="flex items-center justify-between border-t border-border pt-2 text-xs font-semibold text-muted-foreground">
                    <span>Pre-payment Applied</span>
                    <span className="text-[#34a853]">- ₹{originalBooking?.total_amount ?? finalPayableAmount}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-dashed border-primary/20 pt-2 font-bold text-primary">
                    <span className="text-sm">Due Now</span>
                    <span className="text-lg">₹0</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Safety Badge */}
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-muted/50 py-3 mb-8">
          <ShieldCheck className="h-4 w-4 text-green-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Secure Checkout with Rez1</span>
        </div>
      </motion.div>

      {/* Pay Button Sticky */}
      <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md px-4 py-3">
        <div className="mx-auto max-w-lg">
          <button
            onClick={state?.reschedulingBookingId ? handleConfirmReschedule : handleConfirmPayment}
            className="group flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-primary text-base font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all active:scale-[0.98] active:shadow-inner"
          >
            <span>
              {state?.reschedulingBookingId 
                ? "Confirm Reschedule" 
                : platformConfig?.razorpay_enabled 
                ? "Pay Securely" 
                : "Pay via UPI"} - ₹{state?.reschedulingBookingId ? 0 : finalPayableAmount}
            </span>
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </button>
          <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">
            {state?.reschedulingBookingId ? "Free slot rescheduling" : platformConfig?.razorpay_enabled ? "Powered by Razorpay" : "Direct payment to salon"}
          </p>
          <p className="mt-1 text-center text-[11px] text-muted-foreground opacity-80">
            {state?.reschedulingBookingId 
              ? "Confirming will instantly reschedule your slot. No extra charges apply." 
              : platformConfig?.razorpay_enabled 
              ? "Secure payments via Razorpay — cards, UPI, wallets, netbanking." 
              : "Complete UPI payment in your app, then confirm here."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default BookingSummaryPage;
