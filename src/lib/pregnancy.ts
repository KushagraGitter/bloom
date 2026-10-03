/**
 * Due-date and gestational-age maths.
 *
 * All dates are calendar dates as `YYYY-MM-DD` strings and are handled in UTC,
 * so a user's timezone or a DST change can never shift a result by a day.
 * Everything is anchored on the first day of the last menstrual period (LMP),
 * which is what `pregnancies.lmp_date` stores.
 */

export const PREGNANCY_DAYS = 280;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DatingMethod =
  | { method: 'lmp'; lmpDate: string }
  | { method: 'due'; dueDate: string }
  /** IVF: embryo transfer date and the embryo's age in days at transfer (3 or 5). */
  | { method: 'ivf'; transferDate: string; embryoDay: 3 | 5 };

export type GestationalAge = {
  /** Completed weeks, e.g. 24 for "24 weeks 3 days". */
  weeks: number;
  /** Days into the current week, 0–6. */
  days: number;
  totalDays: number;
  trimester: 1 | 2 | 3;
  daysToGo: number;
  /** Share of the 40 weeks elapsed, clamped to 0–1. */
  progress: number;
};

function toUtc(date: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Expected a YYYY-MM-DD date, got "${date}"`);
  const [, y, mo, d] = m;
  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d));
  // Date.UTC rolls overflow into the next month or year, so check every part.
  const parsed = new Date(ms);
  if (
    parsed.getUTCFullYear() !== Number(y) ||
    parsed.getUTCMonth() !== Number(mo) - 1 ||
    parsed.getUTCDate() !== Number(d)
  ) {
    throw new Error(`Not a real date: "${date}"`);
  }
  return ms;
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** Today's calendar date on this device, as `YYYY-MM-DD`. */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Works out the LMP date from whichever dating method the user picked in onboarding. */
export function lmpFrom(input: DatingMethod): string {
  switch (input.method) {
    case 'lmp':
      return fromUtc(toUtc(input.lmpDate));
    case 'due':
      return addDays(input.dueDate, -PREGNANCY_DAYS);
    case 'ivf':
      // A day-N embryo at transfer is treated as conceived N days earlier,
      // and conception is dated 14 days after LMP.
      return addDays(input.transferDate, -(14 + input.embryoDay));
  }
}

export function dueDateFromLmp(lmpDate: string): string {
  return addDays(lmpDate, PREGNANCY_DAYS);
}

export function trimesterForWeek(weeks: number): 1 | 2 | 3 {
  if (weeks < 14) return 1;
  if (weeks < 28) return 2;
  return 3;
}

export function gestationalAge(lmpDate: string, today: string): GestationalAge {
  const totalDays = Math.max(0, daysBetween(lmpDate, today));
  const weeks = Math.floor(totalDays / 7);
  return {
    weeks,
    days: totalDays % 7,
    totalDays,
    trimester: trimesterForWeek(weeks),
    daysToGo: Math.max(0, PREGNANCY_DAYS - totalDays),
    progress: Math.min(1, totalDays / PREGNANCY_DAYS),
  };
}
