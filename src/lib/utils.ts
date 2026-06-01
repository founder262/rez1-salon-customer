import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Booking Constants
export const BUFFER_TIME = 10;
export const BOOKING_WINDOW_DAYS = 3;

export type TimeSlot = {
  time: string;
  label: string;
  period: "Morning" | "Noon" | "Evening";
  available: boolean;
};

export type SalonCategory = "Men" | "Women" | "Unisex" | "Pets" | "Bridal";

export function parseTimeStr(timeStr: string): number {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let [_, h, m, ampm] = match;
  let hours = parseInt(h);
  const mins = parseInt(m);
  if (ampm.toUpperCase() === "PM" && hours < 12) hours += 12;
  if (ampm.toUpperCase() === "AM" && hours === 12) hours = 0;
  return hours * 60 + mins;
}

export function generateTimeSlots(date: Date, totalDuration: number, openTimeStr = "10:00 AM", closeTimeStr = "08:00 PM"): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const openMinutes = parseTimeStr(openTimeStr);
  let closeMinutes = parseTimeStr(closeTimeStr);
  if (closeMinutes < openMinutes) closeMinutes += 24 * 60; // handle past midnight

  const slotInterval = 30;
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (let m = openMinutes; m < closeMinutes; m += slotInterval) {
    const h = Math.floor(m / 60) % 24;
    const mins = m % 60;
    
    const timeStr = `${h.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
    const hour12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
    const ampm = h >= 12 ? "PM" : "AM";
    const label = `${hour12}:${mins.toString().padStart(2, "0")} ${ampm}`;

    let period: TimeSlot["period"] = "Morning";
    if (h >= 16) period = "Evening"; // 4 PM onwards
    else if (h >= 12) period = "Noon";

    const slotEndMinutes = m + totalDuration + BUFFER_TIME;
    let available = slotEndMinutes <= closeMinutes;

    if (isToday && m <= currentMinutes) {
      available = false; // block past slots
    }

    slots.push({
      time: timeStr,
      label,
      period,
      available,
    });
  }

  return slots;
}

export function getNextDays(count: number): Date[] {
  const days: Date[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}
