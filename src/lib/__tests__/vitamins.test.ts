import { addDays } from '@/lib/pregnancy';
import {
  DOSE_MAX,
  NAME_MAX,
  doseLine,
  dueOn,
  groupByTime,
  inDisplayOrder,
  newMedicationRow,
  streakOf,
  tickedBy,
  tintIndex,
  weekDots,
  type Dose,
  type Medication,
} from '@/lib/vitamins';

// A Saturday, so the week runs Monday 28 Sep to Sunday 4 Oct.
const TODAY = '2026-10-03';
const back = (n: number) => addDays(TODAY, -n);

function med(id: string, over: Partial<Medication> = {}): Medication {
  return {
    id,
    pregnancy_id: 'p1',
    name: id,
    dose: null,
    time_of_day: 'morning',
    start_date: back(30),
    end_date: null,
    created_at: '2026-09-01T08:00:00+00:00',
    ...over,
  };
}

function took(medicationId: string, ...days: string[]): Dose[] {
  return days.map((day) => ({ medication_id: medicationId, pregnancy_id: 'p1', day, taken_at: `${day}T08:00:00Z`, logged_by: 'me' }));
}

describe('dueOn', () => {
  it('includes a medicine from its first day to its last, inclusive', () => {
    const course = med('iron', { start_date: '2026-10-01', end_date: '2026-10-05' });
    expect(dueOn([course], '2026-09-30')).toEqual([]);
    expect(dueOn([course], '2026-10-01')).toEqual([course]);
    expect(dueOn([course], '2026-10-05')).toEqual([course]);
    expect(dueOn([course], '2026-10-06')).toEqual([]);
  });

  it('keeps an open-ended medicine due every day after it starts', () => {
    const ongoing = med('folic', { start_date: '2026-10-01' });
    expect(dueOn([ongoing], '2027-01-01')).toEqual([ongoing]);
  });
});

describe('ordering', () => {
  const morning = med('a', { time_of_day: 'morning', created_at: '2026-09-02T08:00:00+00:00' });
  const morningEarlier = med('b', { time_of_day: 'morning', created_at: '2026-09-01T08:00:00+00:00' });
  const evening = med('c', { time_of_day: 'evening' });
  const afternoon = med('d', { time_of_day: 'afternoon' });

  it('puts morning first and keeps the order they were added within a time', () => {
    expect(inDisplayOrder([evening, afternoon, morning, morningEarlier]).map((m) => m.id)).toEqual(['b', 'a', 'd', 'c']);
  });

  it('always returns all three times, so an empty one can say so', () => {
    const groups = groupByTime([evening]);
    expect(groups.map((g) => g.label)).toEqual(['Morning', 'Afternoon', 'Evening']);
    expect(groups.map((g) => g.items.length)).toEqual([0, 0, 1]);
  });
});

describe('streakOf', () => {
  it('counts the days in a row, ending today', () => {
    expect(streakOf([med('a')], took('a', TODAY, back(1), back(2)), TODAY)).toBe(3);
  });

  it('does not let an unfinished today break the run', () => {
    expect(streakOf([med('a')], took('a', back(1), back(2)), TODAY)).toBe(2);
  });

  it('ends at the first missed day', () => {
    expect(streakOf([med('a')], took('a', TODAY, back(1), back(3)), TODAY)).toBe(2);
  });

  it('needs everything due on a day to be taken', () => {
    const meds = [med('a'), med('b')];
    const doses = [...took('a', TODAY, back(1)), ...took('b', TODAY)];
    expect(streakOf(meds, doses, TODAY)).toBe(1);
  });

  it('is zero with nothing to take, or nothing taken', () => {
    expect(streakOf([], [], TODAY)).toBe(0);
    expect(streakOf([med('a')], [], TODAY)).toBe(0);
  });

  it('does not let a medicine added today spoil earlier days', () => {
    const meds = [med('a', { start_date: back(10) }), med('b', { start_date: TODAY })];
    expect(streakOf(meds, took('a', back(1), back(2), back(3), back(4)), TODAY)).toBe(4);
  });

  it('skips days when nothing was due instead of ending the run', () => {
    // `old` was a course that finished 3 days ago; `new` began today.
    const old = med('old', { start_date: back(10), end_date: back(3) });
    const fresh = med('new', { start_date: TODAY });
    const doses = [...took('old', ...[3, 4, 5, 6, 7, 8, 9, 10].map(back)), ...took('new', TODAY)];
    expect(streakOf([old, fresh], doses, TODAY)).toBe(9);
  });
});

