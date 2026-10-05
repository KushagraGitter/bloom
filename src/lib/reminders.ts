/**
 * The reminders this phone should have scheduled.
 *
 * Nothing here talks to the phone: give `planReminders` a person's switches,
 * the medicines and which doses were ticked, the appointments and the pregnancy
 * week, and it says which notifications should exist. `notifications.ts` hands
 * the result to the phone, and `useReminders.ts` keeps the two in step.
 *
 * Vitamins and appointments are scheduled as one-off notifications for the days
 * ahead, so a dose that is already ticked off (on either phone) or a medicine
 * that has finished does not nag. Water and kick counts repeat every day.
 */
import { clock, localDate, type Appointment } from '@/lib/appointments';
import type { ReminderKind } from '@/lib/onboarding';
import { addDays, gestationalAge, localToday } from '@/lib/pregnancy';
import { FIRST_CARD_WEEK, LAST_CARD_WEEK } from '@/lib/weeklyCards';
import { TIMES, doseKey, dueOn, inDisplayOrder, type Dose, type Medication, type TimeOfDay } from '@/lib/vitamins';

/** The clock time of each vitamin slot. Water, kicks and appointments have their own, below. */
export const VITAMIN_TIMES: Record<TimeOfDay, { hour: number; minute: number }> = {
  morning: { hour: 8, minute: 0 },
  afternoon: { hour: 14, minute: 0 },
  evening: { hour: 21, minute: 0 },
};

/** "Every 2 hours, 9 am – 8 pm": 9, 11, 1, 3, 5 and 7. */
export const WATER_HOURS = [9, 11, 13, 15, 17, 19];

/** "Daily, from week 28". */
export const KICKS_TIME = { hour: 20, minute: 0 };
export const KICKS_FROM_WEEK = 28;

/** A new week's cards are announced at this hour on the day the week starts. */
export const WEEK_NUDGE_TIME = { hour: 9, minute: 0 };

/** How many week starts ahead are scheduled. */
export const WEEK_NUDGES_AHEAD = 2;

/** An appointment with no time of its own is announced at this hour the day before. */
export const UNTIMED_DAY_BEFORE_HOUR = 9;

/** How many days of vitamin reminders are scheduled ahead, today included. */
export const VITAMIN_DAYS_AHEAD = 7;

/** Appointments further away than this are scheduled once they come within reach. */
export const APPOINTMENT_DAYS_AHEAD = 60;

/** iPhones keep only the 64 soonest notifications, so stay a little under that. */
export const MAX_REMINDERS = 60;

export type ReminderTrigger = { type: 'daily'; hour: number; minute: number } | { type: 'date'; at: Date };

export type PlannedReminder = {
  /** Stable, so a reminder that is still wanted is recognised after a refresh. */
  key: string;
  kind: ReminderKind | 'week';
  title: string;
  body: string;
  trigger: ReminderTrigger;
};

export type ReminderPlanInput = {
  /** This person's switches. */
  prefs: Record<ReminderKind, boolean>;
  medications: Medication[];
  doses: Dose[];
  appointments: Appointment[];
  /** First day of the last period, for the week kick counts start. */
  lmpDate: string;
  /** This phone's “new week” switch, which lives on the phone rather than with the others. */
  weekNudge?: boolean;
  now: Date;
};

/** A local date and clock time as a moment. */
function atLocal(day: string, hour: number, minute: number): Date {
  const at = localDate(day);
  at.setHours(hour, minute);
  return at;
}

/** "A", "A and B", "A, B and C", and past three "A, B, C and 2 more". */
export function nameList(names: string[]): string {
  if (names.length <= 1) return names.join('');
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
}

function vitaminReminders({ medications, doses, now }: ReminderPlanInput): PlannedReminder[] {
  const taken = new Set(doses.map((d) => doseKey(d.medication_id, d.day)));
  const today = localToday(now);
  const out: PlannedReminder[] = [];
  for (let i = 0; i < VITAMIN_DAYS_AHEAD; i++) {
    const day = addDays(today, i);
    const due = inDisplayOrder(dueOn(medications, day));
    for (const slot of TIMES) {
      const left = due.filter((m) => m.time_of_day === slot.key && !taken.has(doseKey(m.id, day)));
      if (left.length === 0) continue;
      const { hour, minute } = VITAMIN_TIMES[slot.key];
      const at = atLocal(day, hour, minute);
      if (at <= now) continue;
      out.push({
        key: `vitamins:${day}:${slot.key}`,
        kind: 'vitamins',
        title: `${slot.label} vitamins`,
        body: nameList(left.map((m) => m.name)),
        trigger: { type: 'date', at },
      });
    }
  }
  return out;
}

