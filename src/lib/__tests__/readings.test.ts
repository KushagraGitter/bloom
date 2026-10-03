import {
  babySizeLine,
  countOf,
  formatCheckin,
  isSameLocalDay,
  latestOf,
  parseCheckin,
  parseSleepHours,
  startOfLocalDay,
  type Reading,
} from '../readings';

const reading = (type: Reading['type'], taken_at: string, value_num = 1): Reading => ({
  id: `${type}-${taken_at}`,
  pregnancy_id: 'p',
  type,
  value_num,
  value_num2: null,
  value_text: null,
  taken_at,
  logged_by: 'u',
});

describe('parseCheckin', () => {
  it('reads weight in kg, or lb converted to kg', () => {
    expect(parseCheckin('weight', '64,5', 'metric')).toEqual({ ok: true, value_num: 64.5, value_num2: null });
    expect(parseCheckin('weight', '142', 'imperial')).toEqual({ ok: true, value_num: 64.41, value_num2: null });
    expect(parseCheckin('weight', '', 'metric').ok).toBe(false);
    expect(parseCheckin('weight', '6450', 'metric').ok).toBe(false);
  });

  it('reads blood pressure as systolic over diastolic', () => {
    expect(parseCheckin('bp', '114/76', 'metric')).toEqual({ ok: true, value_num: 114, value_num2: 76 });
    expect(parseCheckin('bp', ' 120 - 80 ', 'metric')).toEqual({ ok: true, value_num: 120, value_num2: 80 });
    expect(parseCheckin('bp', '76/114', 'metric').ok).toBe(false);
    expect(parseCheckin('bp', '114', 'metric').ok).toBe(false);
  });

  it('reads blood sugar in mg/dL', () => {
    expect(parseCheckin('sugar', '88', 'metric')).toEqual({ ok: true, value_num: 88, value_num2: null });
    expect(parseCheckin('sugar', '5', 'metric').ok).toBe(false);
  });

  it('reads sleep in several formats', () => {
    expect(parseSleepHours('7')).toBe(7);
    expect(parseSleepHours('7.5')).toBe(7.5);
    expect(parseSleepHours('7h')).toBe(7);
    expect(parseSleepHours('7h 30m')).toBe(7.5);
    expect(parseSleepHours('7:45')).toBe(7.75);
    expect(parseSleepHours('7 30')).toBe(7.5);
    expect(parseSleepHours('7h 75m')).toBeNaN();
    expect(parseCheckin('sleep', '7h 20m', 'metric')).toEqual({ ok: true, value_num: 7.33, value_num2: null });
    expect(parseCheckin('sleep', '30', 'metric').ok).toBe(false);
  });
});

describe('formatCheckin', () => {
  it('shows each type with its unit', () => {
    expect(formatCheckin({ type: 'weight', value_num: 64.41, value_num2: null }, 'metric')).toEqual({ value: '64.4', unit: 'kg' });
    expect(formatCheckin({ type: 'weight', value_num: 64.41, value_num2: null }, 'imperial')).toEqual({ value: '142', unit: 'lb' });
    expect(formatCheckin({ type: 'bp', value_num: 112, value_num2: 74 }, 'metric')).toEqual({ value: '112/74', unit: '' });
    expect(formatCheckin({ type: 'sugar', value_num: 88, value_num2: null }, 'metric')).toEqual({ value: '88', unit: 'mg/dL' });
    expect(formatCheckin({ type: 'sleep', value_num: 7.5, value_num2: null }, 'metric')).toEqual({ value: '7h 30m', unit: '' });
    expect(formatCheckin({ type: 'sleep', value_num: 8, value_num2: null }, 'metric')).toEqual({ value: '8h', unit: '' });
  });

  it('copes with numerics that arrive as strings', () => {
    const r = { type: 'weight' as const, value_num: '64.20' as unknown as number, value_num2: null };
    expect(formatCheckin(r, 'metric').value).toBe('64.2');
  });
});

describe('today helpers', () => {
  it('counts taps and finds the newest of a type', () => {
    const rows = [
      reading('kicks', '2026-10-03T08:00:00Z'),
      reading('water', '2026-10-03T09:00:00Z'),
      reading('kicks', '2026-10-03T10:00:00Z'),
      reading('water', '2026-10-03T07:00:00Z'),
    ];
    expect(countOf(rows, 'kicks')).toBe(2);
    expect(countOf(rows, 'water')).toBe(2);
    expect(latestOf(rows, 'water')?.taken_at).toBe('2026-10-03T09:00:00Z');
    expect(latestOf(rows, 'weight')).toBeUndefined();
  });

  it('works out local midnight and same-day checks', () => {
    const now = new Date(2026, 9, 3, 15, 30);
    expect(new Date(startOfLocalDay(now)).getTime()).toBe(new Date(2026, 9, 3).getTime());
    expect(isSameLocalDay(new Date(2026, 9, 3, 0, 5).toISOString(), now)).toBe(true);
    expect(isSameLocalDay(new Date(2026, 9, 2, 23, 55).toISOString(), now)).toBe(false);
  });
});

describe('babySizeLine', () => {
  it('names a size from week 4, and talks about each baby for twins', () => {
    expect(babySizeLine(3)).toBeNull();
    expect(babySizeLine(24)).toBe('Baby is about the size of an ear of corn');
    expect(babySizeLine(42)).toBe('Baby is about the size of a watermelon');
    expect(babySizeLine(20, 2)).toBe('Each baby is about the size of a banana');
  });
});
