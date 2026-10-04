/**
 * Vitamins: what is due on a day, who ticked it off, and the streak.
 *
 * Days are local calendar dates as `YYYY-MM-DD`, the same strings the database
 * stores, so they compare correctly as plain strings.
 */
import { addDays } from '@/lib/pregnancy';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

export const TIMES: { key: TimeOfDay; label: string }[] = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' },
];

export const NAME_MAX = 80;
export const DOSE_MAX = 160;

export type Medication = {
  id: string;
  pregnancy_id: string;
  name: string;
  dose: string | null;
  time_of_day: TimeOfDay;
  start_date: string;
  end_date: string | null;
  created_at: string;
  /** Set when it was added from a scanned prescription. */
  source?: 'rx';
};

export type Dose = {
  medication_id: string;
  pregnancy_id: string;
  day: string;
  taken_at: string;
  /** Null once the person who ticked it has left. */
  logged_by: string | null;
};

const ORDER: Record<TimeOfDay, number> = { morning: 0, afternoon: 1, evening: 2 };

/** Medicines due on `day`: already started, and not past their last day. */
export function dueOn(meds: Medication[], day: string): Medication[] {
  return meds.filter((m) => m.start_date <= day && (m.end_date === null || m.end_date >= day));
}

/** Morning first, then afternoon and evening; within a time, in the order they were added. */
export function inDisplayOrder(meds: Medication[]): Medication[] {
  return [...meds].sort(
    (a, b) =>
      ORDER[a.time_of_day] - ORDER[b.time_of_day] || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
}

/** All three times of day, each with its medicines, so empty ones can say "Nothing scheduled". */
export function groupByTime(meds: Medication[]): { key: TimeOfDay; label: string; items: Medication[] }[] {
  const ordered = inDisplayOrder(meds);
  return TIMES.map((t) => ({ ...t, items: ordered.filter((m) => m.time_of_day === t.key) }));
}

export const doseKey = (medicationId: string, day: string) => `${medicationId}:${day}`;

export function indexDoses(doses: Dose[]): Map<string, Dose> {
  return new Map(doses.map((d) => [doseKey(d.medication_id, d.day), d]));
}

/** `empty`: nothing was due. `done`: everything due was taken. `open`: something is still to take. */
function dayState(meds: Medication[], index: Map<string, Dose>, day: string): 'empty' | 'done' | 'open' {
  const due = dueOn(meds, day);
  if (due.length === 0) return 'empty';
  return due.every((m) => index.has(doseKey(m.id, day))) ? 'done' : 'open';
}

/** Longest look-back: a pregnancy is 280 days, so a streak can't be older than this. */
const MAX_DAYS = 400;

/**
 * Days in a row, ending today, on which everything due was taken. Today only
 * counts once it's complete, but an unfinished today doesn't break the run.
 * Days with nothing due neither add to the streak nor break it, and a medicine
 * added today doesn't reach back and spoil earlier days.
 */
export function streakOf(meds: Medication[], doses: Dose[], today: string): number {
  if (meds.length === 0) return 0;
  const index = indexDoses(doses);
  const first = meds.reduce((min, m) => (m.start_date < min ? m.start_date : min), meds[0].start_date);
  let streak = 0;
  let day = today;
  for (let i = 0; i < MAX_DAYS && day >= first; i++, day = addDays(day, -1)) {
    const state = dayState(meds, index, day);
    if (state === 'done') streak += 1;
    else if (state === 'open' && day !== today) break;
  }
  return streak;
}

export type WeekDot = { day: string; label: string; done: boolean; isToday: boolean };

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Monday to Sunday of the week containing `today`, with which days were fully taken. */
export function weekDots(meds: Medication[], doses: Dose[], today: string): WeekDot[] {
  const index = indexDoses(doses);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const monday = addDays(today, -((weekday + 6) % 7));
  return WEEK.map((label, i) => {
    const day = addDays(monday, i);
    return { day, label, isToday: day === today, done: day <= today && dayState(meds, index, day) === 'done' };
  });
}

/** The second line under a medicine's name. */
export function doseLine(med: Pick<Medication, 'dose'>): string {
  return med.dose?.trim() || 'As prescribed';
}

/** Who ticked a dose, as a first name, or null when it was the person looking. */
export function tickedBy(
  dose: Pick<Dose, 'logged_by'>,
  meId: string | undefined,
  members: { user_id: string; name: string | null }[] | undefined,
): string | null {
  if (dose.logged_by === meId) return null;
  const first = members?.find((m) => m.user_id === dose.logged_by)?.name?.trim().split(' ')[0];
  return first || 'Partner';
}

/** A stable pick from `count` pill colours, the same on both phones. */
export function tintIndex(id: string, count: number): number {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % count;
}

export type NewMedication = { name: string; dose: string; time: TimeOfDay };

export type MedicationRow = {
  name: string;
  dose: string | null;
  time_of_day: TimeOfDay;
  start_date: string;
  end_date?: string | null;
  source?: 'rx';
};

export type ParsedMedication = { ok: true; row: MedicationRow } | { ok: false; error: string };

/** Turns the add sheet's fields into a `medications` row, or an error to show. */
export function newMedicationRow(input: NewMedication, today: string): ParsedMedication {
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Enter the medicine’s name.' };
  if (name.length > NAME_MAX) return { ok: false, error: `Keep the name under ${NAME_MAX} characters.` };
  const dose = input.dose.trim();
  if (dose.length > DOSE_MAX) return { ok: false, error: `Keep the dose under ${DOSE_MAX} characters.` };
  return { ok: true, row: { name, dose: dose || null, time_of_day: input.time, start_date: today } };
}

/** "Until 2 Jan": the last day of a course, for under a medicine's dose. */
export function untilLine(endDate: string, locale?: string): string {
  const [y, m, d] = endDate.split('-').map(Number);
  return `Until ${new Date(y, m - 1, d).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`;
}

// ---------------------------------------------------------------------------
// Medicines read from a prescription
// ---------------------------------------------------------------------------

/** What the scan function sends back for one medicine (see `src/lib/scan.ts`). */
export type ScannedMed = {
  name: string;
  strength: string;
  dose: string;
  frequency: string;
  time_of_day: TimeOfDay;
  duration_days: number | null;
  instructions: string;
};

/** One medicine on the review sheet. `days` is what is typed: empty means it carries on. */
export type RxItem = { name: string; dose: string; time: TimeOfDay; days: string; written: string; on: boolean };

export const DAYS_MAX = 366;

/** The medicines the AI read, all ticked to start with. Strength, dose and directions become one dose line. */
export function rxItems(meds: ScannedMed[]): RxItem[] {
  return meds.map((m) => ({
    name: m.name.slice(0, NAME_MAX),
    dose: [m.strength, m.dose, m.instructions].filter((p) => p.trim()).join(' · ').slice(0, DOSE_MAX),
    time: m.time_of_day,
    days: m.duration_days ? String(m.duration_days) : '',
    written: m.frequency,
    on: true,
  }));
}

export type ParsedRx = { ok: true; rows: MedicationRow[] } | { ok: false; error: string };

/** The ticked medicines as rows to add, starting today, or what to fix first. */
export function rowsFromRx(items: RxItem[], today: string): ParsedRx {
  const rows: MedicationRow[] = [];
  for (const item of items.filter((i) => i.on)) {
    const parsed = newMedicationRow({ name: item.name, dose: item.dose, time: item.time }, today);
    if (!parsed.ok) return parsed;
    const typed = item.days.trim();
    if (typed && !/^\d{1,3}$/.test(typed)) return { ok: false, error: `Days for ${parsed.row.name} should be a number, or empty if it carries on.` };
    const days = typed ? Number(typed) : null;
    if (days !== null && (days < 1 || days > DAYS_MAX)) {
      return { ok: false, error: `Days for ${parsed.row.name} should be from 1 to ${DAYS_MAX}, or empty if it carries on.` };
    }
    rows.push({ ...parsed.row, end_date: days === null ? null : addDays(today, days - 1), source: 'rx' });
  }
  return { ok: true, rows };
}
