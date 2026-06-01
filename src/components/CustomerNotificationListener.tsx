import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

let audioCtx: AudioContext | null = null;
const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
};

export const primeAudioContext = () => {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
  } catch (_) {}
};

const playChime = async () => {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") await ctx.resume();

  const playTone = (freq: number, startTime: number, duration: number) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(freq, startTime);
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  };

  const now = ctx.currentTime;
  playTone(587.33, now, 0.25);
  playTone(880.0, now + 0.15, 0.4);
};

export function CustomerNotificationListener() {
  useEffect(() => {
    let channelNotifs: ReturnType<typeof supabase.channel> | null = null;
    let channelBookings: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Direct Notifications Subscription (depends on RLS policy)
      channelNotifs = supabase
        .channel(`customer-notifs-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `target_id=eq.${user.id}`,
          },
          (payload) => {
            const notif = payload.new;
            toast(notif.title, { description: notif.message });
            try {
              playChime();
            } catch (e) {
              console.warn("Could not play sound:", e);
            }
          }
        )
        .subscribe();

      // 2. Direct Bookings Update Subscription (100% reliable under secure user RLS)
      channelBookings = supabase
        .channel(`customer-bookings-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "bookings",
            filter: `customer_id=eq.${user.id}`,
          },
          (payload) => {
            const booking = payload.new;
            const oldBooking = payload.old;

            // If the booking was cancelled by the salon owner
            if (booking.status === "cancelled" && booking.cancelled_by === "owner") {
              toast.error("⚠️ Booking Cancelled by Salon", {
                description: `Emergency: your booking on ${new Date(booking.booking_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })} at ${booking.booking_time} was cancelled by the salon. Please select a reschedule slot or request a full refund.`,
                duration: 8000
              });

              try {
                playChime();
              } catch (e) {
                console.warn("Could not play sound:", e);
              }

              // Fire reload event to update bookings page in real-time
              window.dispatchEvent(new Event("rez1-bookings-reload"));
            }
          }
        )
        .subscribe();
    };

    setupRealtime();

    const prime = () => primeAudioContext();
    window.addEventListener("click", prime, { once: true });
    window.addEventListener("touchstart", prime, { once: true });
    
    return () => {
      window.removeEventListener("click", prime);
      window.removeEventListener("touchstart", prime);
      if (channelNotifs) supabase.removeChannel(channelNotifs);
      if (channelBookings) supabase.removeChannel(channelBookings);
    };
  }, []);

  return null;
}
