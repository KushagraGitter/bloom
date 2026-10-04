import { buildChart, journeyFill, kicksAverage, lastSevenDays, sleepAverage, weekOf, weekOnDay } from '@/lib/progress';
import type { Reading } from '@/lib/readings';

const LMP = '2026-04-15';

let n = 0;
/** A reading taken at noon local time on `day`. */
function reading(type: Reading['type'], day: string, value: number, extra: Partial<Reading> = {}): Reading {
  const [y, m, d] = day.split('-').map(Number);
  return {
    id: `r${++n}`,
    pregnancy_id: 'p1',
    type,
    value_num: value,
    value_num2: null,
    value_text: null,
    taken_at: new Date(y, m - 1, d, 12).toISOString(),
    logged_by: 'me',
    ...extra,
  };
}

describe('weekOf', () => {
  it('counts completed weeks from the LMP on the local day', () => {
    expect(weekOnDay(LMP, '2026-04-15')).toBe(0);
    expect(weekOnDay(LMP, '2026-04-21')).toBe(0);
    expect(weekOnDay(LMP, '2026-04-22')).toBe(1);
    expect(weekOnDay(LMP, '2026-10-03')).toBe(24);
    expect(weekOnDay(LMP, '2026-04-01')).toBe(0);
    expect(weekOf(LMP, reading('weight', '2026-10-03', 64).taken_at)).toBe(24);
    // Just before local midnight still counts on that day.
    expect(weekOf(LMP, new Date(2026, 3, 21, 23, 59).toISOString())).toBe(0);
  });
});

describe('buildChart', () => {
  it('averages each week and keeps the latest seven weeks that have readings', () => {
    const rows = [
      reading('weight', '2026-05-01', 58), // week 2, dropped: 8 weeks have readings
      reading('weight', '2026-05-20', 59), // week 5
      reading('weight', '2026-05-21', 60), // week 5
      reading('weight', '2026-06-10', 60.4), // week 8
      reading('weight', '2026-07-01', 61), // week 11
      reading('weight', '2026-07-20', 61.6), // week 13
      reading('weight', '2026-08-05', 62.2), // week 16
      reading('weight', '2026-09-01', 63), // week 19
      reading('weight', '2026-10-02', 64.24), // week 24
      reading('bp', '2026-10-02', 112, { value_num2: 74 }),
    ];
    const chart = buildChart(rows, 'weight', LMP, 'metric');
    expect(chart.title).toBe('Weight (kg)');
    expect(chart.bars.map((b) => [b.week, b.value])).toEqual([
      [5, 59.5],
      [8, 60.4],
      [11, 61],
      [13, 61.6],
      [16, 62.2],
      [19, 63],
      [24, 64.2],
    ]);
    expect(chart.bars[0].height).toBeCloseTo(0.15);
    expect(chart.bars[6].height).toBeCloseTo(1);
    expect(chart.bars.map((b) => b.label)).toContain('59.5');
    expect(chart.note).toBe('+4.7 kg since week 5');
  });

  it('shows weight in pounds for imperial', () => {
    const rows = [reading('weight', '2026-09-01', 60), reading('weight', '2026-10-02', 59)];
    const chart = buildChart(rows, 'weight', LMP, 'imperial');
    expect(chart.title).toBe('Weight (lb)');
    expect(chart.bars.map((b) => b.value)).toEqual([132.3, 130.1]);
    expect(chart.note).toBe('−2.2 lb since week 19');
  });

  it('says no change when the first and last week match, and gives equal weeks a middling bar', () => {
    const chart = buildChart([reading('weight', '2026-09-01', 60), reading('weight', '2026-10-02', 60)], 'weight', LMP, 'metric');
    expect(chart.note).toBe('±0 kg since week 19');
    expect(chart.bars.map((b) => b.height)).toEqual([0.6, 0.6]);
  });

  it('has no note for a single week of weight', () => {
    expect(buildChart([reading('weight', '2026-10-02', 60)], 'weight', LMP, 'metric').note).toBeNull();
  });

  it('charts the top BP number', () => {
    const rows = [reading('bp', '2026-09-30', 110, { value_num2: 70 }), reading('bp', '2026-10-02', 115, { value_num2: 80 })];
    const chart = buildChart(rows, 'bp', LMP, 'metric');
    expect(chart.bars.map((b) => [b.week, b.value])).toEqual([[24, 113]]);
    expect(chart.note).toBe('The top number, averaged over each week');
  });

  it('charts fasting sugar only', () => {
    const rows = [
      reading('sugar', '2026-10-01', 84, { value_text: 'Fasting' }),
      reading('sugar', '2026-10-02', 140, { value_text: 'After a meal' }),
      reading('sugar', '2026-10-02', 88, { value_text: 'Fasting' }),
    ];
    expect(buildChart(rows, 'sugar', LMP, 'metric').bars.map((b) => b.value)).toEqual([86]);
    expect(buildChart([rows[1]], 'sugar', LMP, 'metric').bars).toEqual([]);
  });

  it('is empty, with a hint, when nothing is logged', () => {
    const chart = buildChart([], 'bp', LMP, 'metric');
    expect(chart.bars).toEqual([]);
    expect(chart.note).toBeNull();
    expect(chart.empty).toMatch(/blood pressure/);
  });
});

describe('averages', () => {
  it('lists the last seven days, newest first', () => {
    expect(lastSevenDays('2026-10-03')).toEqual([
      '2026-10-03',
      '2026-10-02',
      '2026-10-01',
      '2026-09-30',
      '2026-09-29',
      '2026-09-28',
      '2026-09-27',
    ]);
  });

  it('averages kicks over the days that have any', () => {
    expect(kicksAverage([10, 0, 7, 0, 0, 0, 0])).toBe(9);
    expect(kicksAverage([0, 0, 0, 0, 0, 0, 0])).toBeNull();
    expect(kicksAverage([3, 4, 4, 4, 4, 4, 4])).toBe(4);
  });

  it('averages sleep over the last seven days only', () => {
    const rows = [
      reading('sleep', '2026-10-03', 7),
      reading('sleep', '2026-09-27', 7.25),
      reading('sleep', '2026-09-26', 1), // eight days ago
      reading('weight', '2026-10-02', 64),
    ];
    expect(sleepAverage(rows, '2026-10-03')).toBe('7h 08m');
    expect(sleepAverage([rows[2]], '2026-10-03')).toBeNull();
  });
});

describe('journeyFill', () => {
  it('fills trimesters up to now', () => {
    expect(journeyFill(0)).toEqual([0, 0, 0]);
    expect(journeyFill(7 * 7)).toEqual([0.5, 0, 0]);
    expect(journeyFill(14 * 7)).toEqual([1, 0, 0]);
    expect(journeyFill(21 * 7)).toEqual([1, 0.5, 0]);
    expect(journeyFill(34 * 7)).toEqual([1, 1, 0.5]);
    expect(journeyFill(43 * 7)).toEqual([1, 1, 1]);
  });
});
