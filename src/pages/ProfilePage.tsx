import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, LogOut, ChevronRight, 
  Calendar, Heart,  
  Bell, ShieldCheck, Mail, Phone,
  Settings, HelpCircle, Info, Star,
  ArrowLeft, Navigation, Camera, MapPin, FileText, RefreshCcw
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";
import { useFavorites } from "@/contexts/FavoritesContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type ProfileView = "main" | "favorites" | "edit" | "help";

const ProfilePage = () => {
  const navigate = useNavigate();
  const { favorites, toggleFavorite } = useFavorites();
  const [activeView, setActiveView] = useState<ProfileView>("main");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeView]);
  
  // Profile State
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Favorite Salons State
  const [favoriteSalons, setFavoriteSalons] = useState<any[]>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        // Fetch core profile fields separately from reward_points
        // to avoid a missing column breaking the entire fetch
        const { data, error } = await supabase
          .from("customers")
          .select("full_name, email, phone, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Profile fetch error:", error.message);
        }

        if (data) {
          setName(data.full_name || "");
          setEmail(data.email || "");
          setPhone(data.phone || user.phone || "");
          setAvatarUrl(data.avatar_url || "");
        }

        // Fetch reward_points separately (column may not exist in older DBs)
        try {
          const { data: rewardData } = await supabase
            .from("customers")
            .select("reward_points")
            .eq("id", user.id)
            .maybeSingle();
          if (rewardData?.reward_points !== undefined) {
            setStats(prev => ({ ...prev, points: rewardData.reward_points || 0 }));
          }
        } catch {
          // reward_points column might not exist yet — ignore
        }
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (favorites.length > 0) {
        const { data } = await supabase.from("salons").select("*").in("id", favorites);
        if (data) setFavoriteSalons(data);
      } else {
        setFavoriteSalons([]);
      }
    };
    fetchFavorites();
  }, [favorites]);

  // Help Center State
  const [helpName, setHelpName] = useState(name);
  const [helpEmail, setHelpEmail] = useState(email);
  const [helpPhone, setHelpPhone] = useState(phone);
  const [helpQuery, setHelpQuery] = useState("");
  const [isSubmittingHelp, setIsSubmittingHelp] = useState(false);
  const [helpSuccess, setHelpSuccess] = useState(false);

  useEffect(() => {
    if (name) setHelpName(name);
    if (email) setHelpEmail(email);
    if (phone) setHelpPhone(phone);
  }, [name, email, phone]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!userId || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setIsUploadingAvatar(true);
    const ext = file.name.split(".").pop();
    const path = `${userId}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadError) { toast.error("Upload failed: " + uploadError.message); setIsUploadingAvatar(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: updateError } = await supabase.from("customers").update({ avatar_url: publicUrl }).eq("id", userId);
    if (updateError) { toast.error("Failed to save avatar"); } else { setAvatarUrl(publicUrl); toast.success("Profile photo updated!"); }
    setIsUploadingAvatar(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    navigate("/");
  };

  const handleSaveProfile = async () => {
    if (!userId) return;
    setIsSaving(true);
    const { error } = await supabase.from("customers").upsert({
      id: userId,
      full_name: name,
      email: email,
      phone: phone
    }, { onConflict: "id" });

    if (error) {
      toast.error(error.message || "Failed to update profile");
      console.error("Profile Error:", error);
    } else {
      toast.success("Profile updated");
      localStorage.setItem("rez1-profile", JSON.stringify({ name, email, phone }));
      setActiveView("main");
    }
    setIsSaving(false);
  };

  // Stats State
  const [stats, setStats] = useState({ bookings: 0, points: 0, reviews: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      if (!userId) return;
      
      const { count: bookingCount } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", userId);

      const { count: reviewCount } = await supabase
        .from("reviews")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", userId);

      // Fetch actual reward_points from customers table
      const { data: customerData } = await supabase
        .from("customers")
        .select("reward_points")
        .eq("id", userId)
        .maybeSingle();

      setStats({
        bookings: bookingCount || 0,
        points: customerData?.reward_points || 0,  // ✅ Real points from DB
        reviews: reviewCount || 0
      });
    };
    fetchStats();
  }, [userId]);

  const containerVariants = {
    hidden: { opacity: 0, x: 20 },
    show: {
      opacity: 1,
      x: 0,
      transition: { type: "spring", stiffness: 300, damping: 30, staggerChildren: 0.1 }
    },
    exit: { opacity: 0, x: -20 }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
  };

  const menuSections = [
    {
      title: "Account",
      items: [
        { icon: Calendar, label: "My Bookings", onClick: () => navigate("/bookings") },
        { icon: Heart, label: "Favorite Salons", onClick: () => setActiveView("favorites") },
      ]
    },
    {
      title: "Preferences",
      items: [
        { icon: Bell, label: "Notifications", onClick: () => navigate("/notifications") },
        { icon: Settings, label: "Edit Profile", onClick: () => setActiveView("edit") },
      ]
    },
    {
      title: "Support",
      items: [
        { icon: HelpCircle, label: "Help Center", onClick: () => setActiveView("help") },
      ]
    }
  ];

  const renderMainView = () => (
    <motion.div
      key="main"
      variants={containerVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      className="px-4 sm:px-6 pt-4"
    >
      {/* User Card */}
      <motion.div variants={itemVariants} className="mb-6 rounded-3xl border border-border bg-card p-6 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4">
          <ThemeToggle />
        </div>
        
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border-2 border-primary/20 overflow-hidden group"
              title="Change profile photo"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-primary/20 text-primary">
                  <User className="h-10 w-10" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                {isUploadingAvatar ? (
                  <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </div>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            <div className="absolute bottom-0 right-0 h-5 w-5 rounded-full border-2 border-card bg-green-500 shadow-sm" title="Active" />
          </div>

          <h3 className="font-display text-xl font-bold text-foreground">
            {name || "User"}
          </h3>

          <div className="w-full space-y-2.5 rounded-2xl bg-muted/30 p-4 mt-2">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 text-primary/60 shrink-0" />
              <span className="truncate">{email || "Add email"}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Phone className="h-4 w-4 text-primary/60 shrink-0" />
              <span>{phone || "Add phone"}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div variants={itemVariants} className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: "Bookings", value: stats.bookings, icon: Calendar },
          { label: "Points", value: stats.points, icon: Star },
          { label: "Reviews", value: stats.reviews, icon: Mail },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col items-center rounded-2xl border border-border bg-card p-3 shadow-sm transition-transform hover:scale-[1.02]">
            <div className="mb-1 rounded-full bg-primary/10 p-1.5">
              <stat.icon className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-bold text-foreground">{stat.value}</span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
          </div>
        ))}
      </motion.div>

      {/* Reward Points Status Card */}
      <motion.div variants={itemVariants} className="mb-8">
        <div className={`rounded-2xl border p-4 ${stats.points >= 100 ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30'}`}>
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${stats.points >= 100 ? 'bg-primary/15' : 'bg-muted/50'}`}>
              <Star className={`h-5 w-5 ${stats.points >= 100 ? 'text-primary fill-primary/20' : 'text-muted-foreground'}`} />
            </div>
            <div className="flex-1">
              <p className="text-lg font-bold text-foreground">
                {stats.points} Points
              </p>
              <p className="text-sm font-bold text-foreground mt-1">
                {stats.points >= 100
                  ? `✓ Eligible for Reward Redemption`
                  : `Need ${100 - stats.points} more points to unlock reward redemption.`}
              </p>
              <p className="text-[11px] text-muted-foreground mt-2">
                Use points only when you reach a minimum of 100 points.
              </p>
            </div>
          </div>
          {stats.points > 0 && stats.points < 100 && (
            <div className="mt-3 h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/60 transition-all duration-500"
                style={{ width: `${Math.min(100, (stats.points / 100) * 100)}%` }}
              />
            </div>
          )}
        </div>
      </motion.div>

      {/* Menu Sections */}
      {menuSections.map((section) => (
        <motion.div key={section.title} variants={itemVariants} className="mb-6">
          <h4 className="mb-3 px-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {section.title}
          </h4>
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            {section.items.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="flex w-full items-center gap-3 border-b border-border/50 px-5 py-4 last:border-0 transition-all hover:bg-muted/50 active:bg-muted group"
              >
                <div className="rounded-xl bg-muted/50 p-2 group-hover:bg-primary/10 transition-colors">
                  <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <span className="flex-1 text-left text-sm font-semibold text-foreground">
                  {item.label}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
              </button>
            ))}
          </div>
        </motion.div>
      ))}

      <motion.div variants={itemVariants} className="mt-8 mb-4 px-1">
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-destructive/5 border border-destructive/20 py-4 text-sm font-bold text-destructive transition-all hover:bg-destructive shadow-sm hover:text-white group"
        >
          <LogOut className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          Log Out
        </button>
      </motion.div>

      {/* Footer Links */}
      <motion.div variants={itemVariants} className="mb-12 px-1">
        <div className="rounded-2xl border border-border bg-card/50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 text-center">Legal &amp; Policies</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigate("/terms", { state: { tab: "terms" } })}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/50 transition-colors group"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="flex-1 text-left text-xs font-semibold text-foreground">Terms &amp; Conditions</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
            </button>
            <button
              onClick={() => navigate("/terms", { state: { tab: "privacy" } })}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/50 transition-colors group"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="flex-1 text-left text-xs font-semibold text-foreground">Privacy Policy</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
            </button>
            <button
              onClick={() => navigate("/terms", { state: { tab: "terms", section: 2 } })}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/50 transition-colors group"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                <RefreshCcw className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="flex-1 text-left text-xs font-semibold text-foreground">Refund &amp; Cancellation Policy</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  const renderFavoritesView = () => (
    <motion.div
      key="favorites"
      variants={containerVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      className="px-4 sm:px-6 pt-4"
    >
      <div className="mb-6 flex items-center justify-between">
        <button 
          onClick={() => setActiveView("main")}
          className="flex items-center gap-2 text-sm font-bold text-primary hover:opacity-80 transition-opacity"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Profile
        </button>
      </div>

      <h3 className="mb-4 font-display text-xl font-bold text-foreground flex items-center gap-2">
        <Heart className="h-6 w-6 fill-red-500 text-red-500" />
        Favorite Salons
      </h3>

      {favoriteSalons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 rounded-full bg-muted/50 p-6">
            <Heart className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <h4 className="font-display text-lg font-bold text-foreground">No favorites yet</h4>
          <p className="mt-2 max-w-[240px] text-sm text-muted-foreground">
            Explore salons and click the heart icon to save them here.
          </p>
          <button 
            onClick={() => navigate("/")}
            className="mt-6 rounded-2xl bg-primary px-8 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-95"
          >
            Explore Salons
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 pb-20">
          {favoriteSalons.map((salon) => (
            <motion.div
              key={salon.id}
              layoutId={salon.id}
              className="group relative overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex gap-4 p-4">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl">
                  <img 
                    src={salon.salon_images?.[0] || "/assets/placeholder.jpg"} 
                    alt={salon.name} 
                    className="h-full w-full object-cover transition-transform group-hover:scale-110"
                  />
                  <div className="absolute top-1.5 left-1.5 rounded-lg bg-black/40 backdrop-blur-md p-1.5">
                    <Heart 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(salon.id);
                      }}
                      className="h-3.5 w-3.5 fill-red-500 text-red-500 cursor-pointer" 
                    />
                  </div>
                </div>
                
                <div className="flex flex-1 flex-col justify-between py-0.5">
                  <div>
                    <div className="flex items-start justify-between">
                      <h4 className="font-display text-base font-bold text-foreground line-clamp-1">
                        {salon.name}
                      </h4>
                      <div className="flex items-center gap-1 rounded-lg bg-primary/10 px-1.5 py-0.5 shrink-0">
                        <Star className="h-3 w-3 fill-primary text-primary" />
                        <span className="text-[10px] font-bold text-primary">{salon.rating || 0}</span>
                      </div>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="line-clamp-1">{salon.address || "Address not available"}</span>
                    </p>
                    {salon.categories?.[0] && (
                      <p className="mt-1 text-[11px] font-bold text-primary/80 uppercase tracking-wider">
                        {salon.categories[0]}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <button 
                      onClick={() => navigate(`/salon/${salon.id}`)}
                      className="flex-1 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground shadow-sm transition-all active:scale-95"
                    >
                      Book Now
                    </button>
                    <button 
                      onClick={() => {
                        let dest = encodeURIComponent(`${salon.name}, ${salon.address}`);
                        if (salon.latitude && salon.longitude) {
                           dest = `${salon.latitude},${salon.longitude}`;
                        }
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, "_blank");
                      }}
                      className="rounded-xl border border-border bg-muted/50 p-2 text-primary hover:bg-primary/10 transition-colors"
                      title="Get Directions"
                    >
                      <Navigation className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => navigate(`/salon/${salon.id}`)}
                      className="rounded-xl border border-border bg-muted/50 p-2 text-muted-foreground hover:text-foreground transition-colors"
                      title="View Details"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );


  const renderEditView = () => (
    <motion.div
      key="edit"
      variants={containerVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      className="px-4 sm:px-6 pt-4 pb-32"
    >
      <div className="mb-6 flex items-center justify-between">
        <button 
          onClick={() => setActiveView("main")}
          className="flex items-center gap-2 text-sm font-bold text-primary hover:opacity-80 transition-opacity"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Profile
        </button>
      </div>

      <h3 className="mb-6 font-display text-xl font-bold text-foreground flex items-center gap-2">
        <Settings className="h-6 w-6 text-primary" />
        Edit Profile
      </h3>

      <div className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-2xl border border-border bg-card px-5 py-4 text-sm font-medium text-foreground outline-none focus:border-primary transition-colors"
            placeholder="Your Name"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-border bg-card px-5 py-4 text-sm font-medium text-foreground outline-none focus:border-primary transition-colors"
            placeholder="email@example.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-2xl border border-border bg-card px-5 py-4 text-sm font-medium text-foreground outline-none focus:border-primary transition-colors"
            placeholder="+91 XXXXX XXXXX"
          />
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={isSaving}
          className="w-full mt-6 rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {isSaving ? "Saving Changes..." : "Save Changes"}
        </button>
      </div>
      
      <p className="mt-8 text-center text-[10px] text-muted-foreground px-10">
        Updating your profile information will reflect across all Rez1 services instantly.
      </p>
    </motion.div>
  );

  const renderHelpView = () => (
    <motion.div
      key="help"
      variants={containerVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      className="px-4 sm:px-6 pt-4 pb-32"
    >
      <div className="mb-6 flex items-center justify-between">
        <button 
          onClick={() => {
            setActiveView("main");
            setHelpSuccess(false);
            setHelpQuery("");
          }}
          className="flex items-center gap-2 text-sm font-bold text-primary hover:opacity-80 transition-opacity"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Profile
        </button>
      </div>

      <h3 className="mb-6 font-display text-xl font-bold text-foreground flex items-center gap-2">
        <HelpCircle className="h-6 w-6 text-primary" />
        Help Center
      </h3>

      {helpSuccess ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-4 rounded-full bg-green-500/10 p-6 flex items-center justify-center">
            <ShieldCheck className="h-10 w-10 text-green-500" />
          </div>
          <h4 className="font-display text-lg font-bold text-foreground">Query Sent!</h4>
          <p className="mt-2 text-sm text-muted-foreground">
            Our team will see your query and help you as soon as possible.
          </p>
          <button 
            onClick={() => {
              setActiveView("main");
              setHelpSuccess(false);
              setHelpQuery("");
            }}
            className="mt-6 rounded-2xl bg-primary px-8 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-95"
          >
            Back to Profile
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground mb-4">
            How can we help you today? Please confirm your details and describe your issue.
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Full Name</label>
            <input
              type="text"
              value={helpName}
              onChange={(e) => setHelpName(e.target.value)}
              className="w-full rounded-2xl border border-border bg-card px-5 py-4 text-sm font-medium text-foreground outline-none focus:border-primary transition-colors"
              placeholder="Your Name"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Email Address</label>
            <input
              type="email"
              value={helpEmail}
              onChange={(e) => setHelpEmail(e.target.value)}
              className="w-full rounded-2xl border border-border bg-card px-5 py-4 text-sm font-medium text-foreground outline-none focus:border-primary transition-colors"
              placeholder="email@example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Phone Number</label>
            <input
              type="tel"
              value={helpPhone}
              onChange={(e) => setHelpPhone(e.target.value)}
              className="w-full rounded-2xl border border-border bg-card px-5 py-4 text-sm font-medium text-foreground outline-none focus:border-primary transition-colors"
              placeholder="+91 XXXXX XXXXX"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Your Query</label>
            <textarea
              value={helpQuery}
              onChange={(e) => setHelpQuery(e.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-border bg-card px-5 py-4 text-sm font-medium text-foreground outline-none focus:border-primary transition-colors resize-none"
              placeholder="Type your query here..."
            />
          </div>

          <button
            onClick={async () => {
              if (!helpQuery.trim() || !helpName.trim() || !helpEmail.trim()) return;
              setIsSubmittingHelp(true);
              try {
                const { data, error } = await supabase.functions.invoke("send-support-email", {
                  body: {
                    name: helpName,
                    email: helpEmail,
                    phone: helpPhone,
                    message: helpQuery,
                    source: "customer_help_center"
                  }
                });
                if (error || !data?.success) throw new Error(data?.error || error?.message || "Failed to send");
                setHelpSuccess(true);
              } catch (err: any) {
                // Fallback: open mailto link with contact@rez1.in
                const subject = encodeURIComponent("Help Request from " + helpName);
                const body = encodeURIComponent(`Name: ${helpName}\nEmail: ${helpEmail}\nPhone: ${helpPhone}\n\nQuery:\n${helpQuery}`);
                window.location.href = `mailto:contact@rez1.in?subject=${subject}&body=${body}`;
                setHelpSuccess(true);
              } finally {
                setIsSubmittingHelp(false);
              }
            }}
            disabled={isSubmittingHelp || !helpQuery.trim() || !helpName.trim() || !helpEmail.trim()}
            className="w-full mt-6 rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isSubmittingHelp ? "Submitting..." : "Submit Query"}
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Or email us directly at{" "}
            <a href="mailto:contact@rez1.in" className="text-primary font-semibold">contact@rez1.in</a>
            {" "}or call{" "}
            <a href="tel:7338869230" className="text-primary font-semibold">7338869230</a>
          </p>
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="min-h-[100dvh] bg-background safe-bottom overflow-x-hidden">
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-md px-4 sm:px-6 py-3">
        <h2 className="font-display text-lg font-bold text-foreground">
          {activeView === "main" ? "Profile" : activeView === "favorites" ? "Favorites" : activeView === "help" ? "Help Center" : "Edit Profile"}
        </h2>
        <Logo size="sm" showText={false} />
      </div>

      <div className="mx-auto max-w-lg">
        <AnimatePresence mode="wait">
          {activeView === "main" && renderMainView()}
          {activeView === "favorites" && renderFavoritesView()}
          {activeView === "edit" && renderEditView()}
          {activeView === "help" && renderHelpView()}
        </AnimatePresence>
      </div>

      {/* Version Footer */}
      {activeView === "main" && (
        <p className="pb-12 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground opacity-30">
          Rez1 Salon Panel · Version 2.5.0
        </p>
      )}
    </div>
  );
};

export default ProfilePage;
