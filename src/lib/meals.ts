/**
 * Meals: what was eaten today, the nutrient totals, her goals, and her
 * cravings.
 *
 * Each of these is a record sealed on the phone (see `src/lib/vault`), so the
 * shapes below are what goes inside the seal. A record can have been written by
 * the other phone, so the `parse` functions check what they read. Days are
 * local calendar dates as `YYYY-MM-DD` and times are `HH:mm`.
 */
import { localDate } from '@/lib/appointments';

/** The `kind` of the records: one per meal, one per craving, and one for the goals. */
export const MEAL_KIND = 'meal';
export const CRAVING_KIND = 'craving';
export const GOALS_KIND = 'meal-goals';

export const FOOD_MAX = 120;
export const NOTE_MAX = 200;
export const CRAVING_MAX = 40;
/** The most a single nutrient number can be, so a stray extra digit is caught. */
export const AMOUNT_MAX = 10000;

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

export type Slot = 'breakfast' | 'snack' | 'lunch' | 'dinner';

/** In the order the design offers them. */
export const SLOTS: { key: Slot; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'snack', label: 'Snack' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
];

const isSlot = (value: unknown): value is Slot => SLOTS.some((s) => s.key === value);

export const slotLabel = (slot: Slot) => SLOTS.find((s) => s.key === slot)?.label ?? slot;

/** The meal a time of day usually is: breakfast before 11, lunch before 4, a snack before 6, dinner after. */
export function guessSlot(time: string): Slot {
  const hour = Number(time.slice(0, 2));
  return hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 18 ? 'snack' : 'dinner';
}

/**
 * What the add buttons start on: the usual meal for this time of day, or a
 * snack when that meal is already logged today.
 */
export function suggestSlot(today: Meal[], time: string): Slot {
  const guess = guessSlot(time);
  return guess !== 'snack' && today.some((m) => m.slot === guess) ? 'snack' : guess;
}

// ---------------------------------------------------------------------------
// Nutrients and goals
// ---------------------------------------------------------------------------

export type NutrientKey = 'protein' | 'iron' | 'calcium' | 'folate' | 'fibre';
export type AmountKey = 'kcal' | NutrientKey;
/** The numbers typed in for one meal; any of them can be left out. */
export type Amounts = Partial<Record<AmountKey, number>>;
export type Goals = Record<NutrientKey, number>;

type AmountInfo<K extends AmountKey> = { key: K; name: string; unit: string };

/** The five the day's bars add up, in the design's order. */
export const NUTRIENTS: AmountInfo<NutrientKey>[] = [
  { key: 'protein', name: 'Protein', unit: 'g' },
  { key: 'iron', name: 'Iron', unit: 'mg' },
  { key: 'calcium', name: 'Calcium', unit: 'mg' },
  { key: 'folate', name: 'Folate', unit: 'mcg' },
  { key: 'fibre', name: 'Fibre', unit: 'g' },
];

/** What a meal can carry: the five nutrients, and calories. */
export const AMOUNTS: AmountInfo<AmountKey>[] = [{ key: 'kcal', name: 'Calories', unit: 'kcal' }, ...NUTRIENTS];

/**
 * Where the goals start, until she enters the ones her doctor gave her. These
 * are the numbers in the design, not advice.
 */
export const DEFAULT_GOALS: Goals = { protein: 71, iron: 27, calcium: 1000, folate: 600, fibre: 28 };

/** 14, 14.5 and 0.4: whole when it is whole, one decimal otherwise. */
export const formatAmount = (n: number) => String(Math.round(n * 10) / 10);

/**
 * "12", "0.5" and "0,5" are all numbers; nothing typed is "not given" (null).
 * Anything else, such as "-3", "1e3" or "twelve", isn't a number here.
 */
export function parseAmount(text: string): { ok: true; value: number | null } | { ok: false } {
  const typed = text.trim().replace(',', '.');
  if (!typed) return { ok: true, value: null };
  if (!/^(\d+\.?\d*|\.\d+)$/.test(typed)) return { ok: false };
  const value = Number(typed);
  return value <= AMOUNT_MAX ? { ok: true, value } : { ok: false };
}

