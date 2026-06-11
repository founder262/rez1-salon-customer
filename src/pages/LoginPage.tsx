import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import Logomark from "@/components/Logo";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { LegalConsent } from "@/components/LegalConsent";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const LoginPage = () => {
  const navigate = useNavigate();
  const [emailOrUser, setEmailOrUser] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isConsented, setIsConsented] = useState(false);

  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!emailOrUser.trim()) e.email = "Email address is required";
    if (!password.trim()) e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();

    // Terms & Conditions validation
    if (!isConsented) {
      toast.warning("Please accept the Terms & Conditions and Privacy Policy before continuing.", {
        duration: 4000,
        position: "bottom-center",
      });
      return;
    }

    if (!validate()) return;
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailOrUser.trim(),
      password: password,
    });

    if (error) {
      setLoading(false);
      const msg = error.message.toLowerCase();

      // Email not confirmed — must check BEFORE invalid credentials catch-all
      if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
        toast.error(
          "Please verify your email address before signing in. Check your inbox and spam folder for the verification email.",
          {
            duration: 7000,
            description: "Email Verification Required",
          }
        );
        return;
      }

      // User not found / invalid credentials
      if (
        msg.includes("invalid login credentials") ||
        msg.includes("user not found") ||
        msg.includes("no user") ||
        msg.includes("invalid email or password") ||
        msg.includes("invalid")
      ) {
        toast.error(
          "No account exists with this email address, or your password is incorrect. Please check your credentials or create a new account.",
          {
            duration: 6000,
            description: "Account Not Found",
            action: {
              label: "Go to Sign Up",
              onClick: () => navigate("/signup"),
            },
          }
        );
        return;
      }

      // Network / generic error
      if (msg.includes("network") || msg.includes("fetch") || msg.includes("connection")) {
        toast.error("Network error. Please check your internet connection and try again.", {
          position: "bottom-center",
        });
        return;
      }

      // Fallback
      toast.error(error.message, { position: "bottom-center" });
      return;
    }

    // Successful sign-in — check email confirmation status
    const user = data.user!;

    // Supabase returns the user even before email confirmation in some configs;
    // check the email_confirmed_at field as a safeguard
    if (!user.email_confirmed_at && !user.confirmed_at) {
      // Sign the user back out — they haven't confirmed yet
      await supabase.auth.signOut();
      toast.error(
        "Please verify your email address before signing in. Check your inbox and spam folder for the verification email.",
        {
          duration: 7000,
          position: "bottom-center",
          description: "Email Verification Required",
        }
      );
      setLoading(false);
      return;
    }

    const userId = user.id;

    // Check if customer profile exists
    const { data: customer, error: fetchError } = await supabase
      .from("customers")
      .select("id, full_name, preferred_location_id")
      .eq("id", userId)
      .maybeSingle();

    if (fetchError) {
      console.error("Fetch Error:", fetchError);
    }

    if (!customer && !fetchError) {
      const { error: insertError } = await supabase.from("customers").upsert(
        { id: userId, email: emailOrUser.trim() },
        { onConflict: "id" }
      );
      if (insertError) {
        console.error("Failed to create/upsert customer profile:", insertError);
        toast.error(`Database Error: ${insertError.message}`, { position: "bottom-center" });
        setLoading(false);
        return;
      }
      navigate("/profile-setup");
    } else if (customer && !customer.full_name) {
      navigate("/profile-setup");
    } else if (customer && !customer.preferred_location_id) {
      navigate("/location");
    } else {
      navigate("/home");
    }

    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    if (!isConsented) {
      toast.warning("Please accept the Terms & Conditions and Privacy Policy before continuing.", {
        duration: 4000,
        position: "bottom-center",
      });
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/home`,
      },
    });
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
          <h2 className="text-xl font-bold text-white text-center tracking-wide">Sign In</h2>

          <LegalConsent onConsentChange={setIsConsented} />

          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-[#1A1A1F] bg-[#0F0F0F] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#1A1A1F]"
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

          <form onSubmit={handleLogin} className="flex flex-col gap-6" noValidate>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-[#888] uppercase tracking-wider ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555]" />
                <input
                  type="text"
                  value={emailOrUser}
                  onChange={(e) => setEmailOrUser(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  className="w-full rounded-2xl border border-[#1A1A1F] bg-[#0A0A0F] pl-11 pr-4 py-3.5 text-sm text-white outline-none placeholder:text-[#333] focus:border-[#B8860B] transition-colors"
                />
              </div>
              {errors.email && <p className="text-[10px] text-destructive ml-1">{errors.email}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center ml-1 mr-1">
                <label className="text-xs font-bold text-[#888] uppercase tracking-wider">Password</label>
                <Link to="/forgot-password" className="text-xs font-bold text-[#B8860B] hover:text-[#F5D07A] transition-colors">FORGOT?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555]" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
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
              {errors.password && <p className="text-[10px] text-destructive ml-1">{errors.password}</p>}
            </div>

            <button
              type="submit"
              id="login-submit-btn"
              disabled={loading}
              className="mt-2 h-14 w-full rounded-2xl bg-gradient-to-r from-[#B8860B] to-[#966D09] text-sm font-bold text-black hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                "SIGN IN"
              )}
            </button>
          </form>
        </div>

        <div className="text-center pb-8">
          <p className="text-sm text-[#888]">
            New to REZ1?{" "}
            <Link to="/signup" className="font-bold text-[#B8860B] hover:text-[#F5D07A] transition-colors">
              Create Account
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
