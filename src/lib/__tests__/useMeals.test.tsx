import { useQueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { CRAVING_KIND, DEFAULT_GOALS, GOALS_KIND, MEAL_KIND, type Meal, type MealData } from '@/lib/meals';
import { goalsRecordId, useAddCraving, useAddMeal, useCravings, useGoals, useMeals, useRemoveItem, useSaveGoals } from '@/lib/useMeals';
import { deleteRecord, writeRecord } from '@/lib/vault/localStore';
import { vaultQueryKey } from '@/lib/vault/records';
import { readyVault } from '@/lib/vault/testHelpers';
import { vaultWrapper } from '@/lib/vault/testWrapper';
import { vaultKey } from '@/lib/vault/useVaultSync';
import type { Vault } from '@/lib/vault/VaultProvider';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)) }));

const P = '11111111-1111-1111-1111-111111111111';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let ready: Awaited<ReturnType<typeof readyVault>>;

beforeEach(async () => {
  ready = await readyVault();
});

const at = (minute: number) => new Date(Date.UTC(2026, 9, 3, 12, minute));

const mealData = (over: Partial<MealData> = {}): MealData => ({
  day: '2026-10-03',
  slot: 'lunch',
  time: '13:45',
  food: 'Dal rice',
  note: null,
  amounts: {},
  by: 'me',
  ...over,
});

const put = (id: string, kind: string, data: unknown, minute: number, pregnancyId = P) =>
  writeRecord(ready.store, { id, pregnancyId, kind, data }, at(minute));

/** React Query tells hooks about a change a moment after it happens; this lets that land inside act, so nothing updates after a test ends. */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

/** The hooks under test, with the query client they share so a test can see what is cached. */
const render = (options: { vault?: Vault; pregnancyId?: string } = {}) => {
  const vault = options.vault ?? ready.vault;
  // Asking for no pregnancy at all is `{ pregnancyId: undefined }`, so look for the key.
  const pregnancyId = 'pregnancyId' in options ? options.pregnancyId : P;
  return renderHook(
    () => ({
      client: useQueryClient(),
      meals: useMeals(pregnancyId),
      cravings: useCravings(pregnancyId),
      goals: useGoals(pregnancyId),
      addMeal: useAddMeal(pregnancyId),
      addCraving: useAddCraving(pregnancyId),
      saveGoals: useSaveGoals(pregnancyId),
      remove: useRemoveItem(pregnancyId),
    }),
    { wrapper: vaultWrapper(vault) },
  );
};

