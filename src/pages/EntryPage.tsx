import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SplashScreen from "@/components/SplashScreen";
import { supabase } from "@/lib/supabase";

const EntryPage = () => {
  const navigate = useNavigate();
  const [showSplash, setShowSplash] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);

  // On mount: if user already has a valid session, check profile completeness
  useEffect(() => {
    let routed = false; // prevent double routing

    const checkAndRoute = async (userId: string, userEmail?: string | null) => {
      if (routed) return;
      routed = true;
      // Check if customer profile is complete
      const { data: customer } = await supabase
        .from("customers")
        .select("id, full_name, preferred_location_id")
        .eq("id", userId)
        .maybeSingle();

      if (!customer || !customer.full_name) {
        // New user (e.g. Google OAuth) — ensure a row exists then go to setup
        if (!customer) {
          await supabase.from("customers").upsert(
            { id: userId, email: userEmail },
            { onConflict: "id" }
          );
        }
        navigate("/profile-setup", { replace: true });
      } else if (!customer.preferred_location_id) {
        navigate("/location", { replace: true });
      } else {
        navigate("/home", { replace: true });
      }
    };

    // Listen for auth state changes — catches Google OAuth callback token
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        await checkAndRoute(session.user.id, session.user.email);
      }
    });

    // Also check existing session immediately (for users who are already logged in)
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error) {
        console.error("Auth check error in EntryPage:", error);
        if (error.message?.includes("Invalid Refresh Token") || error.message?.includes("Refresh Token Not Found") || error.status === 400) {
          await supabase.auth.signOut().catch(() => {});
        }
      }
      if (data?.session) {
        await checkAndRoute(data.session.user.id, data.session.user.email);
      } else {
        setSessionChecked(true);
      }
    }).catch(() => {
      setSessionChecked(true);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
    // Automatically navigate to login after intro sequence
    navigate("/login");
  }, [navigate]);

  if (!sessionChecked) return null; // Wait for session check before showing splash

  return (
    <div className="min-h-screen bg-[#050505]">
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
    </div>
  );
};

export default EntryPage;
