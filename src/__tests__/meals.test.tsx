import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, AppState } from 'react-native';

import MealsScreen from '@/app/(tabs)/meals';
import { clock } from '@/lib/appointments';
import { CRAVING_KIND, CRAVING_MAX, FOOD_MAX, GOALS_KIND, MEAL_KIND, NOTE_MAX, dayHeading, type MealData } from '@/lib/meals';
import { goalsRecordId } from '@/lib/useMeals';
import { writeRecord, type LocalStore } from '@/lib/vault/localStore';
import { readyVault } from '@/lib/vault/testHelpers';
import { vaultWrapper } from '@/lib/vault/testWrapper';
import { vaultKey } from '@/lib/vault/useVaultSync';
import type { Vault } from '@/lib/vault/VaultProvider';
import { colors } from '@/theme/tokens';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)) }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/session', () => ({
  useSession: () => ({ session: { user: { id: 'me', email: 'ananya@example.com' } }, loading: false }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

const mockMembers = [
  { user_id: 'me', role: 'owner', name: 'Ananya Rao' },
  { user_id: 'kush', role: 'partner', name: 'Kush S' },
];
jest.mock('@/lib/data', () => ({
  ...jest.requireActual('@/lib/data'),
  useMembership: () => ({ data: { role: 'owner', pregnancy: { id: 'p1' } } }),
  useMembers: () => ({ data: mockMembers }),
}));

// The time picker is native, so a button stands in for it: pressing it picks 7:20 pm.
jest.mock('@react-native-community/datetimepicker', () => {
  const { createElement } = jest.requireActual('react');
  const { Pressable, Text } = jest.requireActual('react-native');
  function Picker(props: { onValueChange: (e: unknown, d: Date) => void }) {
    return createElement(
      Pressable,
      { accessibilityRole: 'button', accessibilityLabel: 'time picker', onPress: () => props.onValueChange({ nativeEvent: {} }, new Date(2026, 9, 3, 19, 20)) },
      createElement(Text, null, 'picker'),
    );
  }
  return { __esModule: true, default: Picker };
});

const P = 'p1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let store: LocalStore;
/** When each request to sync was made: one entry per request. */
let syncs: number[];
let ready: Vault;
let wrapper: ReturnType<typeof vaultWrapper>;
let client: QueryClient;

/** The screen's own query client, for doing what a pull from the other phone does. */
function ClientProbe() {
  const queryClient = useQueryClient();
  useEffect(() => {
    client = queryClient;
  }, [queryClient]);
  return null;
}

const renderMeals = () =>
  render(
    <>
      <MealsScreen />
      <ClientProbe />
    </>,
    { wrapper },
  );

/** Shows the screen on a phone in some other state than ready. */
const withVault = (over: Partial<Vault>) => {
  wrapper = vaultWrapper({ ...ready, ...over });
};

/** Only the date is faked, so the timers React Query and the screens use keep running. */
function fakeNow(now: Date) {
  jest.useFakeTimers({
    now,
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ],
  });
}

/** React Query tells a screen about a change a moment after it happens; this lets that land inside act before a test looks for something not being there. */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

let clockMinute = 0;
const seed = (kind: string, id: string, data: unknown) =>
  writeRecord(store, { id, pregnancyId: P, kind, data }, new Date(Date.UTC(2026, 9, 3, 6, ++clockMinute)));

const mealData = (over: Partial<MealData> = {}): MealData => ({
  day: '2026-10-03',
  slot: 'lunch',
  time: '13:45',
  food: 'Dal, rice, palak sabzi',
  note: null,
  amounts: {},
  by: 'me',
  ...over,
});

const seedMeal = (id: string, over: Partial<MealData> = {}) => seed(MEAL_KIND, id, mealData(over));

/** Everything the screen has put in the phone's database, of one kind. */
const stored = async (kind: string) => (await store.list(P, kind)).map((r) => ({ ...r }));

/**
 * Holds the phone's database in the middle of a write, so a test can look at the
 * screen while a change is still being saved. `release` lets the held writes through.
 */
function holdWrites() {
  const real = store.put.bind(store);
  const held: (() => void)[] = [];
  const put = jest.spyOn(store, 'put').mockImplementation(
    (record) =>
      new Promise<void>((resolve, reject) => {
        held.push(() => real(record).then(resolve, reject));
      }),
  );
  const release = () =>
    act(async () => {
      for (const go of held.splice(0)) go();
    });
  return { put, release };
}

const removeButtons = () => screen.getAllByRole('button', { name: /^Remove / }).map((b) => b.props.accessibilityLabel as string);
const bar = (name: string, label: string) => screen.getByRole('progressbar', { name: `${name}, ${label}` });

beforeEach(async () => {
  fakeNow(new Date(2026, 9, 3, 14, 5)); // Saturday 3 October 2026, 2:05 pm
  clockMinute = 0;
  jest.clearAllMocks();
  const opened = await readyVault();
  store = opened.store;
  syncs = opened.syncs;
  ready = opened.vault;
  wrapper = vaultWrapper(ready);
});

afterEach(() => jest.useRealTimers());