function waterReminders(): PlannedReminder[] {
  return WATER_HOURS.map((hour) => ({
    key: `water:${hour}`,
    kind: 'water',
    title: 'A glass of water?',
    body: 'Tap a glass on Today to count it.',
    trigger: { type: 'daily', hour, minute: 0 },
  }));
}

function kickReminders({ lmpDate, now }: ReminderPlanInput): PlannedReminder[] {
  if (gestationalAge(lmpDate, localToday(now)).weeks < KICKS_FROM_WEEK) return [];
  return [
    {
      key: 'kicks',
      kind: 'kicks',
      title: 'Kick count time',
      body: 'Settle somewhere comfortable and tap each kick on Today.',
      trigger: { type: 'daily', ...KICKS_TIME },
    },
  ];
}

function weekReminders({ lmpDate, now }: ReminderPlanInput): PlannedReminder[] {
  const { weeks } = gestationalAge(lmpDate, localToday(now));
  const out: PlannedReminder[] = [];
  for (let week = weeks + 1; week <= weeks + WEEK_NUDGES_AHEAD; week++) {
    if (week < FIRST_CARD_WEEK || week > LAST_CARD_WEEK) continue;
    const at = atLocal(addDays(lmpDate, week * 7), WEEK_NUDGE_TIME.hour, WEEK_NUDGE_TIME.minute);
    if (at <= now) continue;
    out.push({
      key: `week:${week}`,
      kind: 'week',
      title: `Week ${week} is here`,
      body: 'This week’s cards are ready on Today.',
      trigger: { type: 'date', at },
    });
  }
  return out;
}

function appointmentReminders({ appointments, now }: ReminderPlanInput): PlannedReminder[] {
  const today = localToday(now);
  const last = addDays(today, APPOINTMENT_DAYS_AHEAD);
  const out: PlannedReminder[] = [];
  for (const a of appointments) {
    if (a.appt_date < today || a.appt_date > last) continue;
    const [hour, minute] = a.appt_time ? a.appt_time.split(':').map(Number) : [];
    const start = a.appt_time ? atLocal(a.appt_date, hour, minute) : null;
    const body = `${a.title}${a.appt_time ? ` at ${clock(a.appt_time)}` : ''}${a.place ? ` · ${a.place}` : ''}`;

    // A day before: at the same time of day, or in the morning when no time is set.
    const dayBefore = addDays(a.appt_date, -1);
    const heraldedAt = start ? atLocal(dayBefore, hour, minute) : atLocal(dayBefore, UNTIMED_DAY_BEFORE_HOUR, 0);
    if (heraldedAt > now) {
      out.push({
        key: `appointments:${a.id}:day-before`,
        kind: 'appointments',
        title: 'Appointment tomorrow',
        body,
        trigger: { type: 'date', at: heraldedAt },
      });
    }

    // Two hours before, when there is a time to count back from.
    if (start) {
      const soonAt = new Date(start.getTime() - 2 * 60 * 60 * 1000);
      if (soonAt > now) {
        out.push({
          key: `appointments:${a.id}:two-hours`,
          kind: 'appointments',
          title: 'Appointment in 2 hours',
          body,
          trigger: { type: 'date', at: soonAt },
        });
      }
    }
  }
  return out;
}

/**
 * Every reminder this person should have, repeating ones first and then the
 * one-offs soonest first. Past the limit the furthest one-offs are dropped.
 */
export function planReminders(input: ReminderPlanInput): PlannedReminder[] {
  const { prefs } = input;
  const all = [
    ...(prefs.vitamins ? vitaminReminders(input) : []),
    ...(prefs.water ? waterReminders() : []),
    ...(prefs.kicks ? kickReminders(input) : []),
    ...(prefs.appointments ? appointmentReminders(input) : []),
    ...(input.weekNudge ? weekReminders(input) : []),
  ];
  const daily = all.filter((r) => r.trigger.type === 'daily');
  const dated = all
    .filter((r): r is PlannedReminder & { trigger: { type: 'date'; at: Date } } => r.trigger.type === 'date')
    .sort((a, b) => a.trigger.at.getTime() - b.trigger.at.getTime() || a.key.localeCompare(b.key));
  return [...daily, ...dated.slice(0, Math.max(0, MAX_REMINDERS - daily.length))];
}

/** Two plans with the same signature need no change on the phone. */
export function planSignature(plan: PlannedReminder[]): string {
  return JSON.stringify(
    plan.map((r) => [r.key, r.title, r.body, r.trigger.type === 'daily' ? [r.trigger.hour, r.trigger.minute] : r.trigger.at.getTime()]),
  );
}
