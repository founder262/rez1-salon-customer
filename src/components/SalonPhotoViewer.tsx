import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

interface SalonPhotoViewerProps {
  images: string[];
  salonName: string;
  onClose: () => void;
}

const SalonPhotoViewer = ({ images, salonName, onClose }: SalonPhotoViewerProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-background overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur-md px-4 py-3">
        <button onClick={onClose} className="rounded-full p-1 hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{salonName}</h2>
          <p className="text-xs text-muted-foreground">{images.length} photos</p>
        </div>
      </div>

      {/* Photos grid */}
      <div className="mx-auto max-w-3xl px-0 md:px-4 py-2 md:py-4 space-y-1 md:space-y-3">
        {images.map((img, i) => (
          <img
            key={i}
            src={img}
            alt={`${salonName} photo ${i + 1}`}
            className="w-full object-cover md:rounded-lg"
            loading="lazy"
          />
        ))}
      </div>
    </motion.div>
  );
};

export default SalonPhotoViewer;
