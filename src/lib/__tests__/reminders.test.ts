import { clock, type Appointment } from '@/lib/appointments';
import type { ReminderKind } from '@/lib/onboarding';
import { addDays } from '@/lib/pregnancy';
import {
  APPOINTMENT_DAYS_AHEAD,
  MAX_REMINDERS,
  VITAMIN_DAYS_AHEAD,
  WATER_HOURS,
  nameList,
  planReminders,
  planSignature,
  type PlannedReminder,
  type ReminderPlanInput,
} from '@/lib/reminders';
import type { Dose, Medication } from '@/lib/vitamins';

// Saturday 3 October 2026, ten in the morning on the phone's clock.
const TODAY = '2026-10-03';
const NOW = new Date(2026, 9, 3, 10, 0);
const at = (day: string, hour: number, minute = 0) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, hour, minute);
};

const med = (id: string, name: string, time_of_day: Medication['time_of_day'], over: Partial<Medication> = {}): Medication => ({
  id,
  pregnancy_id: 'p1',
  name,
  dose: null,
  time_of_day,
  start_date: '2026-09-01',
  end_date: null,
  created_at: '2026-09-01T08:00:00Z',
  ...over,
});

const dose = (medication_id: string, day: string): Dose => ({
  medication_id,
  pregnancy_id: 'p1',
  day,
  taken_at: `${day}T08:00:00Z`,
  logged_by: 'me',
});

const appt = (id: string, appt_date: string, appt_time: string | null, over: Partial<Appointment> = {}): Appointment => ({
  id,
  pregnancy_id: 'p1',
  title: 'Growth scan',
  appt_date,
  appt_time,
  place: null,
  ...over,
});

const off: Record<ReminderKind, boolean> = { vitamins: false, water: false, kicks: false, appointments: false };

/** Everything switched off, twenty weeks along, with nothing to remind about. */
const base: ReminderPlanInput = {
  prefs: off,
  medications: [],
  doses: [],
  appointments: [],
  lmpDate: addDays(TODAY, -20 * 7),
  now: NOW,
};

/** The plan with just `kind` switched on, so a test sees only what it is about. */
const planFor = (kind: ReminderKind, over: Partial<ReminderPlanInput> = {}) =>
  planReminders({ ...base, prefs: { ...off, [kind]: true }, ...over });

const dateOf = (r: PlannedReminder) => (r.trigger.type === 'date' ? r.trigger.at : undefined);

describe('nameList', () => {
  it('reads like a sentence, and stops at three names', () => {
    expect(nameList([])).toBe('');
    expect(nameList(['Folic acid'])).toBe('Folic acid');
    expect(nameList(['Folic acid', 'Iron'])).toBe('Folic acid and Iron');
    expect(nameList(['Folic acid', 'Iron', 'Calcium'])).toBe('Folic acid, Iron and Calcium');
    expect(nameList(['A', 'B', 'C', 'D'])).toBe('A, B, C and 1 more');
    expect(nameList(['A', 'B', 'C', 'D', 'E', 'F'])).toBe('A, B, C and 3 more');
  });
});

