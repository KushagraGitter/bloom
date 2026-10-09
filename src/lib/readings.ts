/**
 * Today check-ins: parsing what she types into a `readings` row, and showing
 * rows back. Weight is stored in kg and shown in the pregnancy's units.
 */

export type ReadingType = 'weight' | 'bp' | 'sugar' | 'sleep' | 'kicks' | 'water';
export type CheckinType = 'weight' | 'bp' | 'sugar' | 'sleep';
export type Units = 'metric' | 'imperial';

export type Reading = {
  id: string;
  pregnancy_id: string;
  type: ReadingType;
  value_num: number | null;
  value_num2: number | null;
  value_text: string | null;
  taken_at: string;
  logged_by: string;
};

export const CHECKINS: CheckinType[] = ['weight', 'bp', 'sugar', 'sleep'];

export const SUGAR_CONTEXTS = ['Fasting', 'After a meal'] as const;

export const WATER_GOAL = 10;

const LB_PER_KG = 2.20462;

export function checkinMeta(type: CheckinType, units: Units) {
  switch (type) {
    case 'weight':
      return {
        label: 'Weight',
        title: 'Log weight',
        field: units === 'imperial' ? 'Weight in lb' : 'Weight in kg',
        placeholder: units === 'imperial' ? 'e.g. 142' : 'e.g. 64.5',
        keyboard: 'decimal-pad' as const,
      };
    case 'bp':
      return {
        label: 'Blood pressure',
        title: 'Log blood pressure',
        field: 'Systolic / diastolic',
        placeholder: 'e.g. 114/76',
        keyboard: 'numbers-and-punctuation' as const,
      };
    case 'sugar':
      return {
        label: 'Blood sugar',
        title: 'Log blood sugar',
        field: 'Reading in mg/dL',
        placeholder: 'e.g. 90',
        keyboard: 'decimal-pad' as const,
      };
    case 'sleep':
      return {
        label: 'Sleep',
        title: 'Log last night’s sleep',
        field: 'Hours slept',
        placeholder: 'e.g. 7h 30m',
        keyboard: 'default' as const,
      };
  }
}

export type ParsedCheckin =
  | { ok: true; value_num: number; value_num2: number | null }
  | { ok: false; error: string };

function toNumber(text: string): number {
  const t = text.trim().replace(',', '.');
  return t === '' ? NaN : Number(t);
}

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

/** Hours from "7", "7.5", "7h", "7h 30m", "7:30" or "7 30". */
export function parseSleepHours(text: string): number {
  const t = text.trim().toLowerCase();
  const hm = /^(\d{1,2})\s*(?:h|hr|hrs|hours?|:|\s)\s*(?:(\d{1,2})\s*(?:m|min|mins|minutes?)?)?$/.exec(t);
  if (hm) {
    const minutes = hm[2] === undefined ? 0 : Number(hm[2]);
    if (minutes >= 60) return NaN;
    return Number(hm[1]) + minutes / 60;
  }
  return toNumber(t);
}

export function parseCheckin(type: CheckinType, text: string, units: Units): ParsedCheckin {
  switch (type) {
    case 'weight': {
      const n = toNumber(text);
      const kg = units === 'imperial' ? n / LB_PER_KG : n;
      if (!Number.isFinite(kg) || kg < 25 || kg > 300) {
        return { ok: false, error: units === 'imperial' ? 'Enter your weight in lb, like 142.' : 'Enter your weight in kg, like 64.5.' };
      }
      return { ok: true, value_num: round(kg, 2), value_num2: null };
    }
    case 'bp': {
      const m = /^\s*(\d{2,3})\s*[/\\\-\s]\s*(\d{2,3})\s*$/.exec(text);
      const sys = m ? Number(m[1]) : NaN;
      const dia = m ? Number(m[2]) : NaN;
      if (!m || sys < 60 || sys > 250 || dia < 30 || dia > 160 || sys <= dia) {
        return { ok: false, error: 'Enter both numbers, top one first, like 114/76.' };
      }
      return { ok: true, value_num: sys, value_num2: dia };
    }
    case 'sugar': {
      const n = toNumber(text);
      if (!Number.isFinite(n) || n < 20 || n > 600) return { ok: false, error: 'Enter the reading in mg/dL, like 90.' };
      return { ok: true, value_num: round(n, 1), value_num2: null };
    }
    case 'sleep': {
      const h = parseSleepHours(text);
      if (!Number.isFinite(h) || h <= 0 || h > 24) return { ok: false, error: 'Enter hours slept, like 7h 30m or 7.5.' };
      return { ok: true, value_num: round(h, 2), value_num2: null };
    }
  }
}

