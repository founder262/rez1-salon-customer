import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Scissors, Sparkles } from "lucide-react";

interface Banner {
  id: string | number;
  title: string;
  subtitle?: string;
  // DB fields from promo_banners
  media_url?: string;
  media_type?: "image" | "video";
  redirect_type?: string;
  redirect_value?: string;
  // Legacy / Rez1 branded slide fields
  image_url?: string;
  image?: string;
  accent?: string;
  color?: string;
  action_url?: string;
  isRez1?: boolean; // internal flag
}

interface PromoBannerProps {
  banners: Banner[];
}

// ── REZ1 branded first slide (no external image needed) ──────────────────────
const REZ1_BANNER: Banner = {
  id: "rez1-brand",
  isRez1: true,
  title: "Your City. Your Style. REZ1.",
  subtitle: "Book top-rated salons near you — anytime, anywhere.",
  accent: "REZ1 Official",
};

const PromoBanner = ({ banners }: PromoBannerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // REZ1 banner always first, owner banners after
  const activeBanners: Banner[] = [
    REZ1_BANNER,
    ...(banners && banners.length > 0 ? banners : []),
  ];

  const nextSlide = useCallback(() => {
    if (activeBanners.length <= 1) return;
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % activeBanners.length);
  }, [activeBanners.length]);

  const prevSlide = useCallback(() => {
    if (activeBanners.length <= 1) return;
    setDirection(-1);
    setCurrentIndex(
      (prev) => (prev - 1 + activeBanners.length) % activeBanners.length
    );
  }, [activeBanners.length]);

  useEffect(() => {
    if (isPaused || activeBanners.length <= 1) return;
    const timer = setInterval(nextSlide, 4500);
    return () => clearInterval(timer);
  }, [nextSlide, isPaused, activeBanners.length]);

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? "100%" : "-100%",
      opacity: 0,
      scale: 1.06,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: "spring", stiffness: 280, damping: 28 },
        opacity: { duration: 0.35 },
        scale: { duration: 0.5 },
      },
    },
    exit: (dir: number) => ({
      zIndex: 0,
      x: dir < 0 ? "100%" : "-100%",
      opacity: 0,
      transition: {
        x: { type: "spring", stiffness: 280, damping: 28 },
        opacity: { duration: 0.3 },
      },
    }),
  };

  const currentAd = activeBanners[currentIndex];

  return (
    <div
      className="relative mb-8 overflow-hidden rounded-[2.5rem] bg-card shadow-premium mt-2 group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={currentAd.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0 h-full w-full"
          >
            {/* ── REZ1 Branded Slide ───────────────────────────────────── */}
            {currentAd.isRez1 ? (
              <div className="relative h-full w-full overflow-hidden bg-[#0a0a0a]">
                {/* Animated gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-600/30 via-amber-500/10 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-tr from-black via-black/80 to-amber-900/40" />

                {/* Decorative blobs */}
                <div
                  className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-amber-500/20 blur-3xl"
                  style={{ animation: "pulse 4s ease-in-out infinite" }}
                />
                <div
                  className="absolute bottom-0 left-10 h-36 w-36 rounded-full bg-amber-400/10 blur-2xl"
                  style={{ animation: "pulse 5s ease-in-out infinite 1s" }}
                />

                {/* Scissor watermark */}
                <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-[0.07]">
                  <Scissors className="h-36 w-36 sm:h-48 sm:w-48 text-amber-400 rotate-45" />
                </div>

                {/* Grid pattern */}
                <div
                  className="absolute inset-0 opacity-[0.04]"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(251,191,36,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.6) 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                  }}
                />

                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-center p-6 sm:p-10">
                  {/* Badge */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="mb-3 flex items-center gap-2"
                  >
                    <div className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-amber-500/20 backdrop-blur-sm">
                      <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-amber-400" />
                    </div>
                    <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.22em] text-amber-400">
                      REZ1 Official
                    </span>
                  </motion.div>

                  {/* Logo wordmark */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25, type: "spring", stiffness: 200 }}
                    className="mb-2"
                  >
                    <span
                      className="text-4xl sm:text-6xl font-black tracking-tight text-white"
                      style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                      REZ
                      <span className="text-amber-400">1</span>
                    </span>
                  </motion.div>

                  {/* Tagline */}
                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="font-display text-base sm:text-xl md:text-2xl font-bold leading-snug text-white/90 max-w-[240px] sm:max-w-xs"
                  >
                    {currentAd.title}
                  </motion.h2>

                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="mt-1 sm:mt-2 text-[10px] sm:text-xs text-white/50 max-w-[180px] sm:max-w-[260px]"
                  >
                    {currentAd.subtitle}
                  </motion.p>

                  {/* CTA */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.55 }}
                    className="mt-4 sm:mt-6"
                  >
                    <button 
                      onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                      className="rounded-full bg-amber-500 px-5 sm:px-7 py-2 sm:py-2.5 text-[10px] sm:text-xs font-bold text-black shadow-lg shadow-amber-500/30 transition-transform active:scale-95"
                    >
                      Explore Salons
                    </button>
                  </motion.div>
                </div>
              </div>
            ) : (
              /* ── Owner-uploaded banner slide ──────────────────────────── */
              <>
                {/* Media: image or video */}
                {currentAd.media_type === "video" ? (
                  <video
                    key={currentAd.media_url}
                    src={currentAd.media_url}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="h-full w-full object-cover select-none"
                  />
                ) : (
                  <img
                    src={currentAd.media_url || currentAd.image_url || currentAd.image}
                    alt={currentAd.title}
                    className="h-full w-full object-cover select-none"
                    draggable="false"
                  />
                )}

                {/* Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div
                  className={`absolute inset-0 bg-gradient-to-r ${
                    currentAd.color || "from-amber-500/20"
                  } via-black/20 to-transparent`}
                />

                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-8">
                  {currentAd.accent && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="flex items-center gap-2 mb-1 sm:mb-2"
                    >
                      <div className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-primary/20 backdrop-blur-sm">
                        <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary" />
                      </div>
                      <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                        {currentAd.accent}
                      </span>
                    </motion.div>
                  )}

                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="font-display text-lg font-bold leading-tight text-white sm:text-2xl md:text-3xl"
                  >
                    {currentAd.title}
                  </motion.h2>

                  {currentAd.subtitle && (
                    <motion.p
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="mt-1 sm:mt-2 text-[10px] sm:text-xs text-white/70 max-w-[180px] sm:max-w-[280px] line-clamp-2"
                    >
                      {currentAd.subtitle}
                    </motion.p>
                  )}

                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-4 sm:mt-6 flex items-center gap-3 sm:gap-4"
                  >
                    <button
                      onClick={() => {
                        const targetUrl = currentAd.action_url || currentAd.redirect_value;
                        if (targetUrl) {
                          if (targetUrl.startsWith('http')) {
                            window.location.href = targetUrl;
                          } else {
                            window.location.href = `https://${targetUrl}`;
                          }
                        }
                      }}
                      className="rounded-full bg-primary px-4 sm:px-6 py-2 sm:py-2.5 text-[10px] sm:text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-95"
                    >
                      Explore More
                    </button>
                  </motion.div>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        {activeBanners.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsPaused(true);
                prevSlide();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-md opacity-0 transition-all hover:bg-black/40 group-hover:opacity-100 active:scale-90"
            >
              <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsPaused(true);
                nextSlide();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-md opacity-0 transition-all hover:bg-black/40 group-hover:opacity-100 active:scale-90"
            >
              <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </>
        )}

        {/* Progress Dots */}
        {activeBanners.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 sm:gap-2">
            {activeBanners.map((b, index) => (
              <button
                key={b.id}
                onClick={() => {
                  setDirection(index > currentIndex ? 1 : -1);
                  setCurrentIndex(index);
                  setIsPaused(true);
                }}
                className={`h-1.5 rounded-full transition-all ${
                  currentIndex === index
                    ? index === 0
                      ? "w-6 sm:w-8 bg-amber-400 shadow-lg shadow-amber-400/40"
                      : "w-6 sm:w-8 bg-primary shadow-lg shadow-primary/40"
                    : "w-1.5 sm:w-2 bg-white/40 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PromoBanner;
