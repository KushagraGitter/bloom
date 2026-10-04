/**
 * Meals, cravings and goals as the Meals tab reads and writes them: records on
 * this phone, synced to the other phone encrypted.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  CRAVING_KIND,
  GOALS_KIND,
  MEAL_KIND,
  cravingFromItem,
  goalsFromItems,
  mealFromItem,
  type Goals,
  type MealData,
} from '@/lib/meals';
import { fileForScan, scanMeal, type PickedFile } from '@/lib/scan';
import { listItems, newId, removeItems, saveItem, stableId, useVaultQuery, vaultQueryKey } from '@/lib/vault/records';
import { useVault, type Vault } from '@/lib/vault/VaultProvider';

/** The one goals record a household has. Both phones work out the same id, so they edit it together. */
export const goalsRecordId = (pregnancyId: string) => stableId(GOALS_KIND, pregnancyId);

/** Every meal logged, on every day. */
export function useMeals(pregnancyId: string | undefined) {
  return useVaultQuery(pregnancyId, [MEAL_KIND], async (store, pregnancy) =>
    (await listItems<unknown>(store, pregnancy, MEAL_KIND)).flatMap((item) => mealFromItem(item) ?? []),
  );
}

/** Cravings and aversions, in the order they were added. */
export function useCravings(pregnancyId: string | undefined) {
  return useVaultQuery(pregnancyId, [CRAVING_KIND], async (store, pregnancy) =>
    (await listItems<unknown>(store, pregnancy, CRAVING_KIND)).flatMap((item) => cravingFromItem(item) ?? []),
  );
}

/** The goals in use, and whether they are her own or the starting ones. */
export function useGoals(pregnancyId: string | undefined) {
  return useVaultQuery(pregnancyId, [GOALS_KIND], async (store, pregnancy) =>
    goalsFromItems(await listItems<unknown>(store, pregnancy, GOALS_KIND)),
  );
}

/**
 * A change to these records. It lands in this phone's own database first, so it
 * never waits on the network, and a sync carries it to the other phone. Every
 * list is then refreshed before the caller hears it worked, so a sheet can
 * close on the new list.
 */
function useChange<V>(pregnancyId: string | undefined, write: (vault: Vault, pregnancyId: string, vars: V) => Promise<void>) {
  const vault = useVault();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: V) => {
      if (!pregnancyId) throw new Error('There is no pregnancy to save to.');
      await write(vault, pregnancyId, vars);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: vaultQueryKey(pregnancyId) }),
  });
}

export function useAddMeal(pregnancyId: string | undefined) {
  return useChange(pregnancyId, (vault, pregnancy, data: MealData) =>
    saveItem(vault, { id: newId(), pregnancyId: pregnancy, kind: MEAL_KIND, data }),
  );
}

export function useAddCraving(pregnancyId: string | undefined) {
  return useChange(pregnancyId, (vault, pregnancy, text: string) =>
    saveItem(vault, { id: newId(), pregnancyId: pregnancy, kind: CRAVING_KIND, data: { text } }),
  );
}

/** There is one goals record per household, so saving again changes it for both phones. */
export function useSaveGoals(pregnancyId: string | undefined) {
  return useChange(pregnancyId, (vault, pregnancy, goals: Goals) =>
    saveItem(vault, { id: goalsRecordId(pregnancy), pregnancyId: pregnancy, kind: GOALS_KIND, data: goals }),
  );
}

/** Removes a meal or a craving on both phones. */
export function useRemoveItem(pregnancyId: string | undefined) {
  return useChange(pregnancyId, (vault, _pregnancy, id: string) => removeItems(vault, [id]));
}

/**
 * Reads a photo of a plate with the AI. Nothing is saved: the foods go to the
 * add sheet, and only the meal saved there is kept. The photo is not kept.
 */
export function useScanMeal() {
  return useMutation({
    mutationFn: async (input: { pregnancyId: string; file: PickedFile; week: number | null }) =>
      scanMeal({ pregnancyId: input.pregnancyId, week: input.week, file: await fileForScan(input.file) }),
  });
}
