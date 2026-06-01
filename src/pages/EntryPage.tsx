import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import SplashScreen from "@/components/SplashScreen";

const EntryPage = () => {
  const navigate = useNavigate();
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
    // Automatically navigate to login after intro sequence
    navigate("/login");
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#050505]">
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
    </div>
  );
};

export default EntryPage;
