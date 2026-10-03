import {
  addDays,
  daysBetween,
  dueDateFromLmp,
  gestationalAge,
  lmpFrom,
  localToday,
  trimesterForWeek,
} from '../pregnancy';

describe('date helpers', () => {
  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('is not shifted by DST changes', () => {
    // Europe and US clocks change in late March / early November.
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
    expect(daysBetween('2026-10-25', '2026-11-08')).toBe(14);
  });

  it('rejects malformed and impossible dates', () => {
    expect(() => addDays('2026-2-1', 1)).toThrow();
    expect(() => addDays('2026-02-30', 1)).toThrow();
    expect(() => addDays('2026-13-01', 1)).toThrow();
    expect(() => addDays('2026-00-01', 1)).toThrow();
    expect(() => addDays('2026-01-00', 1)).toThrow();
  });

  it('formats the local date with zero padding', () => {
    expect(localToday(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('lmpFrom', () => {
  it('passes an LMP date through', () => {
    expect(lmpFrom({ method: 'lmp', lmpDate: '2026-04-15' })).toBe('2026-04-15');
  });

  it('counts 280 days back from a due date', () => {
    expect(lmpFrom({ method: 'due', dueDate: '2027-01-20' })).toBe('2026-04-15');
  });

  it('dates IVF transfers by embryo age', () => {
    // Day-5 transfer: due date is transfer + 261 days.
    const lmp5 = lmpFrom({ method: 'ivf', transferDate: '2026-05-04', embryoDay: 5 });
    expect(lmp5).toBe('2026-04-15');
    expect(daysBetween('2026-05-04', dueDateFromLmp(lmp5))).toBe(261);
    // Day-3 transfer: transfer + 263 days.
    const lmp3 = lmpFrom({ method: 'ivf', transferDate: '2026-05-02', embryoDay: 3 });
    expect(lmp3).toBe('2026-04-15');
    expect(daysBetween('2026-05-02', dueDateFromLmp(lmp3))).toBe(263);
  });
});

describe('gestationalAge', () => {
  const lmp = '2026-04-15';

  it('matches the design example: 24 weeks, day 3, 16 weeks to go', () => {
    const ga = gestationalAge(lmp, addDays(lmp, 24 * 7 + 3));
    expect(ga).toMatchObject({ weeks: 24, days: 3, trimester: 2 });
    expect(Math.floor(ga.daysToGo / 7)).toBe(15);
    expect(Math.ceil(ga.daysToGo / 7)).toBe(16);
  });

  it('is 0w0d on the LMP date and clamps dates before it', () => {
    expect(gestationalAge(lmp, lmp)).toMatchObject({ weeks: 0, days: 0, progress: 0 });
    expect(gestationalAge(lmp, '2026-04-01')).toMatchObject({ weeks: 0, days: 0, daysToGo: 280 });
  });

  it('reaches 40 weeks on the due date and does not go past 100%', () => {
    expect(gestationalAge(lmp, dueDateFromLmp(lmp))).toMatchObject({ weeks: 40, days: 0, daysToGo: 0, progress: 1 });
    expect(gestationalAge(lmp, addDays(lmp, 290))).toMatchObject({ weeks: 41, daysToGo: 0, progress: 1 });
  });
});

describe('trimesterForWeek', () => {
  it.each([
    [0, 1],
    [13, 1],
    [14, 2],
    [27, 2],
    [28, 3],
    [41, 3],
  ])('week %i is trimester %i', (week, tri) => {
    expect(trimesterForWeek(week)).toBe(tri);
  });
});
