import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Logomark from "@/components/Logo";
import { Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Supabase will automatically handle the access_token in the URL hash
    // We just need to check if there is a hash when the component mounts
    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token")) {
      toast.error("Invalid or expired password reset link.");
      navigate("/login");
    }
  }, [navigate]);

  const handleUpdate = async () => {
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    setError("");
    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    });

    if (updateError) {
      toast.error(updateError.message);
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
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
          <h2 className="text-xl font-bold text-white text-center tracking-wide">Update Password</h2>

          {success ? (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#B8860B]/10 border border-[#B8860B]/30">
                <CheckCircle2 className="h-8 w-8 text-[#B8860B]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">Password Updated!</h3>
                <p className="text-sm text-[#888]">
                  Your password has been successfully changed.
                </p>
              </div>
              <button
                onClick={() => navigate("/login")}
                className="mt-6 h-14 w-full rounded-2xl bg-gradient-to-r from-[#B8860B] to-[#966D09] text-sm font-bold text-black hover:opacity-90 transition-all"
              >
                PROCEED TO SIGN IN
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#888] uppercase tracking-wider ml-1">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555]" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-[#1A1A1F] bg-[#0A0A0F] pl-11 pr-11 py-3.5 text-sm text-white outline-none placeholder:text-[#333] tracking-[0.2em] focus:border-[#B8860B] transition-colors"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#888]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {error && <p className="text-[10px] text-destructive ml-1">{error}</p>}
                <p className="text-[10px] text-[#555] ml-1 mt-1">Must be at least 6 characters.</p>
              </div>

              <button
                onClick={handleUpdate}
                disabled={loading}
                className="mt-2 h-14 w-full rounded-2xl bg-gradient-to-r from-[#B8860B] to-[#966D09] text-sm font-bold text-black hover:opacity-90 transition-all disabled:opacity-50"
              >
                {loading ? "UPDATING..." : "UPDATE PASSWORD"}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPasswordPage;
