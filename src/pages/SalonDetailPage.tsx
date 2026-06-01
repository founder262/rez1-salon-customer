import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, MapPin, Navigation, Check, Users, Minus, Plus, Heart } from "lucide-react";
import { useFavorites } from "@/contexts/FavoritesContext";
import BackButton from "@/components/BackButton";
import Logo from "@/components/Logo";
import SalonImageGallery from "@/components/SalonImageGallery";
import SalonReviews from "@/components/SalonReviews";
import { supabase } from "@/lib/supabase";

const SalonDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [salon, setSalon] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const { toggleFavorite, isFavorite } = useFavorites();
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [personCount, setPersonCount] = useState(1);

  const fetchSalonDetail = async (salonId: string) => {
    // Fetch salon core data + services separately to avoid RLS join issues
    const { data: salonData } = await supabase
      .from("salons")
      .select("*, services(*)")
      .eq("id", salonId)
      .single();

    // Fetch offers separately
    const { data: offersData } = await supabase
      .from("salon_offers")
      .select("*")
      .eq("salon_id", salonId);

    // Fetch reviews separately with customer name
    const { data: reviewsData } = await supabase
      .from("reviews")
      .select("*, customers(full_name)")
      .eq("salon_id", salonId)
      .order("created_at", { ascending: false });

    setSalon({ ...salonData, salon_offers: offersData || [], reviews: reviewsData || [] });
    setLoading(false);
  };

  useEffect(() => {
    if (id) fetchSalonDetail(id);
  }, [id]);

  const toggleService = (serviceId: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId)
        ? prev.filter((s) => s !== serviceId)
        : [...prev, serviceId]
    );
  };

  // Robust offer calculation — works even if active_type is null (legacy rows)
  const getOfferPercent = (offer: any): number => {
    if (!offer) return 0;
    const type = offer.active_type;
    // Explicitly return 0 if offer is disabled
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

  const selectedDetails = useMemo(() => {
    const services = salon?.services?.filter((s: any) =>
      selectedServices.includes(s.id)
    ) || [];
    const totalPrice = services.reduce((sum: number, s: any) => sum + s.price, 0) * personCount;
    const pct = getOfferPercent(salon?.salon_offers?.[0]);
    const discountedPrice = salon ? Math.round(totalPrice * (1 - pct / 100)) : totalPrice;
    return {
      services,
      totalPrice,
      discountedPrice,
      offerPercent: pct,
      totalDuration: services.reduce((sum: number, s: any) => sum + (Number(s.duration) || 0), 0) * personCount,
    };
  }, [selectedServices, salon, personCount]);

  if (loading) return <div className="p-4 text-foreground">Loading...</div>;
  if (!salon) return <div className="p-4 text-foreground">Salon not found</div>;

  const offer = salon?.salon_offers?.[0];
  const offerPercent = getOfferPercent(offer);
  const amenities = salon?.amenities || [];
  const tags = salon?.categories || (salon?.category ? [salon.category] : []);

  return (
    <div className="min-h-[100dvh] bg-background pb-28">
      {/* Header */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="flex items-center gap-3">
          <BackButton />
          <h2 className="font-display text-base font-semibold text-foreground">
            {salon.name}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <Logo size="sm" showText={false} />
          {salon && (
            <button
              onClick={() => toggleFavorite(salon.id)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card transition-all active:scale-90"
            >
              <Heart
                className={`h-4 w-4 transition-colors ${
                  isFavorite(salon.id)
                    ? "fill-red-500 text-red-500"
                    : "text-muted-foreground"
                }`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Image Gallery */}
      <SalonImageGallery images={salon.salon_images || []} salonName={salon.name} />

      <div className="mx-auto max-w-lg px-4 sm:px-6 pt-4">
        {/* Salon Info */}
        <div className="mb-4">
          <h1 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
            {salon.name}
            {(salon.is_open === false || salon.is_booking_paused === true) && (
              <span className="rounded-md bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive-foreground">
                Closed
              </span>
            )}
          </h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {salon.address}
            </span>
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-primary text-primary" />
              {salon.rating || 0} ({salon.review_count || 0})
            </span>
          </div>
        </div>

        {/* Offer Banner */}
        {offerPercent > 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#e31837]/10 to-primary/10 border border-[#e31837]/20 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e31837] text-white text-base font-black">
              %
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">{offerPercent}% OFF on all services!</p>
              <p className="text-xs text-muted-foreground">
                {offer?.active_type === 'all_days' && 'Valid every day'}
                {offer?.active_type === 'weekday_weekend' && 'Weekday & weekend discount'}
                {offer?.active_type === 'specific_day' && `Valid on ${offer?.specific_day_date}`}
              </p>
            </div>
          </div>
        )}

        {/* Get Directions */}
        <button 
          onClick={() => {
            let dest = encodeURIComponent(`${salon.name}, ${salon.address}`);
            if (salon.latitude && salon.longitude) {
               dest = `${salon.latitude},${salon.longitude}`;
            }
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, "_blank");
          }}
          className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary"
        >
          <Navigation className="h-4 w-4 text-primary" />
          Get Directions
        </button>

        {/* Tags */}
        <div className="mb-6 flex flex-wrap gap-2">
          {tags.map((tag: string) => (
            <span
              key={tag}
              className="rounded-lg bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Number of Persons */}
        <div className="mb-6 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">Number of Persons</h3>
                <p className="text-xs text-muted-foreground">Same services for each person</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPersonCount((p) => Math.max(1, p - 1))}
                disabled={personCount <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-6 text-center text-base font-bold text-foreground">{personCount}</span>
              <button
                onClick={() => setPersonCount((p) => Math.min(10, p + 1))}
                disabled={personCount >= 10}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          {personCount > 1 && selectedServices.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              ₹{selectedDetails.totalPrice / personCount} × {personCount} persons = ₹{selectedDetails.totalPrice}
            </p>
          )}
        </div>

        {/* Services */}
        <div className="mb-6">
          <h3 className="mb-3 font-display text-sm font-semibold text-foreground">
            Services
          </h3>
          <div className="max-h-[40vh] overflow-y-auto rounded-2xl pr-1 scrollbar-thin">
            <div className="flex flex-col gap-2">
              {salon.services?.map((service: any) => {
                const selected = selectedServices.includes(service.id);
                return (
                  <button
                    key={service.id}
                    onClick={() => toggleService(service.id)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition-all ${
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
                          selected
                            ? "border-primary bg-primary"
                            : "border-border"
                        }`}
                      >
                        {selected && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">
                          {service.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {service.duration || 0} min
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {offerPercent > 0 ? (
                        <>
                          <p className="text-xs text-muted-foreground line-through">₹{service.price}</p>
                          <p className="text-sm font-bold text-[#e31837]">₹{Math.round(service.price * (1 - offerPercent / 100))}</p>
                        </>
                      ) : (
                        <span className="text-sm font-semibold text-foreground">₹{service.price}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Amenities */}
        <div className="mb-6">
          <h3 className="mb-3 font-display text-sm font-semibold text-foreground">
            Amenities
          </h3>
          <div className="flex flex-wrap gap-2">
            {amenities.map((a: string) => (
              <span
                key={a}
                className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
              >
                {a}
              </span>
            ))}
          </div>
        </div>

        {/* Description */}
        {salon.description && (
          <div className="mb-8">
            <h3 className="mb-2 font-display text-sm font-semibold text-foreground">
              About
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {salon.description}
            </p>
          </div>
        )}

        {/* Reviews */}
        <SalonReviews salonId={salon.id} reviews={salon.reviews || []} rating={salon.rating || 0} reviewCount={salon.review_count || 0} />
      </div>

      {/* Bottom Sticky */}
      {selectedServices.length > 0 && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md px-4 py-3"
        >
          <div className="mx-auto flex max-w-lg items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                {selectedDetails.services.length} service{selectedDetails.services.length > 1 ? "s" : ""} · {selectedDetails.totalDuration} min · {personCount} person{personCount > 1 ? "s" : ""}
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-lg font-bold text-foreground">
                  ₹{selectedDetails.discountedPrice}
                </p>
                {selectedDetails.offerPercent > 0 && (
                  <>
                    <p className="text-sm text-muted-foreground line-through">₹{selectedDetails.totalPrice}</p>
                    <span className="text-xs font-bold text-[#e31837]">{selectedDetails.offerPercent}% off</span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() =>
                navigate(`/booking/${salon.id}`, {
                  state: { selectedServices, personCount, servicesContent: selectedDetails.services },
                })
              }
              className="rounded-2xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.97]"
            >
              Book Now
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default SalonDetailPage;
