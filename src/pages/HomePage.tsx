import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, Clock, MapPin, Search, Heart, Bell, Store, Navigation } from "lucide-react";
import { useFavorites } from "@/contexts/FavoritesContext";
import { parseTimeStr } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";
import PromoBanner from "@/components/PromoBanner";
import SearchOverlay from "@/components/SearchOverlay";
import { supabase } from "@/lib/supabase";

type SearchMode = "salon" | "location";
type SalonCategory = "Men" | "Women" | "Unisex" | "Pets" | "Bridal";
type CategoryFilter = "All" | SalonCategory;

const HomePage = () => {
  const navigate = useNavigate();
  const [salons, setSalons] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [searchMode, setSearchMode] = useState<SearchMode>("salon");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("All");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { toggleFavorite, isFavorite } = useFavorites();
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [selectedLocationName, setSelectedLocationName] = useState("");



  // Load location from customer profile
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let locId = localStorage.getItem("rez1_location_id") || "";
      let locName = localStorage.getItem("rez1_location_name") || "";

      if (user) {
        const { data: customer, error: customerErr } = await supabase
          .from("customers")
          .select("preferred_location_id, full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (!customerErr) {
          if (customer && !customer.full_name) {
            navigate("/profile-setup");
            return;
          }

          // Use DB preferred location if set, otherwise fall back to localStorage
          const candidateId = customer?.preferred_location_id || locId;

          if (candidateId) {
            // ✅ Validate: check this location actually exists in the locations table
            const { data: locationData } = await supabase
              .from("locations")
              .select("id, name")
              .eq("id", candidateId)
              .eq("is_active", true)
              .maybeSingle();

            if (locationData) {
              // Location is valid — use it
              locId = locationData.id;
              locName = locationData.name;
              localStorage.setItem("rez1_location_id", locId);
              localStorage.setItem("rez1_location_name", locName);
            } else {
              // Location no longer exists in DB — clear stale data everywhere
              locId = "";
              locName = "";
              localStorage.removeItem("rez1_location_id");
              localStorage.removeItem("rez1_location_name");
              // Also clear from customer DB record so it doesn't keep being read
              if (user && customer?.preferred_location_id) {
                await supabase
                  .from("customers")
                  .update({ preferred_location_id: null })
                  .eq("id", user.id);
              }
            }
          }
        } else {
          console.warn("Could not fetch customer profile, falling back to localStorage:", customerErr.message);
          // Even for localStorage fallback, validate the ID
          if (locId) {
            const { data: locationData } = await supabase
              .from("locations")
              .select("id, name")
              .eq("id", locId)
              .eq("is_active", true)
              .maybeSingle();
            if (!locationData) {
              locId = "";
              locName = "";
              localStorage.removeItem("rez1_location_id");
              localStorage.removeItem("rez1_location_name");
            }
          }
        }
      }

      // Show all salons if no valid location found
      setSelectedLocationId(locId);
      setSelectedLocationName(locName);
    };
    init();
  }, []);

  const fetchSalons = async () => {
    let q = supabase
      .from("salons")
      .select("id, name, salon_images, categories, rating, review_count, address, open_time, close_time, is_open, is_emergency_mode, subscription, salon_offers(*), services(id, name, price, duration)")
      .eq("is_suspended", false)
      .eq("is_visible", true)
      .eq("is_approved", true)
      .order("rating", { ascending: false });

    // If searching by salon name, do NOT filter by location
    if (query && searchMode === "salon") {
      q = q.ilike("name", `%${query}%`);
    } else if (selectedLocationId) {
      // Only filter by location if one is selected
      q = q.eq("location_id", selectedLocationId);
    }
    // If no location selected, show all salons

    if (categoryFilter !== "All") q = q.contains("categories", [categoryFilter]);

    const { data, error } = await q;
    if (error) console.error("fetchSalons error:", error);
    setSalons(data || []);
  };

  const fetchBanners = async () => {
    const now = new Date();
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const { data } = await supabase
      .from("promo_banners")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    const validBanners = (data || []).filter((b: any) => !b.end_date || b.end_date >= today);
    setBanners(validBanners);
  };

  // Fetch salons whenever location / filters change
  useEffect(() => {
    fetchSalons();
  }, [selectedLocationId, categoryFilter, query, searchMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch banners once on mount (they don't depend on location/filters)
  useEffect(() => {
    fetchBanners();
  }, []);

  // Real-time listener for services changes to update salon lists dynamically
  useEffect(() => {
    const channel = supabase
      .channel('home-services-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, () => {
        if (selectedLocationId) fetchSalons();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedLocationId, categoryFilter, query, searchMode]);

  return (
    <div className="min-h-[100dvh] bg-background safe-bottom">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="rounded-xl border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate("/notifications")}
              className="relative rounded-xl border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <div className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        searchMode={searchMode}
        setSearchMode={setSearchMode}
        query={query}
        setQuery={setQuery}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-4 pb-32">
        {/* Advertisement Banner */}
        <PromoBanner banners={banners} />

        {/* Selected Area Indicator */}
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Showing salons in & around</p>
              <p className="text-sm font-bold text-foreground">
                {selectedLocationName || "All Areas"}
              </p>
            </div>
          </div>
          <button 
            onClick={() => navigate("/location")}
            className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            {selectedLocationName ? "Change" : "Set Location"}
          </button>
        </div>

        {/* Category Filter */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {(["All", "Men", "Women", "Unisex", "Pets", "Bridal"] as CategoryFilter[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                categoryFilter === cat
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results info */}
        {query && (
          <p className="mb-3 text-xs text-muted-foreground">
            {salons.length} salon{salons.length !== 1 ? "s" : ""} found
          </p>
        )}

        {/* Salon List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
          {salons.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 rounded-full bg-muted/50 p-6">
                <Store className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <h4 className="font-display text-lg font-bold text-foreground">No salons found</h4>
              <p className="mt-2 max-w-[240px] text-sm text-muted-foreground">
                {categoryFilter !== "All"
                  ? `No ${categoryFilter} salons available in this area yet.`
                  : "No salons are currently available in this area."}
              </p>
              {categoryFilter !== "All" && (
                <button
                  onClick={() => setCategoryFilter("All")}
                  className="mt-4 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground"
                >
                  Show All Categories
                </button>
              )}
            </div>
          ) : (
            salons.map((salon: any, i) => {
            const getOfferPercent = (offer: any) => {
              if (!offer) return 0;
              const type = offer.active_type;
              if (!type || type === 'none') return 0;
              if (type === 'all_days') return offer.all_days_percentage || 0;
              if (type === 'weekday_weekend') {
                const day = new Date().getDay();
                const isWeekend = day === 0 || day === 6;
                return isWeekend ? (offer.weekend_percentage || 0) : (offer.weekday_percentage || 0);
              }
              if (type === 'specific_day') {
                const todayStr = new Date().toISOString().split('T')[0];
                if (offer.specific_day_date === todayStr) return offer.specific_day_percentage || 0;
              }
              return 0;
            };
            const offerPercent = getOfferPercent(salon.salon_offers?.[0]);
            const priceRange = salon.services?.[0]?.price ? `From ₹${salon.services[0].price}` : "Prices vary";
            const isClosed = salon.is_booking_paused === true || salon.is_emergency_mode === true;
            
            let nextAvailable = salon.is_emergency_mode ? "Temporarily Closed" : "Currently Closed";
            if (!isClosed) {
              const now = new Date();
              const currentMins = now.getHours() * 60 + now.getMinutes();
              const closeMins = parseTimeStr(salon.close_time || "08:00 PM");
              const openMins = parseTimeStr(salon.open_time || "10:00 AM");

              if (currentMins >= closeMins - 30) {
                // Too late for today
                nextAvailable = `Next: Tomorrow ${salon.open_time || "10:00 AM"}`;
              } else if (currentMins < openMins) {
                // Before opening time today
                nextAvailable = `Next: Today ${salon.open_time || "10:00 AM"}`;
              } else {
                // Currently open, calculate the next upcoming 30-minute slot
                const remainder = currentMins % 30;
                const nextSlotMins = currentMins + (30 - remainder);
                
                if (nextSlotMins > closeMins - 30) {
                  nextAvailable = `Next: Tomorrow ${salon.open_time || "10:00 AM"}`;
                } else {
                  const h = Math.floor(nextSlotMins / 60) % 24;
                  const m = nextSlotMins % 60;
                  const hour12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
                  const ampm = h >= 12 ? "PM" : "AM";
                  nextAvailable = `Next: Today ${hour12.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${ampm}`;
                }
              }
            }

            return (
              <motion.div
                key={salon.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                onClick={() => navigate(`/salon/${salon.id}`)}
                className="cursor-pointer overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-elevated active:scale-[0.99]"
              >
                <div className="relative">
                  <img
                    src={salon.salon_images?.[0] || "/assets/placeholder.jpg"}
                    alt={salon.name}
                    className="h-44 w-full object-cover"
                    loading="lazy"
                  />
                  {/* Favorite Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(salon.id);
                    }}
                    className="absolute top-3 left-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/20 backdrop-blur-md transition-all hover:bg-black/40 active:scale-90"
                  >
                    <Heart
                      className={`h-4 w-4 transition-colors ${
                        isFavorite(salon.id)
                          ? "fill-red-500 text-red-500"
                          : "text-white"
                      }`}
                    />
                  </button>
                  {/* Offer Badge */}
                  {offerPercent > 0 && !isClosed && (
                    <div className="absolute top-3 right-3 rounded-lg bg-[#e31837] px-2.5 py-1 shadow-lg shadow-black/20">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white">
                        {offerPercent}% OFF
                      </span>
                    </div>
                  )}
                  {/* Closed Badge */}
                  {isClosed && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[2px]">
                      <div className="rounded-xl bg-destructive px-3 py-1.5 shadow-lg shadow-black/20">
                        <span className="text-xs font-bold uppercase tracking-wider text-destructive-foreground">
                          {salon.is_emergency_mode ? "Temporarily Closed" : "Closed"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className={`p-4 ${isClosed ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between">
                    <h3 className="font-display text-base font-semibold text-card-foreground">
                      {salon.name}
                    </h3>
                    <div className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5">
                      <Star className="h-3 w-3 fill-primary text-primary" />
                      <span className="text-xs font-semibold text-primary">{salon.rating}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 min-w-0">
                      <MapPin className="h-3 w-3 shrink-0" />
                       <span className="truncate max-w-[120px]">
                         {salon.address || "Nearby"}
                       </span>
                    </span>
                    <span className={`flex items-center gap-1 ${isClosed ? "text-destructive" : ""}`}>
                      <Clock className="h-3 w-3" />
                      {nextAvailable}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">
                      {priceRange}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const dest = encodeURIComponent(`${salon.name}, ${salon.address}`);
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, "_blank");
                      }}
                      className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/20"
                    >
                      <Navigation className="h-3 w-3" />
                      Directions
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          }))
          }
        </div>
      </div>
    </div>
  );
};

export default HomePage;
