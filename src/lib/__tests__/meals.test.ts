import {
  AMOUNT_MAX,
  CRAVING_MAX,
  DEFAULT_GOALS,
  FOOD_MAX,
  NOTE_MAX,
  amountsLine,
  barsFor,
  cravingFromItem,
  dayHeading,
  formatAmount,
  goalsFromItems,
  goalsInput,
  guessSlot,
  hasNutrients,
  loggedBy,
  mealFromItem,
  mealsOn,
  newCraving,
  newGoals,
  newMealData,
  parseAmount,
  parseCraving,
  parseGoals,
  parseMeal,
  suggestSlot,
  tileTime,
  totalsOf,
  type Amounts,
  type Meal,
  type MealData,
  type NewMeal,
  type Slot,
} from '../meals';

const meal = (over: Partial<Meal> = {}): Meal => ({
  id: 'm1',
  updatedAt: '2026-10-03T08:00:00.000Z',
  day: '2026-10-03',
  slot: 'breakfast',
  time: '08:30',
  food: 'Poha with peanuts',
  note: null,
  amounts: {},
  by: null,
  ...over,
});

const ids = (meals: Meal[]) => meals.map((m) => m.id);

describe('guessSlot', () => {
  it.each([
    ['00:15', 'breakfast'],
    ['07:59', 'breakfast'],
    ['10:59', 'breakfast'],
    ['11:00', 'lunch'],
    ['15:59', 'lunch'],
    ['16:00', 'snack'],
    ['17:59', 'snack'],
    ['18:00', 'dinner'],
    ['23:30', 'dinner'],
  ] as [string, Slot][])('says %s is %s', (time, slot) => {
    expect(guessSlot(time)).toBe(slot);
  });
});

describe('suggestSlot', () => {
  it('suggests the usual meal for the time of day', () => {
    expect(suggestSlot([], '08:00')).toBe('breakfast');
    expect(suggestSlot([], '12:00')).toBe('lunch');
    expect(suggestSlot([], '16:30')).toBe('snack');
    expect(suggestSlot([], '20:00')).toBe('dinner');
  });

  it('suggests a snack once that meal is already logged', () => {
    expect(suggestSlot([meal({ slot: 'breakfast' })], '09:00')).toBe('snack');
    expect(suggestSlot([meal({ slot: 'lunch' })], '13:50')).toBe('snack');
    expect(suggestSlot([meal({ slot: 'dinner' })], '20:00')).toBe('snack');
  });

  it('is not put off by meals in other slots, and a snack can repeat', () => {
    expect(suggestSlot([meal({ slot: 'breakfast' })], '12:00')).toBe('lunch');
    expect(suggestSlot([meal({ slot: 'snack' })], '16:30')).toBe('snack');
  });
});

describe('parseAmount', () => {
  it.each([
    ['12', 12],
    ['0.5', 0.5],
    ['0,5', 0.5],
    [' 7 ', 7],
    ['.5', 0.5],
    ['5.', 5],
    ['0', 0],
    [String(AMOUNT_MAX), AMOUNT_MAX],
  ])('reads %p as %p', (text, value) => {
    expect(parseAmount(text)).toEqual({ ok: true, value });
  });

  it('treats nothing typed as not given', () => {
    expect(parseAmount('')).toEqual({ ok: true, value: null });
    expect(parseAmount('   ')).toEqual({ ok: true, value: null });
  });

  it.each(['-3', '1e3', '12abc', '1.2.3', 'twelve', '1,000.5', String(AMOUNT_MAX + 1)])('rejects %p', (text) => {
    expect(parseAmount(text)).toEqual({ ok: false });
  });
});

describe('formatAmount', () => {
  it('shows whole numbers whole and anything else to one decimal', () => {
    expect(formatAmount(14)).toBe('14');
    expect(formatAmount(14.5)).toBe('14.5');
    expect(formatAmount(14.04)).toBe('14');
    expect(formatAmount(4.2)).toBe('4.2');
    expect(formatAmount(4.26)).toBe('4.3');
    expect(formatAmount(71.94)).toBe('71.9');
    expect(formatAmount(0.1 + 0.2)).toBe('0.3');
    expect(formatAmount(1000)).toBe('1000');
  });
});

