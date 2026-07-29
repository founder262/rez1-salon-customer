import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const ProfileSetupPage = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; phone?: string; dob?: string; gender?: string }>({});

  // Pre-fill fields from auth metadata (useful for Google OAuth users)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate("/login"); return; }
      // Pre-fill from existing customer row if present
      supabase.from("customers").select("full_name, email, phone").eq("id", user.id).maybeSingle().then(({ data }) => {
        if (data?.full_name) setName(data.full_name);
        else if (user.user_metadata?.full_name) setName(user.user_metadata.full_name);
        if (data?.email) setEmail(data.email);
        else if (user.email) setEmail(user.email);
        if (data?.phone) setPhone(data.phone);
        else if (user.phone) setPhone(user.phone);
      });
    });
  }, [navigate]);

  const validate = () => {
    const e: typeof errors = {};
    if (!name.trim()) e.name = "Name is required";
    if (!phone.trim()) e.phone = "Phone number is required";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Invalid email";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validate()) return;
    setLoading(true);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      toast.error(`Not authenticated: ${authError?.message || "User session missing"}`);
      setLoading(false);
      navigate("/login");
      return;
    }

    // Use upsert so this works for both new (Google OAuth) and existing users
    const { error } = await supabase.from("customers").upsert({
      id: user.id,
      full_name: name.trim(),
      email: email.trim() || user.email || null,
      phone: phone.trim(),
      date_of_birth: dob || null,
      gender: gender || null,
    }, { onConflict: "id" });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("Profile saved!");
    navigate("/location");
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background px-6 py-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto mt-12 flex w-full max-w-sm flex-col items-center gap-8"
      >
        <Logo size="lg" showText={false} />

        <div className="text-center">
          <h2 className="font-display text-2xl font-bold text-foreground">Set up your profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tell us a bit about yourself</p>
        </div>

        <div className="flex w-full flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Full Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              maxLength={50}
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
              autoFocus
            />
            {errors.name && <span className="text-xs text-destructive">{errors.name}</span>}
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Phone Number *</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9876543210"
              maxLength={15}
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            {errors.phone && <span className="text-xs text-destructive">{errors.phone}</span>}
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Email Address (Optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              maxLength={100}
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            {errors.email && <span className="text-xs text-destructive">{errors.email}</span>}
          </div>

          {/* Date of Birth */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Date of Birth (Optional)</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none text-muted-foreground focus:text-foreground focus:border-primary"
            />
            {errors.dob && <span className="text-xs text-destructive">{errors.dob}</span>}
          </div>

          {/* Gender */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Gender (Optional)</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none focus:border-primary"
            >
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
            {errors.gender && <span className="text-xs text-destructive">{errors.gender}</span>}
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={loading}
            className="mt-6 h-14 w-full rounded-2xl bg-primary text-base font-semibold text-primary-foreground transition-transform disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? "Saving..." : "Continue"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ProfileSetupPage;
