/**
 * How big the baby is each week, for the fruit parade on Today and the life-size
 * sheet. Lengths match the weekly cards; weights are the usual chart averages.
 * Every baby differs, so these are always shown as "about".
 *
 * Until week 19 babies are measured head to bottom; from week 20 head to heel,
 * which is why the length jumps at 20.
 */
import { sizeOf } from '@/lib/readings';

/** The outline drawn for each week's fruit or vegetable. */
export type ProduceShape = 'seed' | 'round' | 'oval' | 'pear' | 'long' | 'corn' | 'leafy' | 'melon';

export type Growth = {
  week: number;
  /** "an ear of corn" */
  name: string;
  shape: ProduceShape;
  /** Length in centimetres. */
  lengthCm: number;
  /** Weight in grams; 0 while it is under a gram. */
  weightG: number;
};

export const FIRST_GROWTH_WEEK = 4;
export const LAST_GROWTH_WEEK = 41;
/** The first week measured head to heel. */
export const HEAD_TO_HEEL_FROM = 20;

// week: [shape, length cm, weight g]
const TABLE: Record<number, [ProduceShape, number, number]> = {
  4: ['seed', 0.1, 0],
  5: ['seed', 0.2, 0],
  6: ['oval', 0.6, 0],
  7: ['round', 1, 1],
  8: ['round', 1.6, 1],
  9: ['round', 2.3, 2],
  10: ['pear', 3, 4],
  11: ['round', 4, 7],
  12: ['round', 5.4, 14],
  13: ['oval', 7.4, 23],
  14: ['round', 8.5, 43],
  15: ['round', 10, 70],
  16: ['pear', 11.6, 100],
  17: ['pear', 12, 140],
  18: ['round', 14, 190],
  19: ['oval', 15, 240],
  20: ['long', 25, 300],
  21: ['long', 27, 360],
  22: ['oval', 28, 430],
  23: ['round', 29, 500],
  24: ['corn', 30, 600],
  25: ['leafy', 35, 660],
  26: ['leafy', 36, 760],
  27: ['leafy', 37, 875],
  28: ['long', 38, 1000],
  29: ['pear', 39, 1150],
  30: ['leafy', 40, 1300],
  31: ['round', 41, 1500],
  32: ['round', 42, 1700],
  33: ['oval', 44, 1900],
  34: ['melon', 45, 2100],
  35: ['melon', 46, 2400],
  36: ['long', 47, 2600],
  37: ['long', 49, 2900],
  38: ['long', 50, 3100],
  39: ['round', 51, 3300],
  40: ['melon', 51, 3500],
  41: ['melon', 51, 3600],
};

/** Every week in the parade, from the first. */
export const GROWTH_WEEKS: number[] = Object.keys(TABLE)
  .map(Number)
  .sort((a, b) => a - b);

/** A week's size, with weeks past 41 shown as 41. Null before week 4. */
export function growthFor(weeks: number): Growth | null {
  const week = Math.min(weeks, LAST_GROWTH_WEEK);
  const row = TABLE[week];
  const name = sizeOf(week);
  if (!row || !name) return null;
  const [shape, lengthCm, weightG] = row;
  return { week, name, shape, lengthCm, weightG };
}

/** "30 cm", "1.6 cm" or "1 mm". */
export function lengthText(cm: number): string {
  if (cm < 1) return `${Math.round(cm * 10)} mm`;
  return `${Number.isInteger(cm) ? cm : cm.toFixed(1)} cm`;
}

/** "600 g", "1.2 kg", or "under 1 g". */
export function weightText(g: number): string {
  if (g < 1) return 'under 1 g';
  if (g < 1000) return `${g} g`;
  return `${(Math.round(g / 100) / 10).toFixed(1)} kg`;
}

/** How the length is measured that week. */
export function measuredText(week: number): string {
  return week < HEAD_TO_HEEL_FROM ? 'head to bottom' : 'head to heel';
}

/** Everyday things with a familiar weight, lightest first. */
const WEIGHTS: { grams: number; one: string; many: string }[] = [
  { grams: 1, one: 'a paperclip', many: 'paperclips' },
  { grams: 5, one: 'a grape', many: 'grapes' },
  { grams: 25, one: 'an AA battery', many: 'AA batteries' },
  { grams: 100, one: 'a bar of soap', many: 'bars of soap' },
  { grams: 500, one: 'a bag of pasta', many: 'bags of pasta' },
  { grams: 1000, one: 'a bag of sugar', many: 'bags of sugar' },
];

/**
 * "About as heavy as six bars of soap": the heaviest everyday thing that fits at
 * least once, counted to the nearest whole one. Null under a gram.
 */
export function weightComparison(g: number): string | null {
  if (g < 1) return null;
  const item = [...WEIGHTS].reverse().find((w) => g >= w.grams) ?? WEIGHTS[0];
  const count = Math.max(1, Math.round(g / item.grams));
  return count === 1 ? `About as heavy as ${item.one}` : `About as heavy as ${countWord(count)} ${item.many}`;
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const countWord = (n: number) => WORDS[n] ?? String(n);

/**
 * Screen points per centimetre. Phones don't report their real pixel density
 * to apps, so this uses the platforms' own baselines: iOS draws about 160
 * points to the inch on current iPhones and Android about 160 dp. Real size
 * comes out within a few millimetres on most phones.
 */
export const POINTS_PER_CM = 160 / 2.54;

/** The outer box a shape needs for a given length: long things are wide and flat, pears are tall. */
export function produceBox(shape: ProduceShape, length: number): { width: number; height: number } {
  switch (shape) {
    case 'seed':
      return { width: Math.max(length, 3), height: Math.max(length, 3) };
    case 'round':
      return { width: length, height: length * 1.06 };
    case 'oval':
      return { width: length, height: length * 0.7 };
    case 'pear':
      return { width: length * 0.74, height: length };
    case 'melon':
      return { width: length, height: length * 0.82 };
    case 'long':
    case 'corn':
      return { width: length, height: Math.max(length * 0.3, 4) };
    case 'leafy':
      return { width: length, height: length };
  }
}

export type LifeSize =
  /** Drawn at real size, `points` long. */
  | { fits: true; points: number }
  /** Too big to draw: this many screens long (the screen's long side). */
  | { fits: false; screens: number };

/**
 * Whether a week's drawing fits in the space given at real size, or how many
 * of the phone's screens long it is.
 */
export function lifeSize(g: Pick<Growth, 'shape' | 'lengthCm'>, room: { width: number; height: number }, screenPoints: number): LifeSize {
  const points = g.lengthCm * POINTS_PER_CM;
  const box = produceBox(g.shape, points);
  if (box.width <= room.width && box.height <= room.height) return { fits: true, points };
  return { fits: false, screens: points / screenPoints };
}

/** How a length too big to draw compares with the phone's screen, top to bottom. */
export function screenComparison(screens: number): string {
  if (screens < 0.4) return 'Less than half as long as your screen';
  if (screens < 0.6) return 'About half as long as your screen';
  if (screens < 0.85) return 'About three-quarters as long as your screen';
  if (screens < 1.25) return 'About as long as your screen';
  const halves = Math.round(screens * 2) / 2;
  const count = Number.isInteger(halves) ? countWord(halves) : String(halves);
  return `About ${count} of your screens end to end`;
}