describe('totals and bars', () => {
  const lunch = meal({ id: 'a', amounts: { kcal: 530, protein: 18, iron: 4.2, fibre: 6 } });
  const snack = meal({ id: 'b', slot: 'snack', amounts: { protein: 30, iron: 10.3, calcium: 720 } });
  const bare = meal({ id: 'c' });

  it('adds up each nutrient across the meals, leaving out calories and what was not given', () => {
    expect(totalsOf([lunch, snack, bare])).toEqual({ protein: 48, iron: 14.5, calcium: 720, folate: 0, fibre: 6 });
    expect(totalsOf([])).toEqual({ protein: 0, iron: 0, calcium: 0, folate: 0, fibre: 0 });
  });

  it('knows whether there is anything to add up', () => {
    expect(hasNutrients([])).toBe(false);
    expect(hasNutrients([bare])).toBe(false);
    expect(hasNutrients([meal({ amounts: { kcal: 300 } })])).toBe(false);
    expect(hasNutrients([bare, snack])).toBe(true);
    expect(hasNutrients([meal({ amounts: { iron: 0 } })])).toBe(true);
  });

  it('makes a bar per nutrient against the goals, in the design’s order', () => {
    const bars = barsFor([lunch, snack], DEFAULT_GOALS);
    expect(bars.map((b) => b.name)).toEqual(['Protein', 'Iron', 'Calcium', 'Folate', 'Fibre']);
    expect(bars.map((b) => b.label)).toEqual(['48 / 71 g', '14.5 / 27 mg', '720 / 1000 mg', '0 / 600 mcg', '6 / 28 g']);
    expect(bars.map((b) => b.percent)).toEqual([68, 54, 72, 0, 21]);
  });

  it('stops a bar at full, and uses the goals it is given', () => {
    const [protein, iron] = barsFor([snack], { ...DEFAULT_GOALS, protein: 20, iron: 40 });
    expect(protein).toMatchObject({ have: 30, goal: 20, percent: 100, label: '30 / 20 g' });
    expect(iron.percent).toBe(26);
  });

  it('does not divide by a goal of nothing', () => {
    expect(barsFor([snack], { ...DEFAULT_GOALS, protein: 0 })[0].percent).toBe(0);
  });
});

describe('parseMeal', () => {
  const data: MealData = {
    day: '2026-10-03',
    slot: 'lunch',
    time: '13:45',
    food: 'Dal, rice, palak sabzi',
    note: 'Cucumber raita',
    amounts: { kcal: 530, iron: 4.2 },
    by: 'kush',
  };

  it('reads a meal back as it was saved', () => {
    expect(parseMeal(data)).toEqual(data);
  });

  it('tidies the text', () => {
    expect(parseMeal({ ...data, food: '  Dal  ', note: '   ' })).toMatchObject({ food: 'Dal', note: null });
  });

  it.each([
    ['not an object', 'lunch'],
    ['null', null],
    ['a list', [data]],
    ['no day', { ...data, day: undefined }],
    ['a day that is not a date', { ...data, day: 'today' }],
    ['a day with the wrong shape', { ...data, day: '3/10/2026' }],
    ['a slot it does not know', { ...data, slot: 'brunch' }],
    ['no food', { ...data, food: '' }],
    ['food that is only spaces', { ...data, food: '   ' }],
    ['food that is not text', { ...data, food: 42 }],
  ])('leaves out a record with %s', (_why, value) => {
    expect(parseMeal(value)).toBeNull();
  });

  it('forgives what is optional', () => {
    expect(parseMeal({ day: '2026-10-03', slot: 'snack', food: 'Mango' })).toEqual({
      day: '2026-10-03',
      slot: 'snack',
      time: null,
      food: 'Mango',
      note: null,
      amounts: {},
      by: null,
    });
    expect(parseMeal({ ...data, time: '25:00', by: 7 })).toMatchObject({ time: null, by: null });
    expect(parseMeal({ ...data, time: '7:30' })).toMatchObject({ time: null });
  });

  it('keeps only the numbers that are numbers', () => {
    const amounts = { kcal: 100, protein: -1, iron: Number.NaN, calcium: '300', folate: 0, fibre: Infinity, sugar: 5 };
    expect(parseMeal({ ...data, amounts })?.amounts).toEqual({ kcal: 100, folate: 0 });
    expect(parseMeal({ ...data, amounts: 'lots' })?.amounts).toEqual({});
  });

  it('makes a meal from a stored record, with the record’s id and time of change', () => {
    expect(mealFromItem({ id: 'r1', updatedAt: '2026-10-03T09:00:00.000Z', data })).toEqual({
      ...data,
      id: 'r1',
      updatedAt: '2026-10-03T09:00:00.000Z',
    });
  });

  it('makes nothing of a stored record that is not a meal', () => {
    expect(mealFromItem({ id: 'r1', updatedAt: '2026-10-03T09:00:00.000Z', data: { text: 'Mango' } })).toBeNull();
    expect(mealFromItem({ id: 'r1', updatedAt: '2026-10-03T09:00:00.000Z', data: null })).toBeNull();
  });
});

