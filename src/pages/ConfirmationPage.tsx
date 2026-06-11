import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, Calendar, MapPin, Users } from "lucide-react";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabase";

const ConfirmationPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const state = location.state as any;

  const [salon, setSalon] = useState<any>(null);

  // In BookingSummaryPage we passed: { booking: data, finalPayableAmount }
  // Backwards compatibility with the older mock properties if user goes directly
  const bookingData = state?.booking;
  const totalPrice = state?.finalPayableAmount || state?.totalPrice || bookingData?.total_amount || 0;
  
  // Try to use bookingData if present, fallback to raw state if mocked
  const selectedSlot = bookingData?.booking_time || state?.selectedSlot || "";
  const selectedDay = bookingData?.booking_date 
    ? new Date(bookingData.booking_date) 
    : state?.selectedDay 
      ? new Date(state.selectedDay) 
      : new Date();
  const personCount = state?.personCount || 1;

  useEffect(() => {
    const fetchSalon = async () => {
      const { data } = await supabase
        .from("salons")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      setSalon(data);
    };
    if (id) fetchSalon();
  }, [id]);

  const formatSlotLabel = (time: string) => {
    if (!time) return "";
    const [h, m] = time.split(":").map(Number);
    const hour12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
    const ampm = h >= 12 ? "PM" : "AM";
    return `${hour12}:${m?.toString().padStart(2, "0") || "00"} ${ampm}`;
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6">
      <div className="absolute left-4 top-4">
        <Logo size="sm" />
      </div>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="flex flex-col items-center gap-6 text-center w-full"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
        >
          <CheckCircle className="h-20 w-20 text-primary" />
        </motion.div>

        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Booking Confirmed!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your appointment has been booked successfully
          </p>
        </div>

        {salon ? (
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 text-left">
            <p className="font-display text-base font-semibold text-foreground">
              {salon.name}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {salon.address}
            </p>
            <div className="mt-3 flex items-center gap-2 text-sm text-foreground">
              <Calendar className="h-4 w-4 text-primary" />
              {selectedDay.toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}{" "}
               at {formatSlotLabel(selectedSlot)}
              </div>
              {personCount > 1 && (
                <div className="mt-2 flex items-center gap-2 text-sm text-foreground">
                  <Users className="h-4 w-4 text-primary" />
                  {personCount} persons
                </div>
              )}
              <p className="mt-2 text-lg font-bold text-primary">₹{totalPrice}</p>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground w-full max-w-sm py-8 border border-border rounded-2xl">
            Loading salon details...
          </div>
        )}

        <div className="mt-4 flex w-full max-w-sm flex-col gap-3">
          <button
            onClick={() => navigate("/bookings")}
            className="h-14 w-full rounded-2xl bg-primary text-base font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
          >
            View Bookings
          </button>
          <button
            onClick={() => navigate("/home")}
            className="h-14 w-full rounded-2xl border border-border text-base font-medium text-foreground transition-colors hover:border-primary"
          >
            Back to Home
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ConfirmationPage;