describe('weekDots', () => {
  it('runs Monday to Sunday with today marked', () => {
    const dots = weekDots([med('a')], [], TODAY);
    expect(dots.map((d) => d.label).join('')).toBe('MTWTFSS');
    expect(dots[0].day).toBe('2026-09-28');
    expect(dots[6].day).toBe('2026-10-04');
    expect(dots.filter((d) => d.isToday).map((d) => d.day)).toEqual([TODAY]);
  });

  it('fills the days where everything was taken, and never a day to come', () => {
    const dots = weekDots([med('a')], took('a', '2026-09-28', '2026-09-29', '2026-10-01', TODAY, '2026-10-04'), TODAY);
    expect(dots.map((d) => d.done)).toEqual([true, true, false, true, false, true, false]);
  });

  it('starts the week on Monday when today is a Monday or a Sunday', () => {
    expect(weekDots([], [], '2026-09-28')[0].day).toBe('2026-09-28');
    expect(weekDots([], [], '2026-10-04')[0].day).toBe('2026-09-28');
  });
});

describe('labels', () => {
  it('falls back to "As prescribed" when no dose was typed', () => {
    expect(doseLine({ dose: null })).toBe('As prescribed');
    expect(doseLine({ dose: '   ' })).toBe('As prescribed');
    expect(doseLine({ dose: '1 tablet · with lunch' })).toBe('1 tablet · with lunch');
  });

  it('names who ticked a dose, unless it was the person looking', () => {
    const members = [
      { user_id: 'me', name: 'Ananya Rao' },
      { user_id: 'kush', name: 'Kush S' },
    ];
    expect(tickedBy({ logged_by: 'me' }, 'me', members)).toBeNull();
    expect(tickedBy({ logged_by: 'kush' }, 'me', members)).toBe('Kush');
    expect(tickedBy({ logged_by: 'me' }, 'kush', members)).toBe('Ananya');
    expect(tickedBy({ logged_by: 'stranger' }, 'me', members)).toBe('Partner');
    expect(tickedBy({ logged_by: null }, 'me', members)).toBe('Partner');
    expect(tickedBy({ logged_by: 'kush' }, 'me', undefined)).toBe('Partner');
  });

  it('picks the same pill colour for a medicine every time', () => {
    expect(tintIndex('3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90', 5)).toBe(tintIndex('3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90', 5));
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
      const i = tintIndex(id, 5);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(5);
    }
  });
});

describe('newMedicationRow', () => {
  it('builds a row starting today', () => {
    expect(newMedicationRow({ name: ' Iron ', dose: ' 1 tablet after lunch ', time: 'afternoon' }, TODAY)).toEqual({
      ok: true,
      row: { name: 'Iron', dose: '1 tablet after lunch', time_of_day: 'afternoon', start_date: TODAY },
    });
  });

  it('saves a blank dose as nothing, not an empty string', () => {
    const parsed = newMedicationRow({ name: 'Folic acid', dose: '  ', time: 'morning' }, TODAY);
    expect(parsed.ok && parsed.row.dose).toBeNull();
  });

  it('asks for a name', () => {
    expect(newMedicationRow({ name: '   ', dose: '', time: 'morning' }, TODAY)).toEqual({ ok: false, error: 'Enter the medicine’s name.' });
  });

  it('keeps names and doses within what the database accepts', () => {
    expect(newMedicationRow({ name: 'x'.repeat(NAME_MAX + 1), dose: '', time: 'morning' }, TODAY).ok).toBe(false);
    expect(newMedicationRow({ name: 'x'.repeat(NAME_MAX), dose: 'y'.repeat(DOSE_MAX + 1), time: 'morning' }, TODAY).ok).toBe(false);
    expect(newMedicationRow({ name: 'x'.repeat(NAME_MAX), dose: 'y'.repeat(DOSE_MAX), time: 'morning' }, TODAY).ok).toBe(true);
  });
});