describe('mealsOn', () => {
  it('keeps one day, earliest first', () => {
    const list = [
      meal({ id: 'lunch', time: '13:45' }),
      meal({ id: 'yesterday', day: '2026-10-02', time: '07:00' }),
      meal({ id: 'breakfast', time: '08:30' }),
      meal({ id: 'tomorrow', day: '2026-10-04', time: '07:00' }),
    ];
    expect(ids(mealsOn(list, '2026-10-03'))).toEqual(['breakfast', 'lunch']);
  });

  it('puts a meal with no time after the timed ones, and breaks ties the same way on both phones', () => {
    const list = [
      meal({ id: 'a-late-entry', time: '08:00', updatedAt: '2026-10-03T09:00:00.000Z' }),
      meal({ id: 'untimed', time: null }),
      meal({ id: 'c-same-stamp', time: '08:00', updatedAt: '2026-10-03T08:00:00.000Z' }),
      meal({ id: 'b-same-stamp', time: '08:00', updatedAt: '2026-10-03T08:00:00.000Z' }),
      meal({ id: 'dinner', time: '19:10' }),
    ];
    expect(ids(mealsOn(list, '2026-10-03'))).toEqual(['b-same-stamp', 'c-same-stamp', 'a-late-entry', 'dinner', 'untimed']);
  });

  it('leaves the list it was given as it was', () => {
    const list = [meal({ id: 'b', time: '12:00' }), meal({ id: 'a', time: '08:00' })];
    mealsOn(list, '2026-10-03');
    expect(ids(list)).toEqual(['b', 'a']);
  });
});

describe('words on screen', () => {
  it('shows the time on the tile without am or pm, or a dash', () => {
    expect(tileTime('08:30')).toBe('8:30');
    expect(tileTime('13:45')).toBe('1:45');
    expect(tileTime('00:05')).toBe('12:05');
    expect(tileTime('12:00')).toBe('12:00');
    expect(tileTime(null)).toBe('—');
  });

  it('lists the first three numbers given for a meal', () => {
    expect(amountsLine({})).toBe('');
    expect(amountsLine({ kcal: 530, protein: 18, iron: 4.2 })).toBe('530 kcal · 18 g protein · 4.2 mg iron');
    expect(amountsLine({ fibre: 4 })).toBe('4 g fibre');
    const all: Amounts = { kcal: 530, protein: 18, iron: 4.2, calcium: 120, folate: 90, fibre: 4 };
    expect(amountsLine(all)).toBe('530 kcal · 18 g protein · 4.2 mg iron');
    expect(amountsLine({ calcium: 120, folate: 90, fibre: 4, iron: 1 })).toBe('1 mg iron · 120 mg calcium · 90 mcg folate');
  });

  it('heads the day with its weekday, the date and the month in short', () => {
    expect(dayHeading('2026-10-03', 'en-US')).toBe('Saturday, Oct 3');
    expect(dayHeading('2026-12-25', 'en-US')).toBe('Friday, Dec 25');
  });

  it('writes the heading in the language of the phone unless told otherwise', () => {
    expect(dayHeading('2026-10-03')).toBe(
      new Date(2026, 9, 3).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }),
    );
  });
});

