interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: { box: "h-8 w-8", text: "text-lg" },
  md: { box: "h-12 w-12", text: "text-2xl" },
  lg: { box: "h-20 w-20", text: "text-4xl" },
};

const Logo = ({ size = "sm", showText = true, className = "" }: LogoProps) => {
  const s = sizes[size];
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`relative flex items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/5 flex-shrink-0 ${s.box}`}>
        <img 
          src="/rez1-logo.svg" 
          alt="REZ1 Logo" 
          className="h-full w-full object-contain p-1.5"
          onError={(e) => {
            // Fallback if SVG fails for some reason
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
      {showText && (
        <div className="flex flex-col -gap-1">
          <span className={`font-display font-black tracking-[0.15em] text-white leading-tight ${s.text}`}>
            REZ1
          </span>
          <span className="text-[8px] sm:text-[10px] tracking-[0.3em] font-medium text-[#B8860B] uppercase">
            Customer Panel
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;

