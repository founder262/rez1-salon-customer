import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, MapPin } from "lucide-react";
import BackButton from "@/components/BackButton";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabase";

type LocationItem = { id: string; name: string; salons_count: number };

const LocationPage = () => {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("locations")
      .select("id, name, salons_count")
      .eq("is_active", true)
      .order("salons_count", { ascending: false })
      .then(({ data }) => {
        setLocations(data || []);
        setLoading(false);
      });
  }, []);

  const handleSelectArea = async (loc: LocationItem) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("customers")
        .update({ preferred_location_id: loc.id })
        .eq("id", user.id);
    }
    localStorage.setItem("rez1_location_id", loc.id);
    localStorage.setItem("rez1_location_name", loc.name);
    navigate("/home");
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background px-6 py-4">
      <BackButton />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto mt-12 w-full max-w-sm"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <Logo size="lg" showText={false} />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Where are you?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select your area to find salons near you
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pb-8">
          {loading ? (
            <div className="col-span-2 flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading areas...
            </div>
          ) : locations.length === 0 ? (
            <div className="col-span-2 text-center py-8 text-sm text-muted-foreground">
              No service areas available yet.
            </div>
          ) : (
            locations.map((area) => (
              <button
                key={area.id}
                onClick={() => handleSelectArea(area)}
                className="group rounded-2xl border border-border bg-card px-4 py-3.5 text-left transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.97]"
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <MapPin className="h-3 w-3 text-primary shrink-0" />
                  <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                    {area.name}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {area.salons_count} salon{area.salons_count !== 1 ? "s" : ""}
                </span>
              </button>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default LocationPage;