describe('planReminders', () => {
  it('has nothing to say when every switch is off', () => {
    const everything = {
      medications: [med('a', 'Folic acid', 'morning')],
      appointments: [appt('x', addDays(TODAY, 3), '10:00')],
      lmpDate: addDays(TODAY, -30 * 7),
    };
    expect(planReminders({ ...base, ...everything })).toEqual([]);
  });

  describe('water', () => {
    it('repeats every day, every two hours from 9 am to 7 pm', () => {
      const plan = planFor('water');
      expect(plan).toHaveLength(WATER_HOURS.length);
      expect(plan.map((r) => r.trigger)).toEqual([
        { type: 'daily', hour: 9, minute: 0 },
        { type: 'daily', hour: 11, minute: 0 },
        { type: 'daily', hour: 13, minute: 0 },
        { type: 'daily', hour: 15, minute: 0 },
        { type: 'daily', hour: 17, minute: 0 },
        { type: 'daily', hour: 19, minute: 0 },
      ]);
      expect(plan[0]).toMatchObject({ key: 'water:9', kind: 'water', title: 'A glass of water?' });
    });
  });

  describe('kick counts', () => {
    it('start in week 28, not a day before', () => {
      // 27 weeks and 6 days along is not yet week 28; 28 weeks exactly is.
      const dayBefore = planFor('kicks', { lmpDate: addDays(TODAY, -(28 * 7 - 1)) });
      expect(dayBefore).toEqual([]);

      const plan = planFor('kicks', { lmpDate: addDays(TODAY, -28 * 7) });
      expect(plan).toEqual([
        expect.objectContaining({
          key: 'kicks',
          kind: 'kicks',
          title: 'Kick count time',
          trigger: { type: 'daily', hour: 20, minute: 0 },
        }),
      ]);
    });

    it('carry on to the end of the pregnancy', () => {
      expect(planFor('kicks', { lmpDate: addDays(TODAY, -39 * 7) })).toHaveLength(1);
    });
  });

  describe('vitamins', () => {
    const meds = [med('a', 'Folic acid', 'morning'), med('b', 'Iron', 'evening')];

    it('is one reminder for each part of the day that still has something to take, for the next week', () => {
      const plan = planFor('vitamins', { medications: meds });

      // This morning's 8 am has gone by; each of the six days after has both.
      expect(plan).toHaveLength(1 + (VITAMIN_DAYS_AHEAD - 1) * 2);
      expect(plan[0]).toMatchObject({
        key: 'vitamins:2026-10-03:evening',
        kind: 'vitamins',
        title: 'Evening vitamins',
        body: 'Iron',
      });
      expect(dateOf(plan[0])).toEqual(at('2026-10-03', 21));
      expect(plan[1]).toMatchObject({ key: 'vitamins:2026-10-04:morning', title: 'Morning vitamins', body: 'Folic acid' });
      expect(dateOf(plan[1])).toEqual(at('2026-10-04', 8));
      expect(plan[plan.length - 1].key).toBe('vitamins:2026-10-09:evening');
    });

    it('puts the afternoon at 2 pm', () => {
      const plan = planFor('vitamins', { medications: [med('c', 'Calcium', 'afternoon')] });
      expect(plan[0]).toMatchObject({ key: 'vitamins:2026-10-03:afternoon', title: 'Afternoon vitamins' });
      expect(dateOf(plan[0])).toEqual(at('2026-10-03', 14));
    });

    it('names every medicine due at that time, in the order Today lists them', () => {
      const plan = planFor('vitamins', {
        medications: [
          med('z', 'Omega 3', 'morning', { created_at: '2026-09-02T08:00:00Z' }),
          med('a', 'Folic acid', 'morning', { created_at: '2026-09-01T08:00:00Z' }),
          med('m', 'Vitamin D', 'morning', { created_at: '2026-09-03T08:00:00Z' }),
        ],
      });
      expect(plan[0].body).toBe('Folic acid, Omega 3 and Vitamin D');
    });

    it('does not repeat a dose that has already been ticked, whoever ticked it', () => {
      const plan = planFor('vitamins', {
        medications: [...meds, med('c', 'Calcium', 'evening')],
        doses: [dose('b', TODAY)],
      });
      // Iron is done for today, but Calcium is not, and tomorrow is a new day.
      expect(plan[0]).toMatchObject({ key: 'vitamins:2026-10-03:evening', body: 'Calcium' });
      expect(plan.find((r) => r.key === 'vitamins:2026-10-04:evening')?.body).toBe('Iron and Calcium');
    });

    it('stays quiet for a part of the day once everything in it is ticked', () => {
      const plan = planFor('vitamins', { medications: meds, doses: [dose('b', TODAY)] });
      expect(plan.map((r) => r.key)).not.toContain('vitamins:2026-10-03:evening');
      expect(plan[0].key).toBe('vitamins:2026-10-04:morning');
    });

    it('leaves out days before a medicine starts and after it ends', () => {
      const plan = planFor('vitamins', {
        medications: [med('a', 'Folic acid', 'morning', { start_date: '2026-10-05', end_date: '2026-10-07' })],
      });
      expect(plan.map((r) => r.key)).toEqual([
        'vitamins:2026-10-05:morning',
        'vitamins:2026-10-06:morning',
        'vitamins:2026-10-07:morning',
      ]);
    });

    it('skips this morning once it is 8 am, and the moment it is exactly then', () => {
      const asItHappens = planFor('vitamins', { medications: meds, now: at(TODAY, 8, 0) });
      expect(asItHappens[0].key).toBe('vitamins:2026-10-03:evening');
      const justBefore = planFor('vitamins', { medications: meds, now: at(TODAY, 7, 59) });
      expect(justBefore[0].key).toBe('vitamins:2026-10-03:morning');
    });

    it('has nothing to say with no medicines', () => {
      expect(planFor('vitamins')).toEqual([]);
    });
  });

  describe('appointments', () => {
    it('reminds a day before, at the same time of day, and again two hours before', () => {
      const plan = planFor('appointments', {
        appointments: [appt('x', '2026-10-08', '14:30', { place: 'City Hospital' })],
      });
      const body = `Growth scan at ${clock('14:30')} · City Hospital`;
      expect(plan).toEqual([
        { key: 'appointments:x:day-before', kind: 'appointments', title: 'Appointment tomorrow', body, trigger: { type: 'date', at: at('2026-10-07', 14, 30) } },
        { key: 'appointments:x:two-hours', kind: 'appointments', title: 'Appointment in 2 hours', body, trigger: { type: 'date', at: at('2026-10-08', 12, 30) } },
      ]);
    });

    it('announces one with no time at 9 am the day before, and has no two-hour reminder', () => {
      const plan = planFor('appointments', { appointments: [appt('x', '2026-10-08', null)] });
      expect(plan).toEqual([
        expect.objectContaining({ key: 'appointments:x:day-before', title: 'Appointment tomorrow', body: 'Growth scan' }),
      ]);
      expect(dateOf(plan[0])).toEqual(at('2026-10-07', 9));
    });

    it('counts two hours back across midnight', () => {
      const plan = planFor('appointments', { appointments: [appt('x', '2026-10-08', '01:30')] });
      const soon = plan.find((r) => r.key === 'appointments:x:two-hours');
      expect(dateOf(soon!)).toEqual(at('2026-10-07', 23, 30));
    });

    it('leaves out a reminder whose time has already gone by', () => {
      // 10 am now. Tomorrow 9 am: the day-before moment (9 am today) has gone, the two-hour one has not.
      const tomorrow = planFor('appointments', { appointments: [appt('x', '2026-10-04', '09:00')] });
      expect(tomorrow.map((r) => r.key)).toEqual(['appointments:x:two-hours']);

      // Today 1 pm: only the two-hour reminder (11 am) is still ahead.
      const later = planFor('appointments', { appointments: [appt('y', TODAY, '13:00')] });
      expect(later.map((r) => r.key)).toEqual(['appointments:y:two-hours']);

      // Today 11 am: both have gone by.
      expect(planFor('appointments', { appointments: [appt('z', TODAY, '11:00')] })).toEqual([]);
    });

    it('leaves out appointments that are over, or more than two months away', () => {
      const plan = planFor('appointments', {
        appointments: [
          appt('past', addDays(TODAY, -1), '09:00'),
          appt('edge', addDays(TODAY, APPOINTMENT_DAYS_AHEAD), '09:00'),
          appt('far', addDays(TODAY, APPOINTMENT_DAYS_AHEAD + 1), '09:00'),
        ],
      });
      expect(plan.map((r) => r.key)).toEqual(['appointments:edge:day-before', 'appointments:edge:two-hours']);
    });

    it('lists the soonest first, whatever order they come in', () => {
      const plan = planFor('appointments', {
        appointments: [appt('late', '2026-10-20', '09:00'), appt('soon', '2026-10-06', '09:00')],
      });
      expect(plan.map((r) => r.key)).toEqual([
        'appointments:soon:day-before',
        'appointments:soon:two-hours',
        'appointments:late:day-before',
        'appointments:late:two-hours',
      ]);
    });
  });

  describe('everything together', () => {
    it('puts the repeating reminders first, then one-offs from the soonest', () => {
      const plan = planReminders({
        ...base,
        prefs: { vitamins: true, water: true, kicks: true, appointments: true },
        medications: [med('a', 'Folic acid', 'morning')],
        appointments: [appt('x', '2026-10-05', '09:00')],
        lmpDate: addDays(TODAY, -30 * 7),
      });
      const kinds = plan.map((r) => r.kind);
      expect(kinds.slice(0, 7)).toEqual(['water', 'water', 'water', 'water', 'water', 'water', 'kicks']);
      const times = plan.slice(7).map((r) => dateOf(r)!.getTime());
      expect(times.length).toBeGreaterThan(0);
      expect(times).toEqual([...times].sort((a, b) => a - b));
    });

    it('keeps within the limit by dropping the furthest one-offs', () => {
      // 40 days of appointments is 80 one-offs; with the six water reminders only 54 fit.
      const appointments = Array.from({ length: 40 }, (_, i) => appt(`a${String(i).padStart(2, '0')}`, addDays(TODAY, i + 1), '10:00'));
      const plan = planReminders({ ...base, prefs: { ...off, water: true, appointments: true }, appointments });

      expect(plan).toHaveLength(MAX_REMINDERS);
      expect(plan.slice(0, 6).every((r) => r.kind === 'water')).toBe(true);
      const times = plan.slice(6).map((r) => dateOf(r)!.getTime());
      expect(times).toEqual([...times].sort((a, b) => a - b));
      expect(plan.some((r) => r.key.startsWith('appointments:a01:'))).toBe(true);
      expect(plan.some((r) => r.key.startsWith('appointments:a39:'))).toBe(false);
    });

    it('does not depend on the order the medicines arrive in', () => {
      const input: ReminderPlanInput = {
        ...base,
        prefs: { vitamins: true, water: true, kicks: true, appointments: true },
        medications: [med('a', 'Folic acid', 'morning'), med('b', 'Iron', 'evening')],
        appointments: [appt('x', '2026-10-05', '09:00')],
        lmpDate: addDays(TODAY, -30 * 7),
      };
      expect(planReminders(input)).toEqual(planReminders({ ...input, medications: [...input.medications].reverse() }));
    });
  });
});

