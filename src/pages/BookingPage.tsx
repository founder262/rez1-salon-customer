import { useState, useMemo, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users } from "lucide-react";
import BackButton from "@/components/BackButton";
import Logo from "@/components/Logo";
import { generateTimeSlots, getNextDays, BUFFER_TIME, BOOKING_WINDOW_DAYS } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const BookingPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [salon, setSalon] = useState<any>(null);
  const [blockedSlotTimes, setBlockedSlotTimes] = useState<Set<string>>(new Set());
  const [bookedSeatsByTime, setBookedSeatsByTime] = useState<Record<string, number>>({});

  const selectedServiceIds = (location.state as any)?.selectedServices || [];
  const selectedServices = (location.state as any)?.servicesContent || [];
  const personCount = (location.state as any)?.personCount || 1;

  useEffect(() => {
    const fetchSalon = async () => {
      const { data: salonData } = await supabase
        .from("salons")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      const { data: offersData } = await supabase
        .from("salon_offers")
        .select("*")
        .eq("salon_id", id);
      setSalon({ ...salonData, salon_offers: offersData || [] });
    };
    if (id) fetchSalon();
  }, [id]);


  const days = useMemo(() => {
    let window = BOOKING_WINDOW_DAYS;
    if (salon?.category === "Bridal") window = 90;
    else if (salon?.category === "Pets") window = 7;
    return getNextDays(window);
  }, [salon]);

  const [selectedDay, setSelectedDay] = useState(0);
  const [activeMonth, setActiveMonth] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // Fetch blocked slots AND current bookings whenever selected day or salon changes
  useEffect(() => {
    const fetchSlotsData = async () => {
      if (!salon?.id || !days[selectedDay]) return;
      const dateKey = days[selectedDay].toISOString().split("T")[0];
      
      // 1. Fetch explicitly blocked slots
      const { data: slotsData } = await supabase
        .from("slots")
        .select("slot_time")
        .eq("salon_id", salon.id)
        .eq("slot_date", dateKey)
        .eq("status", "blocked");
      const times = new Set<string>((slotsData || []).map((s: any) => s.slot_time));
      setBlockedSlotTimes(times);

      // 2. Fetch active bookings to calculate seat capacity
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("booking_time, person_count")
        .eq("salon_id", salon.id)
        .eq("booking_date", dateKey)
        .neq("status", "cancelled");

      const seatsMap: Record<string, number> = {};
      if (bookingsData) {
        for (const bk of bookingsData) {
          // Normalize to handle potential formatting mismatches ("H:MM AM/PM")
          const upper = (bk.booking_time || "").trim().toUpperCase();
          const ampmMatch = upper.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
          let key = upper;
          if (ampmMatch) {
            const h = parseInt(ampmMatch[1], 10);
            key = `${h}:${ampmMatch[2]} ${ampmMatch[3]}`;
          } else {
             const parts = upper.split(":");
             if (parts.length >= 2) {
               let h = parseInt(parts[0], 10);
               const mm = parts[1].slice(0, 2).padStart(2, "0");
               const ap = h >= 12 ? "PM" : "AM";
               const hr12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
               key = `${hr12}:${mm} ${ap}`;
             }
          }
          seatsMap[key] = (seatsMap[key] || 0) + (bk.person_count || 1);
        }
      }
      setBookedSeatsByTime(seatsMap);
    };
    fetchSlotsData();
  }, [salon, selectedDay, days]);


  // Group days by month for Bridal Calendar
  const monthsData = useMemo(() => {
    if (salon?.category !== "Bridal") return [];
    
    const months: { month: string; days: Date[] }[] = [];
    days.forEach((d) => {
      const monthLabel = d.toLocaleDateString("en-IN", { month: "long" });
      let monthGroup = months.find((m) => m.month === monthLabel);
      if (!monthGroup) {
        monthGroup = { month: monthLabel, days: [] };
        months.push(monthGroup);
      }
      monthGroup.days.push(d);
    });
    return months;
  }, [days, salon]);

  const totalDuration = selectedServices.reduce((sum: number, s: any) => sum + (Number(s.duration) || 0), 0) * personCount;
  const totalPrice = selectedServices.reduce((sum: number, s: any) => sum + s.price, 0) * personCount;
  const offerPercent = useMemo(() => {
    if (!salon?.salon_offers?.[0]) return 0;
    const offer = salon.salon_offers[0];
    const type = offer.active_type;
    // Explicitly return 0 if offer is disabled
    if (!type || type === 'none') return 0;
    if (type === 'all_days') return offer.all_days_percentage || 0;
    if (type === 'weekday_weekend') {
      const day = days[selectedDay]?.getDay();
      const isWeekend = day === 0 || day === 6;
      return isWeekend ? (offer.weekend_percentage || 0) : (offer.weekday_percentage || 0);
    }
    if (type === 'specific_day') {
      const dateStr = days[selectedDay]?.toISOString().split('T')[0];
      if (offer.specific_day_date === dateStr) return offer.specific_day_percentage || 0;
    }
    return 0;
  }, [salon, selectedDay, days]);
  const discountedPrice = salon ? Math.round(totalPrice * (1 - offerPercent / 100)) : totalPrice;
  const totalWithBuffer = totalDuration + BUFFER_TIME;

  const slots = useMemo(() => {
    if (!days[selectedDay] || !salon) return [];
    const allSlots = generateTimeSlots(days[selectedDay], totalWithBuffer, salon.open_time, salon.close_time);
    if (salon.is_emergency_mode === true || salon.is_booking_paused === true) {
      return allSlots.map(s => ({ ...s, available: false }));
    }
    // Mark owner-blocked slots and capacity-full slots as unavailable
    return allSlots.map(s => {
      // Slot time in utils is "HH:MM" 24h format; blocked times from DB may be "H:MM AM/PM"
      const isBlocked = blockedSlotTimes.has(s.time) || blockedSlotTimes.has(s.label);
      
      const totalSeats = salon.total_seats || 4;
      const currentlyBooked = bookedSeatsByTime[s.label] || bookedSeatsByTime[s.time] || 0;
      const isFull = currentlyBooked + personCount > totalSeats;

      return (isBlocked || isFull) ? { ...s, available: false } : s;
    });
  }, [selectedDay, days, totalWithBuffer, salon, blockedSlotTimes, bookedSeatsByTime, personCount]);


  const slotsByPeriod = useMemo(() => {
    const groups: Record<string, typeof slots> = {};
    slots.forEach((s) => {
      if (!groups[s.period]) groups[s.period] = [];
      groups[s.period].push(s);
    });
    return groups;
  }, [slots]);

  if (!salon) return <div className="p-4 text-foreground">Loading...</div>;

  const dayLabel = (d: Date) => {
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
  };

  const getDayDetails = (d: Date) => {
    const day = d.toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase();
    const date = d.toLocaleDateString("en-IN", { day: "2-digit" });
    const month = d.toLocaleDateString("en-IN", { month: "short" }).toUpperCase();
    return { day, date, month };
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-32">
      {/* Header */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="flex items-center gap-3">
          <BackButton />
          <h2 className="font-display text-base font-semibold text-foreground">
            Select Time
          </h2>
        </div>
        <Logo size="sm" showText={false} />
      </div>

      <div className="mx-auto max-w-lg px-4 sm:px-6 pt-4">
        {/* Selected Services Summary */}
        <div className="mb-6 rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Selected Services
          </h3>
          {selectedServices.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between py-1">
              <span className="text-sm text-foreground">{s.name}</span>
              <span className="text-sm text-muted-foreground">
                {s.duration || 0} min · ₹{s.price}
              </span>
            </div>
          ))}
          <div className="mt-2 border-t border-border pt-2">
            {personCount > 1 && (
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-muted-foreground">{personCount} persons</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Total</span>
              <span className="text-sm font-semibold text-foreground">
                {totalDuration} min · ₹{discountedPrice}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              +{BUFFER_TIME} min buffer
            </p>
          </div>
        </div>

        {/* Date Selection */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3 px-1">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Select Date
            </h4>
            <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {salon.category === "Bridal" ? "90 Days Available" : salon.category === "Pets" ? "7 Days Available" : "3 Days Available"}
            </span>
          </div>

          {salon.category === "Bridal" ? (
            /* Bridal Tabbed Calendar */
            <div className="space-y-4">
              {/* Month Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {monthsData.map((m, idx) => (
                  <button
                    key={m.month}
                    onClick={() => setActiveMonth(idx)}
                    className={`whitespace-nowrap rounded-full px-5 py-2 text-xs font-bold transition-all ${
                      activeMonth === idx
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m.month}
                  </button>
                ))}
              </div>

              {/* Grid with Animation */}
              <motion.div
                key={activeMonth}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="rounded-3xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="grid grid-cols-7 gap-1 mb-3">
                  {["S", "M", "T", "W", "T", "F", "S"].map((day) => (
                    <div key={day} className="text-center text-[10px] font-bold text-muted-foreground/50">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {/* Leading empty spaces */}
                  {Array.from({ length: monthsData[activeMonth].days[0].getDay() }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {monthsData[activeMonth].days.map((d) => {
                    const dayIndex = days.findIndex((day) => day.getTime() === d.getTime());
                    const active = dayIndex === selectedDay;
                    const isToday = d.toDateString() === new Date().toDateString();
                    return (
                      <button
                        key={d.toISOString()}
                        onClick={() => {
                          setSelectedDay(dayIndex);
                          setSelectedSlot(null);
                        }}
                        className={`group relative flex aspect-square items-center justify-center rounded-2xl text-sm transition-all ${
                          active
                            ? "bg-primary text-primary-foreground font-black shadow-lg shadow-primary/30 z-10"
                            : isToday
                            ? "text-primary font-bold bg-primary/5"
                            : "text-foreground hover:bg-muted font-medium"
                        }`}
                      >
                        {d.getDate()}
                        {isToday && !active && (
                          <div className="absolute bottom-1.5 h-1 w-1 rounded-full bg-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          ) : (
            /* Standard Swipe View (Salons, Pets) */
            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-none snap-x content-box">
              {days.map((d, i) => {
                const { day, date, month } = getDayDetails(d);
                const active = i === selectedDay;
                return (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedDay(i);
                      setSelectedSlot(null);
                    }}
                    className={`flex min-w-[72px] snap-start flex-col items-center justify-center rounded-2xl border py-4 transition-all ${
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "border-border bg-card text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    <span className={`text-[11px] font-bold tracking-wider ${active ? "opacity-90" : "text-muted-foreground"}`}>
                      {day}
                    </span>
                    <span className="my-1 text-xl font-black leading-none">
                      {date}
                    </span>
                    <span className={`text-[11px] font-bold tracking-wider ${active ? "opacity-90" : "text-muted-foreground"}`}>
                      {month}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Time Slots */}
        {Object.entries(slotsByPeriod).map(([period, periodSlots]) => (
          <div key={period} className="mb-6">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {period}
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {periodSlots.map((slot) => (
                <button
                  key={slot.time}
                  disabled={!slot.available}
                  onClick={() => setSelectedSlot(slot.time)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                    !slot.available
                      ? "border-border bg-muted text-muted-foreground opacity-40 cursor-not-allowed"
                      : selectedSlot === slot.time
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-primary/30 bg-card text-foreground hover:border-primary"
                  }`}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom */}
      {selectedSlot && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md px-4 py-3"
        >
          <div className="mx-auto flex max-w-lg items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                {dayLabel(days[selectedDay])} · {slots.find((s) => s.time === selectedSlot)?.label}
              </p>
              <p className="text-lg font-bold text-foreground">₹{discountedPrice}</p>
            </div>
            <button
              onClick={() =>
                navigate(`/summary/${salon.id}`, {
                  state: {
                    selectedServices: selectedServiceIds,
                    selectedSlot,
                    selectedDay: days[selectedDay].toISOString(),
                    personCount,
                    servicesContent: selectedServices,
                    reschedulingBookingId: (location.state as any)?.reschedulingBookingId,
                  },
                })
              }
              className="rounded-2xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.97]"
            >
              Continue
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default BookingPage;
