import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Grid3x3 } from "lucide-react";
import SalonPhotoViewer from "./SalonPhotoViewer";

interface SalonImageGalleryProps {
  images: string[];
  salonName: string;
}

const SalonImageGallery = ({ images, salonName }: SalonImageGalleryProps) => {
  const [showAll, setShowAll] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0); 
  const [isPaused, setIsPaused] = useState(false);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);

  const nextSlide = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const prevSlide = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const handleManualInteraction = (type: "next" | "prev" | "dot") => {
    setAutoPlayEnabled(false);
    if (type === "next") nextSlide();
    else if (type === "prev") prevSlide();
  };

  useEffect(() => {
    if (isPaused || !autoPlayEnabled || images.length <= 1) return;

    const timer = setInterval(() => {
      nextSlide();
    }, 4000);
    return () => clearInterval(timer);
  }, [nextSlide, isPaused, autoPlayEnabled, images.length]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? "100%" : "-100%",
      opacity: 0,
      scale: 1.05
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.4 },
        scale: { duration: 0.6 }
      }
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? "100%" : "-100%",
      opacity: 0,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.4 }
      }
    })
  };

  return (
    <div className="relative overflow-hidden group">
      <div 
        className="relative aspect-video w-full overflow-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0 h-full w-full"
          >
            <img 
              src={images[currentIndex]} 
              alt={`${salonName} ${currentIndex + 1}`} 
              className="h-full w-full object-cover select-none"
              draggable="false"
            />
            {/* Subtle Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); handleManualInteraction("prev"); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-md opacity-0 transition-all hover:bg-black/40 group-hover:opacity-100 active:scale-90"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleManualInteraction("next"); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-md opacity-0 transition-all hover:bg-black/40 group-hover:opacity-100 active:scale-90"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Progress Dots */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setDirection(index > currentIndex ? 1 : -1);
                  setCurrentIndex(index);
                  setAutoPlayEnabled(false);
                }}
                className={`h-1.5 rounded-full transition-all ${
                  currentIndex === index 
                    ? "w-6 bg-primary shadow-lg shadow-primary/40" 
                    : "w-1.5 bg-white/40 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        )}

        {/* View all photos button */}
        <button
          onClick={() => setShowAll(true)}
          className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 rounded-xl bg-background/90 backdrop-blur-sm px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-foreground shadow-lg transition-all active:scale-95 hover:bg-background"
        >
          <Grid3x3 className="h-3.5 w-3.5" />
          {images.length} Photos
        </button>
      </div>

      {showAll && (
        <SalonPhotoViewer
          images={images}
          salonName={salonName}
          onClose={() => setShowAll(false)}
        />
      )}
    </div>
  );
};

export default SalonImageGallery;