describe('loggedBy', () => {
  const members = [
    { user_id: 'me', name: 'Ananya Rao' },
    { user_id: 'kush', name: 'Kush S' },
    { user_id: 'nameless', name: null },
    { user_id: 'padded', name: '  Meera   Iyer ' },
  ];

  it('says nothing about her own meals, or when nobody is known', () => {
    expect(loggedBy({ by: 'me' }, 'me', members)).toBeNull();
    expect(loggedBy({ by: null }, 'me', members)).toBeNull();
  });

  it('names the other person by first name', () => {
    expect(loggedBy({ by: 'kush' }, 'me', members)).toBe('Kush');
    expect(loggedBy({ by: 'me' }, 'kush', members)).toBe('Ananya');
    expect(loggedBy({ by: 'padded' }, 'me', members)).toBe('Meera');
  });

  it('falls back to Partner when the name is not known', () => {
    expect(loggedBy({ by: 'nameless' }, 'me', members)).toBe('Partner');
    expect(loggedBy({ by: 'gone' }, 'me', members)).toBe('Partner');
    expect(loggedBy({ by: 'kush' }, 'me', undefined)).toBe('Partner');
  });
});

describe('newMealData', () => {
  const input: NewMeal = { slot: 'dinner', food: '  Paneer paratha with curd ', time: '19:15', note: ' Lassi ', amounts: {} };

  it('makes the record’s data from the sheet’s fields', () => {
    expect(newMealData(input, '2026-10-03', 'kush')).toEqual({
      ok: true,
      data: { day: '2026-10-03', slot: 'dinner', time: '19:15', food: 'Paneer paratha with curd', note: 'Lassi', amounts: {}, by: 'kush' },
    });
  });

  it('leaves out a time and notes that were not given', () => {
    expect(newMealData({ ...input, time: '', note: '  ' }, '2026-10-03', null)).toMatchObject({
      ok: true,
      data: { time: null, note: null, by: null },
    });
  });

  it('turns typed numbers into amounts, and leaves the empty ones out', () => {
    const typed = { kcal: '530', protein: ' 18 ', iron: '4,2', calcium: '', fibre: '0' };
    expect(newMealData({ ...input, amounts: typed }, '2026-10-03', null)).toMatchObject({
      ok: true,
      data: { amounts: { kcal: 530, protein: 18, iron: 4.2, fibre: 0 } },
    });
  });

  it('asks for the food', () => {
    expect(newMealData({ ...input, food: '   ' }, '2026-10-03', null)).toEqual({ ok: false, error: 'Enter what was eaten.' });
  });

  it('keeps the text to a sensible length', () => {
    expect(newMealData({ ...input, food: 'x'.repeat(FOOD_MAX) }, '2026-10-03', null).ok).toBe(true);
    expect(newMealData({ ...input, food: 'x'.repeat(FOOD_MAX + 1) }, '2026-10-03', null)).toEqual({
      ok: false,
      error: `Keep the food to ${FOOD_MAX} characters or fewer.`,
    });
    expect(newMealData({ ...input, note: 'x'.repeat(NOTE_MAX) }, '2026-10-03', null).ok).toBe(true);
    expect(newMealData({ ...input, note: 'x'.repeat(NOTE_MAX + 1) }, '2026-10-03', null)).toEqual({
      ok: false,
      error: `Keep the notes to ${NOTE_MAX} characters or fewer.`,
    });
  });

  it('names the nutrient whose number is wrong', () => {
    expect(newMealData({ ...input, amounts: { iron: 'lots' } }, '2026-10-03', null)).toEqual({
      ok: false,
      error: `Iron should be a number from 0 to ${AMOUNT_MAX}, like 12 or 0.5.`,
    });
    expect(newMealData({ ...input, amounts: { kcal: '-5' } }, '2026-10-03', null)).toMatchObject({ ok: false });
    expect(newMealData({ ...input, amounts: { kcal: String(AMOUNT_MAX + 1) } }, '2026-10-03', null)).toMatchObject({
      ok: false,
      error: expect.stringContaining('Calories'),
    });
  });

  it('does not keep a time that is not a time', () => {
    expect(newMealData({ ...input, time: 'soon' }, '2026-10-03', null)).toMatchObject({ ok: true, data: { time: null } });
  });
});

