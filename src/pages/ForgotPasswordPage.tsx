import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import Logomark from "@/components/Logo";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async () => {
    if (!email.trim()) {
      setError("Email address is required");
      return;
    }
    setError("");
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (resetError) {
      toast.error(resetError.message);
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#111] px-4 py-8 noise-overlay overflow-x-hidden pt-12">
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-[#B8860B]/10 to-transparent pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 mx-auto w-full max-w-[420px] flex-col items-center flex gap-8"
      >
        <div className="flex flex-col items-center">
          <Logomark size="lg" showText={true} className="flex-col !gap-6 text-center" />
        </div>

        <div className="w-full bg-[#0A0A0A] rounded-3xl p-8 flex flex-col gap-6" style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>
          <h2 className="text-xl font-bold text-white text-center tracking-wide">Reset Password</h2>

          {sent ? (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#B8860B]/10 border border-[#B8860B]/30">
                <CheckCircle2 className="h-8 w-8 text-[#B8860B]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">Check your email</h3>
                <p className="text-sm text-[#888]">
                  We sent a password reset link to <strong className="text-white">{email}</strong>. Check your inbox and click the link to reset your password.
                </p>
              </div>
              <button
                onClick={() => navigate("/login")}
                className="mt-6 h-14 w-full rounded-2xl border border-[#1A1A1F] bg-[#0F0F0F] text-sm font-bold text-white hover:bg-[#1A1A1F] transition-all flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                BACK TO LOGIN
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#888] uppercase tracking-wider ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    placeholder="name@example.com"
                    className="w-full rounded-2xl border border-[#1A1A1F] bg-[#0A0A0F] pl-11 pr-4 py-3.5 text-sm text-white outline-none placeholder:text-[#333] focus:border-[#B8860B] transition-colors"
                  />
                </div>
                {error && <p className="text-[10px] text-destructive ml-1">{error}</p>}
              </div>

              <button
                onClick={handleReset}
                disabled={loading}
                className="mt-2 h-14 w-full rounded-2xl bg-gradient-to-r from-[#B8860B] to-[#966D09] text-sm font-bold text-black hover:opacity-90 transition-all disabled:opacity-50"
              >
                {loading ? "SENDING..." : "SEND RESET LINK"}
              </button>

              <button
                onClick={() => navigate("/login")}
                className="h-14 w-full rounded-2xl border border-[#1A1A1F] bg-[#0F0F0F] text-sm font-bold text-[#888] hover:text-white hover:bg-[#1A1A1F] transition-all flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                BACK TO LOGIN
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;