describe('goalsRecordId', () => {
  // Records are stored under this id, so it can never change: a different answer
  // would leave every household's saved goals behind and start a second record.
  it('never changes, and is a uuid', () => {
    expect(goalsRecordId(P)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(goalsRecordId(P)).toBe('eb3b09f0-3df4-850f-a2f3-f5d8c11341b9');
    expect(goalsRecordId('22222222-2222-2222-2222-222222222222')).toBe('0ddcedd3-7ef5-8044-b9d0-81c894b18491');
  });

  it('is the same on both phones, and different for another household', () => {
    expect(goalsRecordId(P)).toBe(goalsRecordId(P));
    expect(goalsRecordId(P)).not.toBe(goalsRecordId('22222222-2222-2222-2222-222222222222'));
  });
});

describe('reading', () => {
  it('lists this household’s meals, leaving out other kinds, other households, removed ones and what it cannot read', async () => {
    await put('lunch', MEAL_KIND, mealData(), 1);
    await put('breakfast', MEAL_KIND, mealData({ slot: 'breakfast', time: '08:30', food: 'Poha' }), 2);
    await put('craving', CRAVING_KIND, { text: 'Mango' }, 3);
    await put('theirs', MEAL_KIND, mealData({ food: 'Someone else’s' }), 4, 'another-household');
    await put('gone', MEAL_KIND, mealData({ food: 'Removed' }), 5);
    await deleteRecord(ready.store, 'gone', at(6));
    await put('broken', MEAL_KIND, { shape: 'from a newer app' }, 7);

    const { result } = await render();
    await waitFor(() => expect(result.current.meals.isSuccess).toBe(true));

    const meals: Meal[] = result.current.meals.data ?? [];
    expect(meals.map((m) => [m.id, m.food, m.updatedAt])).toEqual([
      ['lunch', 'Dal rice', at(1).toISOString()],
      ['breakfast', 'Poha', at(2).toISOString()],
    ]);
  });

  it('lists cravings in the order they were added, and the goals in use', async () => {
    await put('c1', CRAVING_KIND, { text: 'Mango' }, 1);
    await put('c2', CRAVING_KIND, { text: 'Spicy chaat' }, 2);
    await put('c3', CRAVING_KIND, { nothing: 'to show' }, 3);
    await put('meal', MEAL_KIND, mealData(), 4);

    const { result } = await render();
    await waitFor(() => expect(result.current.cravings.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.goals.isSuccess).toBe(true));

    expect(result.current.cravings.data).toEqual([
      { id: 'c1', text: 'Mango' },
      { id: 'c2', text: 'Spicy chaat' },
    ]);
    expect(result.current.goals.data).toEqual({ goals: DEFAULT_GOALS, custom: false });
  });

  it('uses the goals that were saved', async () => {
    const goals = { protein: 90, iron: 30, calcium: 1100, folate: 500, fibre: 30 };
    await put(goalsRecordId(P), GOALS_KIND, goals, 1);
    await put('a-meal', MEAL_KIND, mealData(), 2);

    const { result } = await render();
    await waitFor(() => expect(result.current.goals.isSuccess).toBe(true));

    expect(result.current.goals.data).toEqual({ goals, custom: true });
  });

  it('shows what the other phone sent once a sync has brought it in', async () => {
    const { result } = await render();
    await waitFor(() => expect(result.current.meals.data).toEqual([]));

    await put('from-kush', MEAL_KIND, mealData({ food: 'Khichdi', by: 'kush' }), 1);
    // What a pull that brings records in does: it refreshes everything under the vault key.
    await act(async () => {
      await result.current.client.invalidateQueries({ queryKey: vaultKey(P) });
    });
    await settle();

    await waitFor(() => expect(result.current.meals.data?.map((m) => m.food)).toEqual(['Khichdi']));
  });

  it.each([
    ['still opening', { state: 'loading', store: null, sync: null }],
    ['without the household key', { state: 'needs-key', sync: null }],
    ['unable to open', { state: 'error', store: null, sync: null }],
    ['on the web', { state: 'unsupported', store: null, sync: null }],
  ] as const)('reads nothing on a phone that is %s', async (_why, over) => {
    await put('lunch', MEAL_KIND, mealData(), 1);
    const { result } = await render({ vault: { ...ready.vault, ...over } as Vault });

    expect(result.current.meals.fetchStatus).toBe('idle');
    expect(result.current.meals.data).toBeUndefined();
    expect(result.current.cravings.data).toBeUndefined();
    expect(result.current.goals.data).toBeUndefined();
  });

  it('reads nothing without a pregnancy', async () => {
    const { result } = await render({ pregnancyId: undefined });
    expect(result.current.meals.fetchStatus).toBe('idle');
  });
});

describe('changing', () => {
  it('saves a meal on the phone under a new id, shows it, and asks for one sync', async () => {
    const { result } = await render();
    await waitFor(() => expect(result.current.meals.data).toEqual([]));

    await act(async () => {
      await result.current.addMeal.mutateAsync(mealData({ food: 'Paneer paratha' }));
    });
    await settle();

    const [saved, ...rest] = await ready.store.list(P, MEAL_KIND);
    expect(rest).toEqual([]);
    expect(saved.id).toMatch(UUID_V4);
    expect(saved).toMatchObject({ pregnancyId: P, kind: MEAL_KIND, dirty: true, deleted: false });
    expect(saved.data).toEqual(mealData({ food: 'Paneer paratha' }));
    expect(ready.syncs).toHaveLength(1);
    await waitFor(() => expect(result.current.meals.data?.map((m) => m.food)).toEqual(['Paneer paratha']));
  });

  it('gives each meal a new id', async () => {
    const { result } = await render();
    await act(async () => {
      await result.current.addMeal.mutateAsync(mealData({ food: 'First' }));
      await result.current.addMeal.mutateAsync(mealData({ food: 'Second' }));
    });
    await settle();
    expect(new Set((await ready.store.list(P, MEAL_KIND)).map((r) => r.id)).size).toBe(2);
  });

  it('refreshes every list before the caller hears it worked, so a sheet can close on the new list', async () => {
    const { result } = await render();
    await waitFor(() => expect(result.current.meals.isSuccess && result.current.cravings.isSuccess).toBe(true));

    await waitFor(() => expect(result.current.goals.isSuccess).toBe(true));

    let seen: { meals?: unknown; cravings?: unknown; goals?: unknown } = {};
    const goals = { protein: 80, iron: 30, calcium: 900, folate: 500, fibre: 30 };
    await act(async () => {
      await result.current.addMeal.mutateAsync(mealData({ food: 'Toast' }), {
        onSuccess: () => {
          seen = {
            meals: (result.current.client.getQueryData(vaultQueryKey(P, MEAL_KIND)) as Meal[]).map((m) => m.food),
          };
        },
      });
      await result.current.addCraving.mutateAsync('Pickles', {
        onSuccess: () => {
          seen = { ...seen, cravings: (result.current.client.getQueryData(vaultQueryKey(P, CRAVING_KIND)) as { text: string }[]).map((c) => c.text) };
        },
      });
      await result.current.saveGoals.mutateAsync(goals, {
        onSuccess: () => {
          seen = { ...seen, goals: result.current.client.getQueryData(vaultQueryKey(P, GOALS_KIND)) };
        },
      });
    });
    await settle();

    expect(seen).toEqual({ meals: ['Toast'], cravings: ['Pickles'], goals: { goals, custom: true } });
  });

  it('saves a craving as its text', async () => {
    const { result } = await render();
    await act(async () => {
      await result.current.addCraving.mutateAsync('Pickles');
    });
    await settle();

    const [saved, ...rest] = await ready.store.list(P, CRAVING_KIND);
    expect(rest).toEqual([]);
    expect(saved.id).toMatch(UUID_V4);
    expect(saved.data).toEqual({ text: 'Pickles' });
    expect(ready.syncs).toHaveLength(1);
  });

  it('saves the goals as the household’s one record, and changes that record when they are saved again', async () => {
    const { result } = await render();
    const first = { protein: 80, iron: 30, calcium: 900, folate: 500, fibre: 30 };
    await act(async () => {
      await result.current.saveGoals.mutateAsync(first);
    });
    await settle();
    await act(async () => {
      await result.current.saveGoals.mutateAsync({ ...first, protein: 85 });
    });
    await settle();

    const saved = await ready.store.list(P, GOALS_KIND);
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe(goalsRecordId(P));
    expect(saved[0].data).toEqual({ ...first, protein: 85 });
    expect(ready.syncs).toHaveLength(2);
    await waitFor(() => expect(result.current.goals.data).toEqual({ goals: { ...first, protein: 85 }, custom: true }));
  });

  it('removes a record on both phones: a tombstone, a sync, and gone from the list', async () => {
    await put('lunch', MEAL_KIND, mealData(), 1);
    await ready.store.markClean('lunch', at(1).toISOString());
    const { result } = await render();
    await waitFor(() => expect(result.current.meals.data?.map((m) => m.id)).toEqual(['lunch']));

    await act(async () => {
      await result.current.remove.mutateAsync('lunch');
    });
    await settle();

    expect(await ready.store.get('lunch')).toMatchObject({ deleted: true, data: null, dirty: true });
    expect(ready.syncs).toHaveLength(1);
    await waitFor(() => expect(result.current.meals.data).toEqual([]));
  });

  it('works on a phone whose sync has not started', async () => {
    const { result } = await render({ vault: { ...ready.vault, sync: null } });
    await act(async () => {
      await result.current.addCraving.mutateAsync('Pickles');
    });
    await settle();
    expect(await ready.store.list(P, CRAVING_KIND)).toHaveLength(1);
  });

  it.each([
    ['still opening', { state: 'loading', store: null, sync: null }],
    ['without the household key', { state: 'needs-key', sync: null }],
  ] as const)('fails and writes nothing on a phone that is %s', async (_why, over) => {
    const { result } = await render({ vault: { ...ready.vault, ...over } as Vault });

    await act(async () => {
      await expect(result.current.addMeal.mutateAsync(mealData())).rejects.toThrow('household key');
      await expect(result.current.addCraving.mutateAsync('Pickles')).rejects.toThrow('household key');
      await expect(result.current.saveGoals.mutateAsync(DEFAULT_GOALS)).rejects.toThrow('household key');
      await expect(result.current.remove.mutateAsync('anything')).rejects.toThrow('household key');
    });
    await settle();

    expect(await ready.store.list(P, MEAL_KIND)).toEqual([]);
    expect(await ready.store.list(P, CRAVING_KIND)).toEqual([]);
    expect(await ready.store.list(P, GOALS_KIND)).toEqual([]);
    expect(ready.syncs).toEqual([]);
  });

  it('fails when there is no pregnancy to save to', async () => {
    const { result } = await render({ pregnancyId: undefined });
    await act(async () => {
      await expect(result.current.addMeal.mutateAsync(mealData())).rejects.toThrow('no pregnancy');
    });
    await settle();
    expect(ready.syncs).toEqual([]);
  });

  it('fails, and asks for no sync, when the phone cannot write', async () => {
    const { result } = await render();
    await waitFor(() => expect(result.current.meals.data).toEqual([]));
    const writes = jest.spyOn(ready.store, 'put').mockRejectedValue(new Error('disk full'));

    await act(async () => {
      await expect(result.current.addMeal.mutateAsync(mealData())).rejects.toThrow('disk full');
    });
    await settle();
    writes.mockRestore();

    expect(await ready.store.list(P, MEAL_KIND)).toEqual([]);
    expect(ready.syncs).toEqual([]);
    expect(result.current.meals.data).toEqual([]);
  });
});
