/**
 * The weekly postcard from the baby. A new one arrives on the day each week
 * starts; the notes are in `@/content/postcards`. Which one this phone has
 * turned over is kept on the phone: it only decides whether the “New” sticker
 * shows, so it stays out of the vault and the server.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { POSTCARDS } from '@/content/postcards';
import { addDays } from '@/lib/pregnancy';

export const FIRST_POSTCARD_WEEK = 4;
export const LAST_POSTCARD_WEEK = 41;

/** Every week with a postcard, from the first. */
export const POSTCARD_WEEKS: number[] = Object.keys(POSTCARDS)
  .map(Number)
  .sort((a, b) => a - b);

/** This week's postcard: none before week 4, and week 41's after it. */
export function postcardWeek(weeks: number): number | null {
  if (weeks < FIRST_POSTCARD_WEEK) return null;
  return Math.min(weeks, LAST_POSTCARD_WEEK);
}

export function postcardFor(week: number): string | null {
  return POSTCARDS[week] ?? null;
}

/** The postcards that have arrived, oldest first. */
export function arrivedWeeks(weeks: number): number[] {
  const current = postcardWeek(weeks);
  return current === null ? [] : POSTCARD_WEEKS.filter((w) => w <= current);
}

/** The next postcard still on its way, or null once the last has arrived. */
export function nextWeek(weeks: number): number | null {
  return POSTCARD_WEEKS.find((w) => w > weeks) ?? null;
}

/** The day a week's postcard arrives: the first day of that week. */
export function arrivesOn(lmpDate: string, week: number): string {
  return addDays(lmpDate, week * 7);
}

/** "From your baby", or "From your babies" for twins and more. */
export function signOff(babies = 1): string {
  return babies > 1 ? 'From your babies' : 'From your baby';
}

const KEY = 'bloom.postcardSeen';

type PostcardSeen = {
  /** The newest week turned over on this phone; null until read. */
  week: number | null;
  load: () => Promise<void>;
  markSeen: (week: number) => Promise<void>;
};

export const usePostcardSeen = create<PostcardSeen>((set, get) => ({
  week: null,
  load: async () => {
    let week = 0;
    try {
      week = Number(await AsyncStorage.getItem(KEY)) || 0;
    } catch {
      // Unreadable storage shows the postcard as new, which does no harm.
    }
    set({ week: Math.max(week, get().week ?? 0) });
  },
  markSeen: async (week) => {
    if ((get().week ?? 0) >= week) return;
    set({ week });
    try {
      await AsyncStorage.setItem(KEY, String(week));
    } catch {
      // Kept for this session.
    }
  },
}));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const parts = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return { day: d, month: MONTHS[m - 1], weekday: DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] };
};

/** "6 OCT", for the postmark. */
export function postmarkText(date: string): string {
  const p = parts(date);
  return `${p.day} ${p.month.toUpperCase()}`;
}

/** "Tue 13 Oct". */
export function arrivalText(date: string): string {
  const p = parts(date);
  return `${p.weekday} ${p.day} ${p.month}`;
}