export type Bar = { key: NutrientKey; name: string; have: number; goal: number; percent: number; label: string };

export function totalsOf(meals: Meal[]): Record<NutrientKey, number> {
  const totals: Record<NutrientKey, number> = { protein: 0, iron: 0, calcium: 0, folate: 0, fibre: 0 };
  for (const meal of meals) for (const { key } of NUTRIENTS) totals[key] += meal.amounts[key] ?? 0;
  return totals;
}

/** Whether any of these meals has a nutrient number to add up. */
export const hasNutrients = (meals: Meal[]) => meals.some((m) => NUTRIENTS.some(({ key }) => m.amounts[key] !== undefined));

/** One bar per nutrient: what the meals add up to, against the goal. The bar stops at full. */
export function barsFor(meals: Meal[], goals: Goals): Bar[] {
  const totals = totalsOf(meals);
  return NUTRIENTS.map(({ key, name, unit }) => {
    const have = totals[key];
    const goal = goals[key];
    return {
      key,
      name,
      have,
      goal,
      percent: goal > 0 ? Math.min(100, Math.round((have / goal) * 100)) : 0,
      label: `${formatAmount(have)} / ${formatAmount(goal)} ${unit}`,
    };
  });
}

/** What the goals sheet's fields start with. */
export function goalsInput(goals: Goals): Record<NutrientKey, string> {
  return Object.fromEntries(NUTRIENTS.map(({ key }) => [key, String(goals[key])])) as Record<NutrientKey, string>;
}

export type ParsedGoals = { ok: true; goals: Goals } | { ok: false; error: string };

/** Turns the goals sheet's fields into goals, or an error to show. Every goal needs a number above 0. */
export function newGoals(input: Record<NutrientKey, string>): ParsedGoals {
  const goals = { ...DEFAULT_GOALS };
  for (const { key, name } of NUTRIENTS) {
    const parsed = parseAmount(input[key]);
    if (!parsed.ok || parsed.value === null || parsed.value <= 0) {
      return { ok: false, error: `Enter a goal for ${name.toLowerCase()}: a number above 0, up to ${AMOUNT_MAX}.` };
    }
    goals[key] = parsed.value;
  }
  return { ok: true, goals };
}

// ---------------------------------------------------------------------------
// Meals
// ---------------------------------------------------------------------------

/** What is sealed inside a `meal` record. */
export type MealData = {
  day: string;
  slot: Slot;
  /** `HH:mm`, or null when no time was set. */
  time: string | null;
  food: string;
  note: string | null;
  amounts: Amounts;
  /** The user id of who logged it, or null if that isn't known. */
  by: string | null;
  /** Set when the food and numbers came from a photo read by AI (and were checked). */
  ai?: true;
};

/** A meal with the id and time of change of the record it came from. */
export type Meal = MealData & { id: string; updatedAt: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const asObject = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/** The meal inside a record's data, or null when it isn't one. */
export function parseMeal(data: unknown): MealData | null {
  const d = asObject(data);
  if (!d) return null;
  const { day, slot, time, food, note, amounts, by } = d;
  if (typeof day !== 'string' || !DAY.test(day) || !isSlot(slot) || typeof food !== 'string' || !food.trim()) return null;
  const given = asObject(amounts) ?? {};
  const parsed: Amounts = {};
  for (const { key } of AMOUNTS) {
    const n = given[key];
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0) parsed[key] = n;
  }
  return {
    day,
    slot,
    time: typeof time === 'string' && TIME.test(time) ? time : null,
    food: food.trim(),
    note: typeof note === 'string' && note.trim() ? note.trim() : null,
    amounts: parsed,
    by: typeof by === 'string' ? by : null,
    ...(d.ai === true ? { ai: true as const } : {}),
  };
}