describe('Meals', () => {
  it('shows an empty day: today’s date, every bar at nothing, and the meal to log next', async () => {
    await renderMeals();

    expect(await screen.findByText('Nothing logged yet today.')).toBeTruthy();
    expect(screen.getByText(dayHeading('2026-10-03'))).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Meals' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Nutrients today' })).toBeTruthy();
    expect(bar('Protein', '0 / 71 g')).toBeTruthy();
    expect(bar('Iron', '0 / 27 mg')).toBeTruthy();
    expect(bar('Calcium', '0 / 1000 mg')).toBeTruthy();
    expect(bar('Folate', '0 / 600 mcg')).toBeTruthy();
    expect(bar('Fibre', '0 / 28 g')).toBeTruthy();
    expect(screen.getByText('Add nutrients when you log a meal and they add up here.')).toBeTruthy();
    // Past two in the afternoon and nothing logged: lunch.
    expect(screen.getByRole('button', { name: '+ Lunch' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ Type it in' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'CRAVINGS & AVERSIONS' })).toBeTruthy();
  });

  it('lists today’s meals earliest first, each with its time tile, notes and numbers', async () => {
    await seedMeal('lunch', { amounts: { kcal: 530, protein: 18, iron: 4.2 }, note: 'Cucumber raita' });
    await seedMeal('breakfast', { slot: 'breakfast', time: '08:30', food: 'Poha with peanuts', note: 'Glass of milk · banana' });
    await seedMeal('snack', { slot: 'snack', time: null, food: 'Mango and yoghurt' });
    await seedMeal('yesterday', { day: '2026-10-02', slot: 'dinner', food: 'Yesterday’s dinner' });
    await seed(MEAL_KIND, 'broken', { nothing: 'a meal would have' });
    await seed('other', 'not-a-meal', mealData({ food: 'Another kind of record' }));
    await renderMeals();

    await screen.findByText('Poha with peanuts');
    expect(removeButtons()).toEqual(['Remove Poha with peanuts', 'Remove Dal, rice, palak sabzi', 'Remove Mango and yoghurt']);
    expect(screen.getByText('8:30')).toBeTruthy();
    expect(screen.getByText('1:45')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('BREAKFAST')).toBeTruthy();
    expect(screen.getByText('LUNCH')).toBeTruthy();
    expect(screen.getByText('SNACK')).toBeTruthy();
    expect(screen.getByText('Glass of milk · banana')).toBeTruthy();
    expect(screen.getByText('Cucumber raita')).toBeTruthy();
    expect(screen.getByText('530 kcal · 18 g protein · 4.2 mg iron')).toBeTruthy();
    expect(screen.queryByText('Yesterday’s dinner')).toBeNull();
    expect(screen.queryByText('Another kind of record')).toBeNull();
    expect(screen.queryByText('Nothing logged yet today.')).toBeNull();
  });

  it('colours each meal’s time tile by its slot', async () => {
    await seedMeal('b', { slot: 'breakfast', time: '08:30', food: 'Poha' });
    await seedMeal('s', { slot: 'snack', time: '11:30', food: 'Fruit' });
    await seedMeal('l', { slot: 'lunch', time: '13:00', food: 'Dal' });
    await seedMeal('d', { slot: 'dinner', time: '20:00', food: 'Roti' });
    await renderMeals();

    expect(await screen.findByTestId('tile-b')).toHaveStyle({ backgroundColor: colors.yellow });
    expect(screen.getByTestId('tile-s')).toHaveStyle({ backgroundColor: colors.pink });
    expect(screen.getByTestId('tile-l')).toHaveStyle({ backgroundColor: colors.mint });
    expect(screen.getByTestId('tile-d')).toHaveStyle({ backgroundColor: colors.lilac });
  });

  it('adds up today’s numbers in the bars, against the goals', async () => {
    await seedMeal('a', { amounts: { protein: 18, iron: 4.2, fibre: 6 } });
    await seedMeal('b', { slot: 'snack', amounts: { protein: 30, iron: 10.3, calcium: 720 } });
    await seedMeal('c', { day: '2026-10-02', amounts: { protein: 100 } });
    await renderMeals();

    expect(await screen.findByRole('progressbar', { name: 'Protein, 48 / 71 g' })).toBeTruthy();
    expect(bar('Iron', '14.5 / 27 mg')).toBeTruthy();
    expect(bar('Calcium', '720 / 1000 mg')).toBeTruthy();
    expect(bar('Folate', '0 / 600 mcg')).toBeTruthy();
    expect(bar('Fibre', '6 / 28 g')).toBeTruthy();
    expect(bar('Protein', '48 / 71 g').props.accessibilityValue).toEqual({ min: 0, max: 100, now: 68 });
    expect(screen.queryByText('Add nutrients when you log a meal and they add up here.')).toBeNull();
  });

  it('fills each bar as far as the day has got towards its goal, in its own colour, and not at all when there is nothing', async () => {
    await seedMeal('a', { amounts: { protein: 48, iron: 14.5 } });
    await renderMeals();

    expect(await screen.findByTestId('fill-protein')).toHaveStyle({ width: '68%', backgroundColor: colors.purple });
    expect(screen.getByTestId('fill-iron')).toHaveStyle({ width: '54%', backgroundColor: colors.orange });
    expect(screen.queryByTestId('fill-calcium')).toBeNull();
    expect(screen.queryByTestId('fill-folate')).toBeNull();
    expect(screen.queryByTestId('fill-fibre')).toBeNull();
  });

  it('stops a bar at full when the day goes past the goal', async () => {
    await seedMeal('a', { amounts: { protein: 100 } });
    await renderMeals();

    expect(await screen.findByTestId('fill-protein')).toHaveStyle({ width: '100%' });
    expect(bar('Protein', '100 / 71 g')).toBeTruthy();
    expect(bar('Protein', '100 / 71 g').props.accessibilityValue).toEqual({ min: 0, max: 100, now: 100 });
  });

  it('keeps the hint when the meals so far today have no nutrient numbers, whatever other days had', async () => {
    await seedMeal('a', { amounts: { kcal: 400 } });
    await seedMeal('older', { day: '2026-10-02', food: 'Yesterday’s lunch', amounts: { protein: 20 } });
    await renderMeals();
    await screen.findByText('Dal, rice, palak sabzi');
    expect(screen.getByText('Add nutrients when you log a meal and they add up here.')).toBeTruthy();
  });

  it.each([CRAVING_KIND, GOALS_KIND])('shows nothing of the day until the %s records have been read too', async (kind) => {
    await seedMeal('a');
    const read = store.list.bind(store);
    let open!: () => void;
    const held = new Promise<void>((resolve) => {
      open = resolve;
    });
    jest.spyOn(store, 'list').mockImplementation(async (pregnancyId, ofKind) => {
      if (ofKind === kind) await held;
      return read(pregnancyId, ofKind);
    });
    await renderMeals();
    await settle();
    await settle();

    expect(screen.queryByText('Dal, rice, palak sabzi')).toBeNull();
    expect(screen.queryByRole('header', { name: 'Nutrients today' })).toBeNull();
    expect(screen.queryByRole('header', { name: 'CRAVINGS & AVERSIONS' })).toBeNull();

    await act(async () => {
      open();
    });
    expect(await screen.findByText('Dal, rice, palak sabzi')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Nutrients today' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'CRAVINGS & AVERSIONS' })).toBeTruthy();
  });

  it('says who logged a meal when it was the other person', async () => {
    await seedMeal('hers', { food: 'Her meal', by: 'me', time: '08:00' });
    await seedMeal('his', { food: 'His meal', by: 'kush', time: '09:00' });
    await seedMeal('unknown', { food: 'Older meal', by: null, time: '10:00' });
    await renderMeals();

    await screen.findByText('His meal');
    expect(screen.getAllByText(/ logged this$/)).toHaveLength(1);
    expect(screen.getByText('Kush logged this')).toBeTruthy();
  });

  it('shows a meal that arrives from the other phone after a pull', async () => {
    await renderMeals();
    await screen.findByText('Nothing logged yet today.');

    await seedMeal('from-kush', { food: 'Khichdi', by: 'kush', slot: 'lunch' });
    await act(async () => {
      await client.invalidateQueries({ queryKey: vaultKey(P) });
    });

    expect(await screen.findByText('Khichdi')).toBeTruthy();
    expect(screen.queryByText('Nothing logged yet today.')).toBeNull();
  });

  it('moves on to the new day when the day changes', async () => {
    await seedMeal('today', { food: 'Today’s lunch' });
    await seedMeal('tomorrow', { day: '2026-10-04', food: 'Tomorrow’s breakfast', slot: 'breakfast', time: '08:00' });
    await renderMeals();
    await screen.findByText('Today’s lunch');
    expect(screen.queryByText('Tomorrow’s breakfast')).toBeNull();

    // The phone was asleep through midnight; the app waking up is what notices.
    jest.setSystemTime(new Date(2026, 9, 4, 7, 30));
    await act(async () => {
      for (const [type, listener] of (AppState.addEventListener as jest.Mock).mock.calls) {
        if (type === 'change') listener('active');
      }
    });

    expect(await screen.findByText('Tomorrow’s breakfast')).toBeTruthy();
    expect(screen.queryByText('Today’s lunch')).toBeNull();
    expect(screen.getByText(dayHeading('2026-10-04'))).toBeTruthy();
    // And the dashed button follows the clock: breakfast is logged, so a snack.
    expect(screen.getByRole('button', { name: '+ Snack' })).toBeTruthy();
  });
});

describe('Adding a meal', () => {
  const open = async () => fireEvent.press(await screen.findByRole('button', { name: '+ Type it in' }));
  const food = (text: string) => fireEvent.changeText(screen.getByLabelText('What was eaten?'), text);
  const save = () => fireEvent.press(screen.getByRole('button', { name: 'Save meal' }));
  const sheetClosed = () => waitFor(() => expect(screen.queryByRole('header', { name: 'Add a meal' })).toBeNull());

  it('starts on the usual meal for the time of day, the time now, and no nutrients', async () => {
    await renderMeals();
    await open();

    expect(screen.getByRole('header', { name: 'Add a meal' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Lunch', checked: true })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Breakfast', checked: false })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Snack', checked: false })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Dinner', checked: false })).toBeTruthy();
    expect(screen.getByRole('button', { name: `Time: ${clock('14:05')}` })).toBeTruthy();
    expect(screen.getByLabelText('What was eaten?').props.value).toBe('');
    expect(screen.queryByLabelText('Iron (mg)')).toBeNull();
  });

  it('saves the meal on the phone, shows it with the bars moved, and asks for a sync', async () => {
    await renderMeals();
    await open();

    await food('  Paneer paratha with curd  ');
    await fireEvent.press(screen.getByRole('radio', { name: 'Dinner' }));
    expect(screen.getByRole('radio', { name: 'Dinner', checked: true })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Notes'), 'Lassi');
    await fireEvent.press(screen.getByRole('button', { name: '+ Add nutrients (optional)' }));
    await fireEvent.changeText(screen.getByLabelText('Calories (kcal)'), '530');
    await fireEvent.changeText(screen.getByLabelText('Iron (mg)'), '4,5');
    await save();
    await sheetClosed();

    expect(await screen.findByText('Paneer paratha with curd')).toBeTruthy();
    expect(screen.getByText('DINNER')).toBeTruthy();
    expect(screen.getByText('2:05')).toBeTruthy();
    expect(screen.getByText('Lassi')).toBeTruthy();
    expect(screen.getByText('530 kcal · 4.5 mg iron')).toBeTruthy();
    expect(bar('Iron', '4.5 / 27 mg')).toBeTruthy();
    expect(screen.queryByText('Nothing logged yet today.')).toBeNull();

    const [saved, ...rest] = await stored(MEAL_KIND);
    expect(rest).toEqual([]);
    expect(saved.id).toMatch(UUID);
    expect(saved).toMatchObject({ pregnancyId: P, dirty: true, deleted: false });
    expect(saved.data).toEqual({
      day: '2026-10-03',
      slot: 'dinner',
      time: '14:05',
      food: 'Paneer paratha with curd',
      note: 'Lassi',
      amounts: { kcal: 530, iron: 4.5 },
      by: 'me',
    });
    expect(syncs).toHaveLength(1);
  });

  it('takes a time from the picker, or no time at all', async () => {
    await renderMeals();
    await open();
    await food('Late dinner');
    await fireEvent.press(screen.getByRole('button', { name: /^Time:/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'time picker' }));
    expect(screen.getByRole('button', { name: `Time: ${clock('19:20')}` })).toBeTruthy();
    await save();
    await sheetClosed();
    await screen.findByText('Late dinner');
    expect(screen.getByText('7:20')).toBeTruthy();

    await open();
    await food('Something with no time');
    await fireEvent.press(screen.getByRole('button', { name: 'Clear time' }));
    await save();
    await sheetClosed();
    await screen.findByText('Something with no time');
    expect(screen.getByText('—')).toBeTruthy();
    expect((await stored(MEAL_KIND)).map((r) => (r.data as MealData).time).sort()).toEqual(['19:20', null]);
    // The one with no time comes last.
    expect(removeButtons()).toEqual(['Remove Late dinner', 'Remove Something with no time']);
  });

  it('asks for the food, and for numbers that are numbers, before saving anything', async () => {
    await renderMeals();
    await open();

    await save();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter what was eaten.');

    await food('Toast');
    await fireEvent.press(screen.getByRole('button', { name: '+ Add nutrients (optional)' }));
    await fireEvent.changeText(screen.getByLabelText('Iron (mg)'), 'lots');
    await save();
    expect(screen.getByRole('alert')).toHaveTextContent(/^Iron should be a number/);
    await settle();
    expect(await stored(MEAL_KIND)).toEqual([]);
    expect(syncs).toEqual([]);

    await fireEvent.changeText(screen.getByLabelText('Iron (mg)'), '1.2');
    await save();
    await sheetClosed();
    expect(await screen.findByText('Toast')).toBeTruthy();
    expect(await stored(MEAL_KIND)).toHaveLength(1);
  });

  it('says it is saving, and does not save the meal twice if the button is tapped meanwhile', async () => {
    await renderMeals();
    await open();
    await food('Toast');
    const writes = holdWrites();
    await save();

    const saving = await screen.findByRole('button', { name: 'Saving…' });
    expect(saving).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save meal' })).toBeNull();
    await fireEvent.press(saving);
    expect(writes.put).toHaveBeenCalledTimes(1);

    await writes.release();
    await sheetClosed();
    expect(await screen.findByText('Toast')).toBeTruthy();
    expect(await stored(MEAL_KIND)).toHaveLength(1);
    expect(syncs).toHaveLength(1);
  });

  it('stops showing the message about what it asked for once that is fixed and the meal is being saved', async () => {
    await renderMeals();
    await open();
    await save();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter what was eaten.');

    await food('Toast');
    const writes = holdWrites();
    await save();
    await screen.findByRole('button', { name: 'Saving…' });
    expect(screen.queryByRole('alert')).toBeNull();

    await writes.release();
    await sheetClosed();
  });

  it('stops typing at a sensible length in each field', async () => {
    await renderMeals();
    await open();
    expect(screen.getByLabelText('What was eaten?').props.maxLength).toBe(FOOD_MAX);
    expect(screen.getByLabelText('Notes').props.maxLength).toBe(NOTE_MAX);
    await fireEvent.press(screen.getByRole('button', { name: '+ Add nutrients (optional)' }));
    for (const label of ['Calories (kcal)', 'Protein (g)', 'Iron (mg)', 'Calcium (mg)', 'Folate (mcg)', 'Fibre (g)']) {
      expect(screen.getByLabelText(label).props.maxLength).toBe(8);
    }
  });

  it('hides the nutrient fields again, keeping what was typed in them', async () => {
    await renderMeals();
    await open();
    await fireEvent.press(screen.getByRole('button', { name: '+ Add nutrients (optional)' }));
    expect(screen.getByRole('button', { name: '− Hide nutrients', expanded: true })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Protein (g)'), '12');
    await fireEvent.press(screen.getByRole('button', { name: '− Hide nutrients' }));
    expect(screen.queryByLabelText('Protein (g)')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: '+ Add nutrients (optional)', expanded: false }));
    expect(screen.getByLabelText('Protein (g)').props.value).toBe('12');
  });

  it('closes on Cancel without saving, and opens empty the next time', async () => {
    await renderMeals();
    await open();
    await food('Half a sandwich');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    await sheetClosed();
    await settle();
    expect(await stored(MEAL_KIND)).toEqual([]);

    await open();
    expect(screen.getByLabelText('What was eaten?').props.value).toBe('');
  });

  it('is offered from the dashed button too, with the slot it names', async () => {
    await renderMeals();
    await fireEvent.press(await screen.findByRole('button', { name: '+ Lunch' }));
    expect(screen.getByRole('radio', { name: 'Lunch', checked: true })).toBeTruthy();
    await food('Rajma chawal');
    await save();
    await sheetClosed();
    await screen.findByText('Rajma chawal');

    // Lunch is logged now, so the next one offered is a snack.
    expect(screen.queryByRole('button', { name: '+ Lunch' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: '+ Snack' }));
    expect(screen.getByRole('radio', { name: 'Snack', checked: true })).toBeTruthy();
  });

  it('offers the sheet only once there is a database to save to', async () => {
    withVault({ state: 'needs-key' });
    await renderMeals();
    await screen.findByText('This phone needs the household key');
    expect(screen.queryByRole('button', { name: '+ Type it in' })).toBeNull();
  });
});

