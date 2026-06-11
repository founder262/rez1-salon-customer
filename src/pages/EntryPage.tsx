import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SplashScreen from "@/components/SplashScreen";
import { supabase } from "@/lib/supabase";

const EntryPage = () => {
  const navigate = useNavigate();
  const [showSplash, setShowSplash] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);

  // On mount: if user already has a valid session, skip splash and go home
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate("/home", { replace: true });
      } else {
        setSessionChecked(true);
      }
    });
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
