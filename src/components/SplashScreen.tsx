import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
  onComplete: () => void;
}

const GoldDust = ({ count = 20 }) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full z-0"
          style={{
            width: Math.random() * 3 + 1,
            height: Math.random() * 3 + 1,
            background: "linear-gradient(135deg, #F5D07A, #B8860B)",
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -100],
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
          }}
          transition={{
            duration: Math.random() * 3 + 2,
            repeat: Infinity,
            delay: Math.random() * 2,
          }}
        />
      ))}
    </div>
  );
};

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [phase, setPhase] = useState<"logo" | "exit">("logo");

  useEffect(() => {
    // Show logo briefly, then trigger exit animation
    const timers = [
      setTimeout(() => setPhase("exit"), 2000),      // Exit animation start
      setTimeout(() => onComplete(), 2800),          // Done
    ];

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[9999] bg-[#050505] flex items-center justify-center overflow-hidden">
      <GoldDust count={30} />
      
      {/* Background Subtle Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(184,134,11,0.08)_0%,transparent_60%)] pointer-events-none" />

      <AnimatePresence>
        {/* REZ1 Logo Display */}
        {phase === "logo" && (
          <motion.div
            key="logo-container"
            initial={{ opacity: 0, scale: 0.9, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col items-center gap-4 z-10 w-full px-4"
          >
            <div className="flex flex-col items-center gap-6 md:gap-8">
              <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
                className="w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-[2rem] bg-[#B8860B]/10 backdrop-blur-md border border-[#B8860B]/20 p-5 shadow-[0_0_50px_rgba(184,134,11,0.15)] flex items-center justify-center"
              >
                <img 
                  src="/rez1-logo.svg" 
                  alt="REZ1" 
                  className="w-full h-full object-contain filter drop-shadow-[0_0_15px_rgba(184,134,11,0.4)]" 
                />
              </motion.div>
              <motion.h1 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.7 }}
                className="text-5xl sm:text-6xl md:text-7xl font-black tracking-[0.3em] text-white uppercase text-center drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]"
              >
                REZ1
              </motion.h1>
            </div>
            
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "min(140px, 40vw)" }}
              transition={{ delay: 0.6, duration: 0.8, ease: "easeInOut" }}
              className="h-[2px] bg-gradient-to-r from-transparent via-[#B8860B] to-transparent mt-2"
            />
            
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="text-xs sm:text-sm tracking-[0.5em] md:tracking-[0.6em] text-[#888] uppercase mt-2 font-medium text-center"
            >
              Excellence in Grooming
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SplashScreen;