/** The meal in a stored record, with the record's id and time of change, or null when it isn't one. */
export function mealFromItem(item: { id: string; updatedAt: string; data: unknown }): Meal | null {
  const data = parseMeal(item.data);
  return data ? { ...data, id: item.id, updatedAt: item.updatedAt } : null;
}

/** The meals of one day, earliest first. A meal with no time comes after the timed ones. */
export function mealsOn(meals: Meal[], day: string): Meal[] {
  const when = (m: Meal) => m.time ?? '99:99';
  return meals
    .filter((m) => m.day === day)
    .sort((a, b) => when(a).localeCompare(when(b)) || a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id));
}

/** "8:30" for `08:30` as on the design's tile, which has no room for am or pm; a dash when there's no time. */
export function tileTime(time: string | null): string {
  if (!time) return '—';
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}`;
}

/** "530 kcal · 18 g protein · 4.2 mg iron": the first three numbers given for a meal. */
export function amountsLine(amounts: Amounts): string {
  const parts: string[] = [];
  for (const { key, name, unit } of AMOUNTS) {
    const n = amounts[key];
    if (n === undefined) continue;
    parts.push(key === 'kcal' ? `${formatAmount(n)} kcal` : `${formatAmount(n)} ${unit} ${name.toLowerCase()}`);
  }
  return parts.slice(0, 3).join(' · ');
}

/** "Saturday, Oct 3" for the top of the screen, worded and ordered the way the phone's language does it unless one is given. */
export function dayHeading(day: string, locale?: string): string {
  return localDate(day).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' });
}

/** Who logged a meal, as a first name, or null when nobody is known or it was the person looking. */
export function loggedBy(
  meal: Pick<MealData, 'by'>,
  meId: string | undefined,
  members: { user_id: string; name: string | null }[] | undefined,
): string | null {
  if (!meal.by || meal.by === meId) return null;
  const first = members?.find((m) => m.user_id === meal.by)?.name?.trim().split(' ')[0];
  return first || 'Partner';
}

export type NewMeal = {
  slot: Slot;
  food: string;
  /** `HH:mm`, or '' for none. */
  time: string;
  note: string;
  /** What was typed in each nutrient field. */
  amounts: Partial<Record<AmountKey, string>>;
  /** The meal was read from a photo by AI. */
  ai?: boolean;
};

export type ParsedMeal = { ok: true; data: MealData } | { ok: false; error: string };

/** Turns the add sheet's fields into a meal record's data, or an error to show. */
export function newMealData(input: NewMeal, day: string, by: string | null): ParsedMeal {
  const food = input.food.trim();
  if (!food) return { ok: false, error: 'Enter what was eaten.' };
  if (food.length > FOOD_MAX) return { ok: false, error: `Keep the food to ${FOOD_MAX} characters or fewer.` };
  const note = input.note.trim();
  if (note.length > NOTE_MAX) return { ok: false, error: `Keep the notes to ${NOTE_MAX} characters or fewer.` };
  const amounts: Amounts = {};
  for (const { key, name } of AMOUNTS) {
    const parsed = parseAmount(input.amounts[key] ?? '');
    if (!parsed.ok) return { ok: false, error: `${name} should be a number from 0 to ${AMOUNT_MAX}, like 12 or 0.5.` };
    if (parsed.value !== null) amounts[key] = parsed.value;
  }
  const data: MealData = { day, slot: input.slot, time: TIME.test(input.time) ? input.time : null, food, note: note || null, amounts, by };
  return { ok: true, data: input.ai ? { ...data, ai: true } : data };
}

// ---------------------------------------------------------------------------
// Goals and cravings records
// ---------------------------------------------------------------------------

/**
 * The goals inside a record's data, or null when it isn't a goals record. A
 * goal that isn't a sensible number falls back to where the goals start.
 */
export function parseGoals(data: unknown): Goals | null {
  const d = asObject(data);
  if (!d) return null;
  const goals = { ...DEFAULT_GOALS };
  for (const { key } of NUTRIENTS) {
    const n = d[key];
    if (typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= AMOUNT_MAX) goals[key] = n;
  }
  return goals;
}

/** The text inside a craving record's data, or null when there is none. */
export function parseCraving(data: unknown): string | null {
  const text = asObject(data)?.text;
  return typeof text === 'string' && text.trim() ? text.trim() : null;
}

/** A craving or an aversion, with the id of its record. */
export type Craving = { id: string; text: string };

/** The craving in a stored record, or null when it isn't one. */
export function cravingFromItem(item: { id: string; data: unknown }): Craving | null {
  const text = parseCraving(item.data);
  return text === null ? null : { id: item.id, text };
}

/**
 * The goals in use: the latest saved record's, or the starting goals until
 * she has saved her own (`custom` says which). Records are oldest change first.
 */
export function goalsFromItems(items: { data: unknown }[]): { goals: Goals; custom: boolean } {
  for (const item of [...items].reverse()) {
    const goals = parseGoals(item.data);
    if (goals) return { goals, custom: true };
  }
  return { goals: DEFAULT_GOALS, custom: false };
}

export type ParsedCraving = { ok: true; text: string | null } | { ok: false; error: string };

/** `text` is null when there is nothing to add: the field is empty, or the craving is already on the list. */
export function newCraving(input: string, existing: string[]): ParsedCraving {
  const text = input.trim().replace(/\s+/g, ' ');
  if (!text) return { ok: true, text: null };
  if (text.length > CRAVING_MAX) return { ok: false, error: `Keep it to ${CRAVING_MAX} characters or fewer.` };
  const same = text.toLocaleLowerCase();
  if (existing.some((c) => c.toLocaleLowerCase() === same)) return { ok: true, text: null };
  return { ok: true, text };
}

// ---------------------------------------------------------------------------
// Meals read from a photo
// ---------------------------------------------------------------------------

/** What the scan function sends back for one food on the plate (see `src/lib/scan.ts`). */
export type ScannedFood = {
  name: string;
  portion: string;
  kcal: number | null;
  protein_g: number | null;
  iron_mg: number | null;
  calcium_mg: number | null;
  folate_mcg: number | null;
  fibre_g: number | null;
};

/** One food on the review sheet: what the AI saw, and whether it is kept. */
export type PlateItem = { name: string; portion: string; amounts: Amounts; on: boolean };

const SCAN_FIELDS: Record<AmountKey, keyof ScannedFood> = {
  kcal: 'kcal',
  protein: 'protein_g',
  iron: 'iron_mg',
  calcium: 'calcium_mg',
  folate: 'folate_mcg',
  fibre: 'fibre_g',
};

/** The foods the AI saw, all kept to start with. */
export function plateItems(foods: ScannedFood[]): PlateItem[] {
  return foods.map((f) => {
    const amounts: Amounts = {};
    for (const { key } of AMOUNTS) {
      const n = f[SCAN_FIELDS[key]];
      if (typeof n === 'number' && Number.isFinite(n) && n >= 0) amounts[key] = n;
    }
    return { name: f.name, portion: f.portion, amounts, on: true };
  });
}

/** "Dal tadka, Jeera rice, Roti": the kept foods, as the meal's name. */
export function plateFood(items: PlateItem[]): string {
  const names = items.filter((i) => i.on).map((i) => i.name);
  let food = '';
  for (const name of names) {
    const next = food ? `${food}, ${name}` : name;
    if (next.length > FOOD_MAX) break;
    food = next;
  }
  return food;
}

/** The kept foods' numbers added up, as the add sheet's fields. A number none of them has stays empty. */
export function plateAmounts(items: PlateItem[]): Partial<Record<AmountKey, string>> {
  const fields: Partial<Record<AmountKey, string>> = {};
  for (const { key } of AMOUNTS) {
    const given = items.filter((i) => i.on && i.amounts[key] !== undefined);
    if (given.length === 0) continue;
    fields[key] = formatAmount(Math.min(AMOUNT_MAX, given.reduce((sum, i) => sum + (i.amounts[key] ?? 0), 0)));
  }
  return fields;
}