describe('goals', () => {
  it('starts the sheet’s fields on the goals in use', () => {
    expect(goalsInput({ ...DEFAULT_GOALS, iron: 30.5 })).toEqual({
      protein: '71',
      iron: '30.5',
      calcium: '1000',
      folate: '600',
      fibre: '28',
    });
  });

  it('turns the fields into goals', () => {
    expect(newGoals({ protein: '75', iron: '27,5', calcium: ' 1200 ', folate: '400', fibre: '25' })).toEqual({
      ok: true,
      goals: { protein: 75, iron: 27.5, calcium: 1200, folate: 400, fibre: 25 },
    });
  });

  it.each([
    ['empty', ''],
    ['zero', '0'],
    ['negative', '-5'],
    ['not a number', 'lots'],
    ['too big', String(AMOUNT_MAX + 1)],
  ])('asks again for a goal that is %s, naming the nutrient', (_why, bad) => {
    const result = newGoals({ ...goalsInput(DEFAULT_GOALS), calcium: bad });
    expect(result).toEqual({ ok: false, error: `Enter a goal for calcium: a number above 0, up to ${AMOUNT_MAX}.` });
  });

  it('reads goals back, and where a number is no good starts from the default for that one', () => {
    expect(parseGoals({ protein: 80, iron: 30, calcium: 900, folate: 500, fibre: 30 })).toEqual({
      protein: 80,
      iron: 30,
      calcium: 900,
      folate: 500,
      fibre: 30,
    });
    expect(parseGoals({ protein: 80, iron: 0, calcium: -1, folate: 'x', fibre: AMOUNT_MAX + 1 })).toEqual({
      ...DEFAULT_GOALS,
      protein: 80,
    });
    expect(parseGoals({})).toEqual(DEFAULT_GOALS);
  });

  it('leaves out a record that is not goals', () => {
    expect(parseGoals(null)).toBeNull();
    expect(parseGoals('71')).toBeNull();
    expect(parseGoals([71])).toBeNull();
  });

  it('uses the starting goals until she has saved her own', () => {
    expect(goalsFromItems([])).toEqual({ goals: DEFAULT_GOALS, custom: false });
    expect(goalsFromItems([{ data: 'not goals' }])).toEqual({ goals: DEFAULT_GOALS, custom: false });
  });

  it('uses the goals she saved, the latest ones when there is more than one record', () => {
    const first = { protein: 80, iron: 30, calcium: 900, folate: 500, fibre: 30 };
    const latest = { protein: 90, iron: 31, calcium: 950, folate: 520, fibre: 31 };
    expect(goalsFromItems([{ data: first }])).toEqual({ goals: first, custom: true });
    expect(goalsFromItems([{ data: first }, { data: latest }])).toEqual({ goals: latest, custom: true });
    // A record that is no good doesn't hide an earlier one that is.
    expect(goalsFromItems([{ data: first }, { data: null }])).toEqual({ goals: first, custom: true });
  });

  it('leaves the list it was given as it was', () => {
    const items = [{ data: { protein: 80 } }, { data: { protein: 90 } }];
    goalsFromItems(items);
    expect(items).toEqual([{ data: { protein: 80 } }, { data: { protein: 90 } }]);
  });
});

describe('cravings', () => {
  it('reads the text of a craving', () => {
    expect(parseCraving({ text: ' Mango ' })).toBe('Mango');
    expect(parseCraving({ text: '   ' })).toBeNull();
    expect(parseCraving({ text: 4 })).toBeNull();
    expect(parseCraving({})).toBeNull();
    expect(parseCraving(null)).toBeNull();
    expect(parseCraving('Mango')).toBeNull();
  });

  it('makes a craving from a stored record, with the record’s id', () => {
    expect(cravingFromItem({ id: 'c1', data: { text: ' Mango ' } })).toEqual({ id: 'c1', text: 'Mango' });
    expect(cravingFromItem({ id: 'c2', data: { nothing: 'to show' } })).toBeNull();
    expect(cravingFromItem({ id: 'c3', data: null })).toBeNull();
  });

  it('adds a new one with its spaces tidied', () => {
    expect(newCraving('  Spicy   chaat ', ['Mango'])).toEqual({ ok: true, text: 'Spicy chaat' });
  });

  it('has nothing to add for an empty field, or for one already on the list in any case', () => {
    expect(newCraving('   ', ['Mango'])).toEqual({ ok: true, text: null });
    expect(newCraving('mango', ['Mango'])).toEqual({ ok: true, text: null });
    expect(newCraving(' MANGO ', ['Spicy chaat', 'Mango'])).toEqual({ ok: true, text: null });
  });

  it('keeps it short', () => {
    expect(newCraving('x'.repeat(CRAVING_MAX), [])).toMatchObject({ ok: true });
    expect(newCraving('x'.repeat(CRAVING_MAX + 1), [])).toEqual({
      ok: false,
      error: `Keep it to ${CRAVING_MAX} characters or fewer.`,
    });
  });
});