describe('planSignature', () => {
  const input: ReminderPlanInput = {
    ...base,
    prefs: { ...off, vitamins: true, water: true },
    medications: [med('a', 'Folic acid', 'morning'), med('b', 'Iron', 'evening')],
  };

  const signature = planSignature(planReminders(input));
  const changed = (over: Partial<ReminderPlanInput>) => planSignature(planReminders({ ...input, ...over }));

  it('changes when anything the phone would show changes', () => {
    expect(changed({ doses: [dose('b', TODAY)] })).not.toBe(signature);
    expect(changed({ medications: [med('a', 'Folate', 'morning'), med('b', 'Iron', 'evening')] })).not.toBe(signature);
    expect(changed({ prefs: { ...input.prefs, water: false } })).not.toBe(signature);
    expect(changed({ now: at('2026-10-04', 10) })).not.toBe(signature);
  });

  it('stays the same as time passes when nothing coming up has changed', () => {
    expect(changed({})).toBe(signature);
    // Nothing is due between noon and 9 pm, so those two moments plan the same.
    expect(changed({ now: at(TODAY, 12) })).toBe(changed({ now: at(TODAY, 15, 30) }));
  });

  it('tells a repeating reminder from a one-off at the same time of day', () => {
    const daily: PlannedReminder = { key: 'k', kind: 'water', title: 't', body: 'b', trigger: { type: 'daily', hour: 9, minute: 0 } };
    const once: PlannedReminder = { ...daily, trigger: { type: 'date', at: at(TODAY, 9) } };
    expect(planSignature([daily])).not.toBe(planSignature([once]));
  });
});