describe('Removing a meal', () => {
  it('asks first, then removes it from both phones', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await seedMeal('a', { food: 'Poha with peanuts', slot: 'breakfast', time: '08:30' });
    await seedMeal('b', { food: 'Dal rice', time: '13:45' });
    await store.markClean('a', (await store.get('a'))?.updatedAt ?? '');
    await renderMeals();
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove Poha with peanuts' }));

    expect(alert).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = alert.mock.calls[0];
    expect(title).toBe('Remove Poha with peanuts?');
    expect(message).toBe('It disappears for both of you.');
    expect(screen.getByText('Poha with peanuts')).toBeTruthy();
    expect(await store.get('a')).toMatchObject({ deleted: false });

    await act(async () => {
      await buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await waitFor(() => expect(screen.queryByText('Poha with peanuts')).toBeNull());
    expect(screen.getByText('Dal rice')).toBeTruthy();
    expect(await store.get('a')).toMatchObject({ deleted: true, data: null, dirty: true });
    expect(await store.get('b')).toMatchObject({ deleted: false });
    expect(syncs).toHaveLength(1);
    alert.mockRestore();
  });

  it('takes its numbers out of the bars', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await seedMeal('a', { amounts: { protein: 20 } });
    await renderMeals();
    expect(await screen.findByRole('progressbar', { name: 'Protein, 20 / 71 g' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Remove Dal, rice, palak sabzi' }));
    await act(async () => {
      await alert.mock.calls[0][2]?.find((b) => b.style === 'destructive')?.onPress?.();
    });

    expect(await screen.findByRole('progressbar', { name: 'Protein, 0 / 71 g' })).toBeTruthy();
    alert.mockRestore();
  });
});

describe('Daily goals', () => {
  const openGoals = async () => fireEvent.press(await screen.findByRole('button', { name: 'Change daily goals' }));
  const sheetClosed = () => waitFor(() => expect(screen.queryByRole('header', { name: 'Daily goals' })).toBeNull());

  it('start as the design’s typical goals, and say so', async () => {
    await renderMeals();
    await openGoals();

    expect(screen.getByText('Typical goals · Change')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Daily goals' })).toBeTruthy();
    expect(screen.getByText(/Use the numbers your doctor gave you/)).toBeTruthy();
    expect(screen.getByLabelText('Protein (g)').props.value).toBe('71');
    expect(screen.getByLabelText('Iron (mg)').props.value).toBe('27');
    expect(screen.getByLabelText('Calcium (mg)').props.value).toBe('1000');
    expect(screen.getByLabelText('Folate (mcg)').props.value).toBe('600');
    expect(screen.getByLabelText('Fibre (g)').props.value).toBe('28');
  });

  it('stop typing at a sensible length in each field', async () => {
    await renderMeals();
    await openGoals();
    for (const label of ['Protein (g)', 'Iron (mg)', 'Calcium (mg)', 'Folate (mcg)', 'Fibre (g)']) {
      expect(screen.getByLabelText(label).props.maxLength).toBe(8);
    }
  });

  it('are saved as one record both phones share, and the bars use them', async () => {
    await seedMeal('a', { amounts: { protein: 40, iron: 15 } });
    await renderMeals();
    expect(await screen.findByRole('progressbar', { name: 'Protein, 40 / 71 g' })).toBeTruthy();

    await openGoals();
    await fireEvent.changeText(screen.getByLabelText('Protein (g)'), '80');
    await fireEvent.changeText(screen.getByLabelText('Iron (mg)'), '30,5');
    await fireEvent.press(screen.getByRole('button', { name: 'Save goals' }));
    await sheetClosed();

    expect(await screen.findByRole('progressbar', { name: 'Protein, 40 / 80 g' })).toBeTruthy();
    expect(bar('Iron', '15 / 30.5 mg')).toBeTruthy();
    expect(bar('Calcium', '0 / 1000 mg')).toBeTruthy();
    expect(screen.getByText('Your goals · Change')).toBeTruthy();

    const goals = await stored(GOALS_KIND);
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({ id: goalsRecordId(P), pregnancyId: P, dirty: true });
    expect(goals[0].data).toEqual({ protein: 80, iron: 30.5, calcium: 1000, folate: 600, fibre: 28 });
    expect(syncs).toHaveLength(1);

    // Changing them again changes the same record.
    await openGoals();
    expect(screen.getByLabelText('Protein (g)').props.value).toBe('80');
    await fireEvent.changeText(screen.getByLabelText('Protein (g)'), '85');
    await fireEvent.press(screen.getByRole('button', { name: 'Save goals' }));
    await sheetClosed();
    expect(await screen.findByRole('progressbar', { name: 'Protein, 40 / 85 g' })).toBeTruthy();
    expect(await stored(GOALS_KIND)).toHaveLength(1);
  });

  it('use the ones the other phone saved', async () => {
    await seed(GOALS_KIND, goalsRecordId(P), { protein: 90, iron: 30, calcium: 1100, folate: 500, fibre: 30 });
    await renderMeals();

    expect(await screen.findByRole('progressbar', { name: 'Protein, 0 / 90 g' })).toBeTruthy();
    expect(bar('Calcium', '0 / 1100 mg')).toBeTruthy();
    expect(screen.getByText('Your goals · Change')).toBeTruthy();
  });

  it('ask again for a goal that is not a number above nothing', async () => {
    await renderMeals();
    await openGoals();
    await fireEvent.changeText(screen.getByLabelText('Calcium (mg)'), '0');
    await fireEvent.press(screen.getByRole('button', { name: 'Save goals' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a goal for calcium: a number above 0, up to 10000.');
    await settle();
    expect(await stored(GOALS_KIND)).toEqual([]);
    expect(screen.getByText('Typical goals · Change')).toBeTruthy();
  });

  it('say they are being saved, and are not saved twice if the button is tapped meanwhile', async () => {
    await renderMeals();
    await openGoals();
    await fireEvent.changeText(screen.getByLabelText('Protein (g)'), '80');
    const writes = holdWrites();
    await fireEvent.press(screen.getByRole('button', { name: 'Save goals' }));

    const saving = await screen.findByRole('button', { name: 'Saving…' });
    expect(saving).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save goals' })).toBeNull();
    await fireEvent.press(saving);
    expect(writes.put).toHaveBeenCalledTimes(1);

    await writes.release();
    await sheetClosed();
    expect(await screen.findByRole('progressbar', { name: 'Protein, 0 / 80 g' })).toBeTruthy();
    expect(syncs).toHaveLength(1);
  });

  it('stop showing the message about a goal once it is fixed and the goals are being saved', async () => {
    await renderMeals();
    await openGoals();
    await fireEvent.changeText(screen.getByLabelText('Calcium (mg)'), '0');
    await fireEvent.press(screen.getByRole('button', { name: 'Save goals' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a goal for calcium: a number above 0, up to 10000.');

    await fireEvent.changeText(screen.getByLabelText('Calcium (mg)'), '900');
    const writes = holdWrites();
    await fireEvent.press(screen.getByRole('button', { name: 'Save goals' }));
    await screen.findByRole('button', { name: 'Saving…' });
    expect(screen.queryByRole('alert')).toBeNull();

    await writes.release();
    await sheetClosed();
  });

  it('can be dropped with Cancel', async () => {
    await renderMeals();
    await openGoals();
    await fireEvent.changeText(screen.getByLabelText('Protein (g)'), '99');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    await sheetClosed();
    await settle();

    expect(await stored(GOALS_KIND)).toEqual([]);
    expect(screen.getByRole('progressbar', { name: 'Protein, 0 / 71 g' })).toBeTruthy();
    await openGoals();
    expect(screen.getByLabelText('Protein (g)').props.value).toBe('71');
  });
});

describe('Cravings and aversions', () => {
  const chips = () => screen.queryAllByRole('button', { name: /^Remove / }).map((b) => b.props.accessibilityLabel as string);
  const input = () => screen.getByLabelText('New craving');

  it('lists them in the order they were added', async () => {
    await seed(CRAVING_KIND, 'c1', { text: 'Mango' });
    await seed(CRAVING_KIND, 'c2', { text: 'Spicy chaat' });
    await seed(CRAVING_KIND, 'c3', { text: 'No to coffee smell' });
    await seed(CRAVING_KIND, 'c4', { nothing: 'to show' });
    await renderMeals();

    await screen.findByText('Spicy chaat');
    expect(chips()).toEqual(['Remove Mango', 'Remove Spicy chaat', 'Remove No to coffee smell']);
  });

  it('adds one, clears the field, and asks for a sync', async () => {
    await renderMeals();
    await screen.findByText('Nothing logged yet today.');
    expect(chips()).toEqual([]);

    await fireEvent.changeText(input(), '  Pickles  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Pickles')).toBeTruthy();
    expect(input().props.value).toBe('');
    const [saved, ...rest] = await stored(CRAVING_KIND);
    expect(rest).toEqual([]);
    expect(saved).toMatchObject({ pregnancyId: P, dirty: true });
    expect(saved.data).toEqual({ text: 'Pickles' });
    expect(saved.id).toMatch(UUID);
    expect(syncs).toHaveLength(1);
  });

  it('does not add one twice if Add is tapped while it is being saved', async () => {
    await renderMeals();
    await screen.findByText('Nothing logged yet today.');
    await fireEvent.changeText(input(), 'Pickles');
    const writes = holdWrites();
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    const add = await screen.findByRole('button', { name: 'Add' });
    await waitFor(() => expect(add).toBeDisabled());
    await fireEvent.press(add);
    expect(writes.put).toHaveBeenCalledTimes(1);

    await writes.release();
    expect(await screen.findByText('Pickles')).toBeTruthy();
    expect(await stored(CRAVING_KIND)).toHaveLength(1);
  });

  it('adds one when return is pressed on the keyboard', async () => {
    await renderMeals();
    await screen.findByText('Nothing logged yet today.');
    await fireEvent.changeText(input(), 'Ice cream');
    await fireEvent(input(), 'submitEditing');
    expect(await screen.findByText('Ice cream')).toBeTruthy();
  });

  it('does nothing for an empty field, or for one that is already there in any case', async () => {
    await seed(CRAVING_KIND, 'c1', { text: 'Mango' });
    await renderMeals();
    await screen.findByText('Mango');

    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    await fireEvent.changeText(input(), '  mango ');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    await settle();

    expect(chips()).toEqual(['Remove Mango']);
    expect(input().props.value).toBe('');
    expect(await stored(CRAVING_KIND)).toHaveLength(1);
    expect(syncs).toEqual([]);
  });

  it('tells her when one is too long', async () => {
    await renderMeals();
    await screen.findByText('Nothing logged yet today.');
    // The field stops typing at the limit; a longer text can still arrive by pasting.
    expect(input().props.maxLength).toBe(CRAVING_MAX);
    await fireEvent.changeText(input(), 'x'.repeat(41));
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Keep it to 40 characters or fewer.');
    expect(input().props.value).toBe('x'.repeat(41));
    await settle();
    expect(await stored(CRAVING_KIND)).toEqual([]);
  });

  it('stops showing the message about a too long craving once it is fixed, or the field is emptied', async () => {
    await renderMeals();
    await screen.findByText('Nothing logged yet today.');
    await fireEvent.changeText(input(), 'x'.repeat(41));
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Keep it to 40 characters or fewer.');

    await fireEvent.changeText(input(), 'Mango');
    const writes = holdWrites();
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(writes.put).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
    await writes.release();
    expect(await screen.findByText('Mango')).toBeTruthy();

    await fireEvent.changeText(input(), 'x'.repeat(41));
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Keep it to 40 characters or fewer.');
    await fireEvent.changeText(input(), '');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('removes one with a tap on it', async () => {
    await seed(CRAVING_KIND, 'c1', { text: 'Mango' });
    await seed(CRAVING_KIND, 'c2', { text: 'Spicy chaat' });
    await renderMeals();
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove Mango' }));

    await waitFor(() => expect(chips()).toEqual(['Remove Spicy chaat']));
    expect(await store.get('c1')).toMatchObject({ deleted: true, dirty: true });
    expect(syncs).toHaveLength(1);
  });
});

describe('When this phone is not ready', () => {
  it('asks for the household key, and goes to the screen that takes it', async () => {
    withVault({ state: 'needs-key', role: 'partner' });
    await seedMeal('hidden', { food: 'Should not show' });
    await renderMeals();

    expect(await screen.findByText('This phone needs the household key')).toBeTruthy();
    expect(screen.queryByText('Should not show')).toBeNull();
    expect(screen.queryByRole('header', { name: 'Nutrients today' })).toBeNull();
    expect(screen.queryByRole('header', { name: 'CRAVINGS & AVERSIONS' })).toBeNull();
    expect(screen.getByRole('header', { name: 'Meals' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Add the household key' }));
    expect(router.push).toHaveBeenCalledWith('/household-key');
  });

  it('says it is opening while the phone checks', async () => {
    withVault({ state: 'loading', store: null, sync: null });
    await renderMeals();
    expect(screen.getByText('Opening your meals…')).toBeTruthy();
    expect(screen.queryByRole('header', { name: 'Nutrients today' })).toBeNull();
  });

  it('offers a retry when the check failed', async () => {
    const retry = jest.fn();
    withVault({ state: 'error', store: null, sync: null, retry });
    await renderMeals();
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't open your meals. Check your connection and try again.");
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
  });

  it('says the web has no meals, which live on the phones', async () => {
    withVault({ state: 'unsupported', store: null, sync: null });
    await renderMeals();
    expect(screen.getByText('Your meals are kept on your phones, so they only show in the phone app.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '+ Type it in' })).toBeNull();
  });
});

describe('When the records cannot be read', () => {
  it.each([MEAL_KIND, CRAVING_KIND, GOALS_KIND])('says so, and shows nothing half read, if the %s records fail', async (kind) => {
    const read = store.list.bind(store);
    jest.spyOn(store, 'list').mockImplementation((pregnancyId, ofKind) => (ofKind === kind ? Promise.reject(new Error('database is locked')) : read(pregnancyId, ofKind)));
    await seedMeal('a');
    await renderMeals();

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load your meals. Close Bloom and open it again.");
    expect(screen.queryByText('Dal, rice, palak sabzi')).toBeNull();
    expect(screen.queryByRole('header', { name: 'Nutrients today' })).toBeNull();
    expect(screen.queryByRole('header', { name: 'CRAVINGS & AVERSIONS' })).toBeNull();
  });
});

describe('When a change cannot be saved', () => {
  // Every change goes through the phone's database, so that is what is made to fail.
  const failWrites = () => jest.spyOn(store, 'put').mockRejectedValue(new Error('disk full'));

  it('keeps the meal sheet open with what was typed, says so, and saves on the next try', async () => {
    await renderMeals();
    await fireEvent.press(await screen.findByRole('button', { name: '+ Type it in' }));
    await fireEvent.changeText(screen.getByLabelText('What was eaten?'), 'Toast');
    const writes = failWrites();
    await fireEvent.press(screen.getByRole('button', { name: 'Save meal' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save. Try again.');
    expect(screen.getByLabelText('What was eaten?').props.value).toBe('Toast');
    expect(screen.getByRole('header', { name: 'Add a meal' })).toBeTruthy();
    expect(syncs).toEqual([]);

    writes.mockRestore();
    await fireEvent.press(screen.getByRole('button', { name: 'Save meal' }));
    await waitFor(() => expect(screen.queryByRole('header', { name: 'Add a meal' })).toBeNull());
    expect(await screen.findByText('Toast')).toBeTruthy();
    expect(await stored(MEAL_KIND)).toHaveLength(1);
  });

  it('keeps the craving in the field, and says so', async () => {
    await renderMeals();
    await screen.findByText('Nothing logged yet today.');
    await fireEvent.changeText(screen.getByLabelText('New craving'), 'Mango');
    const writes = failWrites();
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save that. Try again.');
    expect(screen.getByLabelText('New craving').props.value).toBe('Mango');
    expect(screen.queryByRole('button', { name: 'Remove Mango' })).toBeNull();
    writes.mockRestore();
  });

  it('keeps the goals sheet open, and says so', async () => {
    await renderMeals();
    await fireEvent.press(await screen.findByRole('button', { name: 'Change daily goals' }));
    await fireEvent.changeText(screen.getByLabelText('Protein (g)'), '80');
    const writes = failWrites();
    await fireEvent.press(screen.getByRole('button', { name: 'Save goals' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save. Try again.');
    expect(screen.getByRole('header', { name: 'Daily goals' })).toBeTruthy();
    expect(screen.getByLabelText('Protein (g)').props.value).toBe('80');
    expect(screen.getByRole('progressbar', { name: 'Protein, 0 / 71 g' })).toBeTruthy();
    writes.mockRestore();
  });

  it('keeps a meal that could not be removed, and says so', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await seedMeal('a', { food: 'Poha with peanuts' });
    await renderMeals();
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove Poha with peanuts' }));
    const writes = failWrites();
    await act(async () => {
      await alert.mock.calls[0][2]?.find((b) => b.style === 'destructive')?.onPress?.();
    });

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't remove that. Try again.");
    expect(screen.getByText('Poha with peanuts')).toBeTruthy();
    expect(syncs).toEqual([]);
    writes.mockRestore();
    alert.mockRestore();
  });
});
