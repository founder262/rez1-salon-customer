import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import Logomark from "@/components/Logo";
import { Eye, EyeOff } from "lucide-react";
import { LegalConsent } from "@/components/LegalConsent";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const SignUpPage = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [isConsented, setIsConsented] = useState(false);
  const [errors, setErrors] = useState<{ general?: string }>({});

  const validate = () => {
    if (!fullName.trim()) return "Full name is required";
    if (!email.trim() || !email.includes("@")) return "Valid email is required";
    if (password.length < 6) return "Password must be at least 6 characters";
    if (password !== confirmPassword) return "Passwords do not match";
    if (phone.length < 10) return "Valid phone number is required";
    return null;
  };

  const handleSignUp = async () => {
    const errorMsg = validate();
    if (errorMsg) {
      toast.error(errorMsg);
      return;
    }
    
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: phone.trim()
        }
      }
    });

    if (error) {
      toast.error(error.message);
      setErrors({ general: error.message });
      setLoading(false);
      return;
    }

    if (data.user) {
      if (!data.session) {
        // Email confirmations are enabled and the user needs to verify their email
        toast.success("Please check your email to verify your account before logging in!");
        navigate("/login");
      } else {
        // Email confirmations are disabled, session is available
        toast.success("Account created successfully!");
        await supabase.from("customers").upsert({ 
          id: data.user.id, 
          email: email.trim(),
          full_name: fullName.trim(),
          phone: phone.trim()
        }, { onConflict: "id" });
        navigate("/profile-setup");
      }
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/home`
      }
    });
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#050505] px-6 py-8 noise-overlay overflow-x-hidden">
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-[#B8860B]/5 to-transparent pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 mx-auto w-full max-w-md flex-col items-center flex gap-8"
      >
        <div className="flex flex-col items-center">
          <Logomark size="lg" showText={true} className="flex-col !gap-6 text-center" />
        </div>

        <div className="w-full">
          <LegalConsent onConsentChange={setIsConsented} />
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={!isConsented}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-[#1A1A1F] bg-[#0A0A0F] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#1A1A1F] disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex w-full items-center gap-4 text-[#444]">
          <div className="h-px flex-1 bg-[#1A1A1F]"></div>
          <span className="text-xs font-bold w-4 text-center">OR</span>
          <div className="h-px flex-1 bg-[#1A1A1F]"></div>
        </div>

        {/* Form */}
        <div className="flex w-full flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-white">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-2xl border border-[#1A1A1F] bg-[#0A0A0F] px-4 py-3 text-sm text-white outline-none placeholder:text-[#444] focus:border-[#B8860B] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-white">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-2xl border border-[#1A1A1F] bg-[#0A0A0F] px-4 py-3 text-sm text-white outline-none placeholder:text-[#444] focus:border-[#B8860B] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-white">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-[#1A1A1F] bg-[#0A0A0F] pl-4 pr-11 py-3 text-sm text-white outline-none placeholder:text-[#444] focus:border-[#B8860B] transition-colors"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#666] hover:text-[#999]"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-white">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-2xl border border-[#1A1A1F] bg-[#0A0A0F] pl-4 pr-11 py-3 text-sm text-white outline-none placeholder:text-[#444] focus:border-[#B8860B] transition-colors"
              />
              <button 
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#666] hover:text-[#999]"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-white">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 XXXXX XXXXX"
              className="w-full rounded-2xl border border-[#1A1A1F] bg-[#0A0A0F] px-4 py-3 text-sm text-white outline-none placeholder:text-[#444] focus:border-[#B8860B] transition-colors"
            />
          </div>

          {errors.general && <p className="text-center text-xs text-destructive mt-2">{errors.general}</p>}

          <button
            onClick={handleSignUp}
            disabled={loading || !isConsented}
            className="mt-6 h-14 w-full rounded-2xl bg-[#615222] hover:bg-[#726128] text-sm font-semibold text-[#CCC] transition-colors disabled:opacity-50"
          >
            {loading ? "Signing up..." : "Sign up"}
          </button>
        </div>

      </motion.div>
    </div>
  );
};

export default SignUpPage;
