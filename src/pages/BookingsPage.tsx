import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, MapPin, X, AlertTriangle, RefreshCcw } from "lucide-react";
import BackButton from "@/components/BackButton";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type Tab = "upcoming" | "completed" | "cancelled";

const BookingsPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const [bookings, setBookings] = useState<{
    upcoming: any[];
    completed: any[];
    cancelled: any[];
  }>({
    upcoming: [],
    completed: [],
    cancelled: [],
  });
  const [loading, setLoading] = useState(true);

  // Cancel modal state
  const [cancelTarget, setCancelTarget] = useState<any>(null); // booking object being cancelled
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const tabs: { key: Tab; label: string }[] = [
    { key: "upcoming", label: "Upcoming" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
  ];

  const fetchBookings = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("bookings")
      .select(
        `
        *,
        salons (
          name,
          address
        )
      `,
      )
      .eq("customer_id", user.id)
      .order("booking_date", { ascending: false });

    if (data) {
      const todayStr = new Date().toISOString().split("T")[0];

      const grouped = {
        upcoming: [] as any[],
        completed: [] as any[],
        cancelled: [] as any[],
      };

      data.forEach((b: any) => {
        if (b.status === "cancelled") {
          grouped.cancelled.push(b);
        } else if (b.status === "completed") {
          grouped.completed.push(b);
        } else if (b.booking_date >= todayStr) {
          grouped.upcoming.push(b);
        } else {
          grouped.completed.push(b);
        }
      });

      // Ensure upcoming are sorted ascending (soonest first)
      grouped.upcoming.sort((a, b) => {
        return (
          new Date(`${a.booking_date}T${a.booking_time}`).getTime() -
          new Date(`${b.booking_date}T${b.booking_time}`).getTime()
        );
      });

      setBookings(grouped);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBookings();

    const handleReload = () => {
      setLoading(true);
      fetchBookings();
    };

    window.addEventListener("rez1-bookings-reload", handleReload);
    return () => {
      window.removeEventListener("rez1-bookings-reload", handleReload);
    };
  }, []);

  const currentBookings = bookings[activeTab];

  const formatSlotLabel = (time: string) => {
    if (!time) return "";
    const [h, m] = time.split(":").map(Number);
    const hour12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
    const ampm = h >= 12 ? "PM" : "AM";
    return `${hour12}:${m?.toString().padStart(2, "0") || "00"} ${ampm}`;
  };

  // ── CANCEL BOOKING ──
  const handleCancelConfirm = async () => {
    if (!cancelTarget || isCancelling) return;
    setIsCancelling(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase.functions.invoke("cancel-booking", {
        body: {
          booking_id: cancelTarget.id,
          cancel_reason: cancelReason.trim() || "Cancelled by customer",
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error || error?.message || "Failed to cancel booking");
        return;
      }

      // Build success toast with refund info
      if (data.refund_amount > 0 && data.refund_status === "processing") {
        toast.success(
          `Booking cancelled! ₹${data.refund_amount} refund initiated — arrives within 1 hour. Platform fee ₹${data.platform_fee} is non-refundable.`,
          { duration: 7000 }
        );
      } else {
        toast.success("Booking cancelled successfully.");
      }

      // \u2500\u2500 DEDUCT 10 POINTS FOR CANCELLATION (safe deduction, min 0) \u2500\u2500
      if (user) {
        try {
          const { data: customerData } = await supabase
            .from("customers")
            .select("reward_points")
            .eq("id", user.id)
            .maybeSingle();

          const currentPoints = customerData?.reward_points || 0;
          if (currentPoints > 0) {
            const newPoints = Math.max(0, currentPoints - 10);
            const pointsToDeduct = Math.min(10, currentPoints);

            await supabase
              .from("customers")
              .update({ reward_points: newPoints })
              .eq("id", user.id);

            // Record transaction (non-blocking)
            await supabase.functions.invoke("admin-api", {
              body: {
                action: "INSERT",
                table: "reward_transactions",
                data: {
                  user_id: user.id,
                  points: -pointsToDeduct,
                  transaction_type: "Booking Cancelled",
                  description: "10 points deducted for booking cancellation",
                  booking_id: cancelTarget.id,
                  created_at: new Date().toISOString(),
                }
              }
            });
          }
        } catch (ptErr) {
          console.warn("Points deduction on cancellation failed (non-blocking):", ptErr);
        }
      }

      setCancelTarget(null);
      setCancelReason("");
      // Refresh bookings
      setLoading(true);
      await fetchBookings();
    } catch (err: any) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  };

  // Compute refund preview for modal
  const getRefundPreview = (b: any) => {
    const subtotal      = Number(b.subtotal       ?? 0);
    const offerDiscount = Number(b.offer_discount ?? 0);
    const platformFee   = Number(b.platform_fee   ?? 25);
    const totalAmount   = Number(b.total_amount   ?? 0);
    const serviceAmount = subtotal - offerDiscount;
    const refundAmount  = Math.max(0, Math.min(serviceAmount, totalAmount - platformFee));
    return { refundAmount, platformFee };
  };

  // Refund status badge helpers
  const refundBadge = (b: any) => {
    if (!b.refund_status && !b.refund_amount) return null;
    const status = b.refund_status;
    const amount = b.refund_amount;

    if (status === "processing") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold text-amber-400">
          <RefreshCcw className="h-2.5 w-2.5 animate-spin" />
          Refund Processing ₹{amount}
        </span>
      );
    }
    if (status === "refunded") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-1 text-[10px] font-bold text-green-400">
          ✓ Refunded ₹{amount}
        </span>
      );
    }
    if (status === "failed") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-[10px] font-bold text-red-400">
          ✗ Refund Failed
        </span>
      );
    }
    return null;
  };

  return (
    <div className="min-h-[100dvh] bg-background safe-bottom">
      {/* ── Cancel Confirmation Modal ── */}
      <AnimatePresence>
        {cancelTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
            style={{ background: "rgba(0,0,0,0.75)" }}
            onClick={(e) => { if (e.target === e.currentTarget) { setCancelTarget(null); setCancelReason(""); } }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              className="w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
              style={{ background: "#0D0D10", border: "1px solid rgba(184,134,11,0.2)" }}
            >
              {/* Modal header */}
              <div
                className="flex items-center justify-between px-5 pt-5 pb-4 border-b"
                style={{ borderColor: "rgba(184,134,11,0.15)" }}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <h3 className="font-display text-base font-bold text-white">Cancel Booking</h3>
                </div>
                <button
                  onClick={() => { setCancelTarget(null); setCancelReason(""); }}
                  className="rounded-full p-1.5 transition-all"
                  style={{ background: "rgba(255,255,255,0.07)" }}
                >
                  <X className="h-4 w-4 text-white/60" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                {/* Booking info */}
                <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <p className="text-sm font-bold text-white">{cancelTarget?.salons?.name}</p>
                  <p className="mt-1 text-xs" style={{ color: "#888" }}>
                    {cancelTarget?.booking_date
                      ? new Date(cancelTarget.booking_date + "T00:00:00").toLocaleDateString("en-IN", {
                          weekday: "long", day: "numeric", month: "long",
                        })
                      : ""}{" "}
                    at {formatSlotLabel(cancelTarget?.booking_time)}
                  </p>
                </div>

                {/* Refund breakdown */}
                {(() => {
                  const { refundAmount, platformFee } = getRefundPreview(cancelTarget);
                  const isPaid =
                    (cancelTarget?.payment_method === "razorpay" || cancelTarget?.payment_method === "phonepe" || cancelTarget?.phonepe_merchant_transaction_id) &&
                    cancelTarget?.payment_status === "paid";

                  return isPaid ? (
                    <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(184,134,11,0.08)", border: "1px solid rgba(184,134,11,0.2)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#B8860B" }}>
                        Refund Breakdown
                      </p>
                      <div className="flex justify-between text-xs" style={{ color: "#bbb" }}>
                        <span>Service Amount (refundable)</span>
                        <span className="font-bold text-green-400">₹{refundAmount}</span>
                      </div>
                      <div className="flex justify-between text-xs" style={{ color: "#bbb" }}>
                        <span>Rez1 Platform Fee (non-refundable)</span>
                        <span className="font-bold text-red-400">₹{platformFee}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between text-xs font-bold" style={{ borderColor: "rgba(184,134,11,0.2)" }}>
                        <span style={{ color: "#B8860B" }}>You will receive</span>
                        <span style={{ color: "#B8860B" }}>₹{refundAmount} within 1 hr</span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <p className="text-xs" style={{ color: "#888" }}>
                        {cancelTarget?.payment_status !== 'paid'
                          ? "Payment not confirmed — no refund will be processed."
                          : "UPI direct payments are refunded manually by the salon."}
                      </p>
                    </div>
                  );
                })()}

                {/* Cancel reason */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "#888" }}>
                    Reason (optional)
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Tell us why you're cancelling..."
                    rows={2}
                    className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none transition-all"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#eee",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(184,134,11,0.5)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="px-5 pb-6 space-y-2">
                <button
                  onClick={handleCancelConfirm}
                  disabled={isCancelling}
                  className="w-full py-4 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #e31837, #b01229)" }}
                >
                  {isCancelling ? "Cancelling..." : "Yes, Cancel Booking"}
                </button>
                <button
                  onClick={() => { setCancelTarget(null); setCancelReason(""); }}
                  disabled={isCancelling}
                  className="w-full py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
                  style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#888" }}
                >
                  Keep Booking
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-md px-4 py-3">
        <h2 className="font-display text-lg font-bold text-foreground">
          My Bookings
        </h2>
        <Logo size="sm" showText={false} />
      </div>

      <div className="mx-auto max-w-lg px-4 pt-4">
        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-2xl bg-muted p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {tab.label}
              {tab.key === "upcoming" && bookings.upcoming.length > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                  {bookings.upcoming.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Bookings List */}
        {loading ? (
          <div className="mt-16 text-center text-sm text-muted-foreground">
            Loading bookings...
          </div>
        ) : currentBookings.length === 0 ? (
          <div className="mt-16 text-center">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              No {activeTab} bookings
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-8">
            {currentBookings.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-border bg-card p-4"
              >
                {/* Salon name + status badge */}
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-display text-base font-semibold text-foreground">
                    {b.salons?.name || "Unknown Salon"}
                  </h4>
                  {activeTab === "cancelled" && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium ${
                      b.cancelled_by === 'owner' || b.cancelled_by === 'emergency' || b.cancelled_by === 'admin'
                        ? 'bg-orange-500/15 text-orange-400'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {b.cancelled_by === 'emergency'
                        ? '🚨 Emergency'
                        : b.cancelled_by === 'admin'
                        ? 'Admin Cancelled'
                        : b.cancelled_by === 'owner'
                        ? 'Salon Cancelled'
                        : b.cancel_reason
                          ? (b.cancel_reason.length > 20 ? b.cancel_reason.slice(0, 20) + '…' : b.cancel_reason)
                          : 'You Cancelled'}
                    </span>
                  )}
                </div>

                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {b.salons?.address || ""}
                </p>

                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(b.booking_date + "T00:00:00").toLocaleDateString("en-IN", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatSlotLabel(b.booking_time)}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Booking ID: {b.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-sm font-bold text-primary">
                    ₹{b.total_amount}
                  </p>
                </div>

                {/* Refund badge (on cancelled tab) */}
                {activeTab === "cancelled" && (
                  <div className="mt-2">
                    {refundBadge(b)}

                    {(b.cancelled_by === 'owner' || b.cancelled_by === 'emergency' || b.cancelled_by === 'admin') && (!b.refund_status || b.refund_status === 'pending_choice') && (
                      <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-primary" />
                          {b.cancelled_by === 'emergency' ? '🚨 Emergency Closure' : b.cancelled_by === 'admin' ? 'Cancelled by Admin' : 'Cancelled by Salon'}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {b.payment_status === 'paid'
                            ? (b.cancelled_by === 'emergency'
                              ? 'The salon had to close due to an emergency. You are eligible for a free reschedule or a full refund.'
                              : 'This booking was cancelled. You are eligible for a free reschedule to another slot or a full refund.')
                            : (b.cancelled_by === 'emergency'
                              ? 'The salon had to close due to an emergency. You can reschedule your slot for free. For UPI/direct refunds, contact the salon.'
                              : 'This booking was cancelled. You can reschedule your slot for free. For UPI/direct refunds, contact the salon.')}
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            onClick={() => {
                              navigate(`/salon/${b.salon_id}`, {
                                state: {
                                  reschedulingBookingId: b.id,
                                  personCount: b.person_count || 1,
                                  selectedServices: b.services?.map((s: any) => s.id) || [],
                                  servicesContent: b.services || [],
                                }
                              });
                            }}
                            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-all active:scale-[0.97]"
                          >
                            <RefreshCcw className="h-3 w-3" />
                            Reschedule Slot
                          </button>
                          {b.payment_status === 'paid' && (b.payment_method === 'razorpay' || b.payment_method === 'phonepe' || b.phonepe_merchant_transaction_id) && (
                            <button
                              onClick={async () => {
                                try {
                                  const confirmFullRefund = window.confirm("Are you sure you want to request a full refund?");
                                  if (!confirmFullRefund) return;
                                  
                                  const { data: refundRes, error: refundErr } = await supabase.functions.invoke("cancel-booking", {
                                    body: {
                                      booking_id: b.id,
                                      action: 'customer_choose_refund'
                                    }
                                  });

                                  if (refundErr || !refundRes?.success) {
                                    toast.error(refundRes?.error || refundErr?.message || "Failed to process refund");
                                  } else {
                                    toast.success(`Full refund of ₹${refundRes.refund_amount} initiated!`);
                                    fetchBookings();
                                  }
                                } catch (err: any) {
                                  toast.error("Error processing refund");
                                }
                              }}
                              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-[0.97]"
                            >
                              Get Full Refund
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Cancel Button (upcoming only) ── */}
                {activeTab === "upcoming" && (
                  <div className="mt-3 border-t border-border pt-3">
                    <button
                      onClick={() => { setCancelTarget(b); setCancelReason(""); }}
                      className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-400 transition-all active:scale-[0.97]"
                      style={{ background: "rgba(227,24,55,0.08)", border: "1px solid rgba(227,24,55,0.18)" }}
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel Booking
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingsPage;