/** The big number and its unit on a check-in card. */
export function formatCheckin(r: Pick<Reading, 'type' | 'value_num' | 'value_num2'>, units: Units): { value: string; unit: string } {
  const n = Number(r.value_num);
  switch (r.type) {
    case 'weight':
      return units === 'imperial'
        ? { value: String(round(n * LB_PER_KG, 1)), unit: 'lb' }
        : { value: String(round(n, 1)), unit: 'kg' };
    case 'bp':
      return { value: `${n}/${Number(r.value_num2)}`, unit: '' };
    case 'sugar':
      return { value: String(round(n, 1)), unit: 'mg/dL' };
    case 'sleep': {
      const total = Math.round(n * 60);
      const h = Math.floor(total / 60);
      const m = total % 60;
      return { value: m ? `${h}h ${m}m` : `${h}h`, unit: '' };
    }
    default:
      return { value: String(n), unit: '' };
  }
}

/** Local midnight as an ISO timestamp, the start of "today" for counts. */
export function startOfLocalDay(now: Date = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

export function isSameLocalDay(iso: string, now: Date = new Date()): boolean {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function countOf(readings: Reading[], type: 'kicks' | 'water'): number {
  return readings.filter((r) => r.type === type).length;
}

/** Newest reading of a type, or undefined. */
export function latestOf<T extends Pick<Reading, 'type' | 'taken_at'>>(readings: T[], type: ReadingType): T | undefined {
  let best: T | undefined;
  for (const r of readings) {
    if (r.type === type && (!best || r.taken_at > best.taken_at)) best = r;
  }
  return best;
}

const SIZES: Record<number, string> = {
  4: 'a poppy seed',
  5: 'a sesame seed',
  6: 'a lentil',
  7: 'a blueberry',
  8: 'a raspberry',
  9: 'a cherry',
  10: 'a strawberry',
  11: 'a lime',
  12: 'a plum',
  13: 'a lemon',
  14: 'a peach',
  15: 'an apple',
  16: 'an avocado',
  17: 'a pear',
  18: 'a bell pepper',
  19: 'a mango',
  20: 'a banana',
  21: 'a carrot',
  22: 'a papaya',
  23: 'a grapefruit',
  24: 'an ear of corn',
  25: 'a cauliflower',
  26: 'a head of lettuce',
  27: 'a head of broccoli',
  28: 'an aubergine',
  29: 'a butternut squash',
  30: 'a cabbage',
  31: 'a coconut',
  32: 'a jicama',
  33: 'a pineapple',
  34: 'a cantaloupe',
  35: 'a honeydew melon',
  36: 'a romaine lettuce',
  37: 'a bunch of chard',
  38: 'a leek',
  39: 'a small pumpkin',
  40: 'a watermelon',
};

/** The fruit or vegetable a week is compared with ("an ear of corn"), or null before week 4. */
export function sizeOf(weeks: number): string | null {
  return SIZES[Math.min(weeks, 40)] ?? null;
}

/** The hero card's "Baby is about the size of …" line, or null before week 4. */
export function babySizeLine(weeks: number, babies = 1): string | null {
  const size = sizeOf(weeks);
  if (!size) return null;
  return babies > 1 ? `Each baby is about the size of ${size}` : `Baby is about the size of ${size}`;
}
