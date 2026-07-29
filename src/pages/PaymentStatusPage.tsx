import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const PaymentStatusPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState<"verifying" | "success" | "failed">("verifying");
  const [errorMessage, setErrorMessage] = useState("");
  const [bookingData, setBookingData] = useState<any>(null);

  const merchantTransactionId = searchParams.get("merchantTransactionId") || searchParams.get("transactionId");
  const bookingId = searchParams.get("bookingId");

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const { data: resData, error: fnError } = await supabase.functions.invoke("verify-phonepe-payment", {
          body: {
            merchantTransactionId,
            bookingId,
          },
        });

        if (fnError || !resData?.success) {
          const msg = resData?.message || fnError?.message || "Payment verification pending or failed.";
          setErrorMessage(msg);
          setStatus("failed");
          toast.error(msg);
          return;
        }

        setStatus("success");
        setBookingData(resData.booking);
        toast.success("Payment verified! Booking confirmed.");

        setTimeout(() => {
          const salonId = resData.booking?.salon_id || "";
          navigate(`/confirmation/${salonId}`, {
            state: {
              booking: resData.booking,
              finalPayableAmount: resData.booking?.total_amount,
              paymentVerified: true,
            },
            replace: true,
          });
        }, 1500);
      } catch (err: any) {
        console.error("Payment status verification error:", err);
        setErrorMessage(err.message || "Unable to verify payment.");
        setStatus("failed");
      }
    };

    verifyPayment();
  }, [merchantTransactionId, bookingId, navigate]);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-center">
      {status === "verifying" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center space-y-6"
        >
          <div className="relative flex h-24 w-24 items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary"
            />
            <Logo size="sm" showText={false} />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Verifying Your Payment
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Please wait while we confirm your payment details with PhonePe...
          </p>
        </motion.div>
      )}

      {status === "success" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center space-y-4"
        >
          <div className="h-20 w-20 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Payment Verified!
          </h2>
          <p className="text-sm text-muted-foreground">
            Redirecting to your booking confirmation...
          </p>
        </motion.div>
      )}

      {status === "failed" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center space-y-6 max-w-sm"
        >
          <div className="h-20 w-20 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <XCircle className="h-12 w-12" />
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-2xl font-bold text-foreground">
              Payment Not Verified
            </h2>
            <p className="text-sm text-muted-foreground">
              {errorMessage || "We could not verify your payment at this moment."}
            </p>
          </div>
          <div className="flex gap-3 w-full pt-2">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-border bg-card text-foreground font-semibold hover:bg-muted transition-all"
            >
              <RefreshCw className="h-4 w-4" /> Retry Check
            </button>
            <button
              onClick={() => navigate("/bookings")}
              className="flex-1 py-3 px-4 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all"
            >
              View Bookings
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default PaymentStatusPage;
