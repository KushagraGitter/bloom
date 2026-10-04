/**
 * Progress: the weekly charts, the 7-day averages and the journey bar, worked
 * out from the check-ins already in the vault. Plain functions, so the maths
 * is tested without a screen.
 */

import { addDays, daysBetween, localToday } from '@/lib/pregnancy';
import type { Reading, Units } from '@/lib/readings';

export type Metric = 'weight' | 'bp' | 'sugar';

export const METRICS: { key: Metric; label: string }[] = [
  { key: 'weight', label: 'Weight' },
  { key: 'bp', label: 'BP' },
  { key: 'sugar', label: 'Sugar' },
];

/** How many weeks the chart shows: the latest ones that have a reading. */
export const CHART_WEEKS = 7;

export type Bar = {
  week: number;
  /** The weekly average in the units shown. */
  value: number;
  /** The number written above the bar. */
  label: string;
  /** Bar height as a share of the chart, 0.15–1, so the lowest week still shows. */
  height: number;
};

export type Chart = { title: string; bars: Bar[]; note: string | null; empty: string };

const LB_PER_KG = 2.20462;
const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;
const average = (ns: number[]) => ns.reduce((a, b) => a + b, 0) / ns.length;

/** Completed weeks of pregnancy on the local day a reading was taken. */
export function weekOf(lmpDate: string, takenAt: string): number {
  return Math.floor(Math.max(0, daysBetween(lmpDate, localToday(new Date(takenAt)))) / 7);
}

/** The pregnancy week a calendar day falls in. */
export function weekOnDay(lmpDate: string, day: string): number {
  return Math.floor(Math.max(0, daysBetween(lmpDate, day)) / 7);
}

/** The reading's value as charted: weight in her units, the top BP number, sugar in mg/dL. */
function chartValue(r: Reading, units: Units): number {
  const n = Number(r.value_num);
  if (r.type === 'weight' && units === 'imperial') return n * LB_PER_KG;
  return n;
}

/**
 * Sugar is charted from fasting readings only: after-meal numbers run higher
 * and would make the weekly average swing with when she happened to test.
 */
function counts(r: Reading, metric: Metric): boolean {
  if (r.type !== metric) return false;
  if (metric === 'sugar') return r.value_text === 'Fasting';
  return true;
}

export function buildChart(readings: Reading[], metric: Metric, lmpDate: string, units: Units): Chart {
  const byWeek = new Map<number, number[]>();
  for (const r of readings) {
    if (!counts(r, metric)) continue;
    const week = weekOf(lmpDate, r.taken_at);
    const list = byWeek.get(week) ?? [];
    list.push(chartValue(r, units));
    byWeek.set(week, list);
  }
  const weeks = [...byWeek.keys()].sort((a, b) => a - b).slice(-CHART_WEEKS);
  const dp = metric === 'weight' ? 1 : 0;
  const values = weeks.map((w) => round(average(byWeek.get(w)!), dp));

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const bars: Bar[] = weeks.map((week, i) => ({
    week,
    value: values[i],
    label: String(values[i]),
    height: hi === lo ? 0.6 : 0.15 + (0.85 * (values[i] - lo)) / (hi - lo),
  }));

  const unit = units === 'imperial' ? 'lb' : 'kg';
  switch (metric) {
    case 'weight': {
      let note: string | null = null;
      if (bars.length >= 2) {
        const change = round(bars[bars.length - 1].value - bars[0].value, 1);
        const sign = change > 0 ? '+' : change < 0 ? '−' : '±';
        note = `${sign}${Math.abs(change)} ${unit} since week ${bars[0].week}`;
      }
      return { title: `Weight (${unit})`, bars, note, empty: 'Log her weight on Today and it shows here, week by week.' };
    }
    case 'bp':
      return {
        title: 'Systolic BP',
        bars,
        note: bars.length ? 'The top number, averaged over each week' : null,
        empty: 'Log blood pressure on Today and it shows here, week by week.',
      };
    case 'sugar':
      return {
        title: 'Fasting sugar (mg/dL)',
        bars,
        note: bars.length ? 'Fasting readings, averaged over each week' : null,
        empty: 'Log a fasting blood sugar on Today and it shows here, week by week.',
      };
  }
}

/** The local days from `day` back through the six before it, newest first. */
export function lastSevenDays(day: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(day, -i));
}

/**
 * Kicks a day, averaged over the days in the last week that have any kicks
 * logged: a day she didn't count is left out rather than counted as zero.
 * Null when none were logged.
 */
export function kicksAverage(countsByDay: number[]): number | null {
  const logged = countsByDay.filter((n) => n > 0);
  if (logged.length === 0) return null;
  return Math.round(average(logged));
}

/** Hours of sleep over the readings of the last seven local days, shown like "7h 05m". */
export function sleepAverage(readings: Reading[], day: string): string | null {
  const days = new Set(lastSevenDays(day));
  const hours = readings.filter((r) => r.type === 'sleep' && days.has(localToday(new Date(r.taken_at)))).map((r) => Number(r.value_num));
  if (hours.length === 0) return null;
  const minutes = Math.round(average(hours) * 60);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

/** The journey bar: the trimesters as Today counts them (weeks 0–13, 14–27, 28–40), filled up to now. */
export const TRIMESTERS = [
  { label: '1st', from: 0, weeks: 14 },
  { label: '2nd', from: 14, weeks: 14 },
  { label: '3rd', from: 28, weeks: 12 },
] as const;

/** How full each trimester's segment is, 0–1, for a pregnancy `totalDays` along. */
export function journeyFill(totalDays: number): number[] {
  return TRIMESTERS.map((t) => Math.min(1, Math.max(0, (totalDays / 7 - t.from) / t.weeks)));
}
