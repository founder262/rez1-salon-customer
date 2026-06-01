import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BackButtonProps {
  label?: string;
}

const BackButton = ({ label }: BackButtonProps) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(-1)}
      className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="h-5 w-5" />
      {label && <span className="text-sm font-medium">{label}</span>}
    </button>
  );
};

export default BackButton;
