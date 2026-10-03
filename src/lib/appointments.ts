/**
 * Appointments: the calendar grid, what is coming up, and the row the add
 * sheet saves.
 *
 * Days are calendar dates as `YYYY-MM-DD` and times are `HH:mm` on the clock
 * at the clinic, the same wall-clock values the database stores, so both sort
 * correctly as plain strings. Months are `YYYY-MM`.
 */

export const TITLE_MAX = 80;
export const PLACE_MAX = 120;

export type Appointment = {
  id: string;
  pregnancy_id: string;
  title: string;
  appt_date: string;
  /** `HH:mm`, or null when no time was set. */
  appt_time: string | null;
  place: string | null;
};

/** Cuts the time the database sends (`HH:mm:ss`) down to `HH:mm`. */
export function toAppointment(row: Appointment): Appointment {
  return { ...row, appt_time: row.appt_time ? row.appt_time.slice(0, 5) : null };
}

/** Earliest first. On the same day one with no time comes before the timed ones. */
export function byWhen(a: Appointment, b: Appointment): number {
  return (
    a.appt_date.localeCompare(b.appt_date) ||
    (a.appt_time ?? '').localeCompare(b.appt_time ?? '') ||
    a.id.localeCompare(b.id)
  );
}

/** Today's and later ones, soonest first. */
export function upcoming(appointments: Appointment[], today: string): Appointment[] {
  return appointments.filter((a) => a.appt_date >= today).sort(byWhen);
}

export function onDay(appointments: Appointment[], day: string): Appointment[] {
  return appointments.filter((a) => a.appt_date === day).sort(byWhen);
}

/**
 * The next one that hasn't happened: later days, and today's that have no
 * time or haven't reached it yet. `now` is the clock time as `HH:mm`.
 */
export function nextUp(appointments: Appointment[], today: string, now: string): Appointment | undefined {
  return upcoming(appointments, today).find((a) => a.appt_date > today || !a.appt_time || a.appt_time >= now);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The current clock time as `HH:mm`. */
export function localTime(now: Date = new Date()): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// ---------------------------------------------------------------------------
// The month grid
// ---------------------------------------------------------------------------

export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** `delta` months after (or before, if negative) `month`. */
export function addMonths(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  const index = year * 12 + (m - 1) + delta;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${pad((index % 12) + 1)}`;
}

export type MonthCell = { day: string; n: number } | null;

/**
 * A month as weeks, Monday first. Each week has seven cells; the ones before
 * the 1st and after the last day are null.
 */
export function monthWeeks(month: string): MonthCell[][] {
  const [year, m] = month.split('-').map(Number);
  const lead = (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const cells: MonthCell[] = [
    ...Array<MonthCell>(lead).fill(null),
    ...Array.from({ length: count }, (_, i): MonthCell => ({ n: i + 1, day: `${month}-${pad(i + 1)}` })),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

// ---------------------------------------------------------------------------
// Words on screen, in the phone's own language and style
// ---------------------------------------------------------------------------

function localDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "October 2026". */
export function monthTitle(month: string): string {
  return localDate(`${month}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** "October". */
export function monthName(day: string): string {
  return localDate(day).toLocaleDateString(undefined, { month: 'long' });
}

/** "OCT", for the date tile. */
export function monthAbbr(day: string): string {
  return localDate(day).toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
}

/** "14 October" or "October 14", whichever the phone prefers. */
export function dayTitle(day: string): string {
  return localDate(day).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

/** "14 Oct 2026". */
export function dayLong(day: string): string {
  return localDate(day).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export const dayNumber = (day: string) => Number(day.slice(8, 10));

/** "9:00 am" for `09:00`. */
export function clock(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return new Date(2000, 5, 15, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** The line under a title in the list: time, then place. */
export function metaLine(a: Pick<Appointment, 'appt_time' | 'place'>): string {
  return [a.appt_time && clock(a.appt_time), a.place].filter(Boolean).join(' · ') || 'No time set';
}

/** The line on Today's card, which puts the place first. */
export function cardLine(a: Pick<Appointment, 'appt_time' | 'place'>): string {
  return [a.place, a.appt_time && clock(a.appt_time)].filter(Boolean).join(' · ') || 'No time set';
}

// ---------------------------------------------------------------------------
// The add sheet
// ---------------------------------------------------------------------------

export type NewAppointment = { title: string; date: string; time: string; place: string };

export type AppointmentRow = {
  title: string;
  appt_date: string;
  appt_time: string | null;
  place: string | null;
};

export type ParsedAppointment = { ok: true; row: AppointmentRow } | { ok: false; error: string };

/** Turns the add sheet's fields into an `appointments` row, or an error to show. */
export function newAppointmentRow(input: NewAppointment): ParsedAppointment {
  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Enter what the appointment is for.' };
  if (title.length > TITLE_MAX) return { ok: false, error: `Keep the title to ${TITLE_MAX} characters or fewer.` };
  if (!input.date) return { ok: false, error: 'Pick a date.' };
  const place = input.place.trim();
  if (place.length > PLACE_MAX) return { ok: false, error: `Keep the place to ${PLACE_MAX} characters or fewer.` };
  return { ok: true, row: { title, appt_date: input.date, appt_time: input.time || null, place: place || null } };
}
