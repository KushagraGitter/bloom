import { useMutation, useQueryClient } from '@tanstack/react-query';

import { localToday } from '@/lib/pregnancy';
import { ENTRY_KIND, SYMPTOM_KIND, newestFirst, type CustomSymptom, type MoodEntry, type MoodKey } from '@/lib/mood';
import { useSession } from '@/lib/session';
import { listItems, newId, removeItems, saveItem, useVaultQuery, vaultQueryKey } from '@/lib/vault/records';
import { useVault } from '@/lib/vault/VaultProvider';

const moodKey = (pregnancyId: string | undefined) => vaultQueryKey(pregnancyId, 'mood');

export type SavedEntry = MoodEntry & { id: string };

/** Every saved entry, newest first. */
export function useMoodEntries(pregnancyId: string | undefined) {
  return useVaultQuery(pregnancyId, ['mood', 'entries'], async (store, pid): Promise<SavedEntry[]> =>
    newestFirst((await listItems<MoodEntry>(store, pid, ENTRY_KIND)).map((item) => ({ id: item.id, ...item.data }))),
  );
}

/** Symptoms she added to the list, oldest first. */
export function useCustomSymptoms(pregnancyId: string | undefined) {
  return useVaultQuery(pregnancyId, ['mood', 'symptoms'], async (store, pid) =>
    (await listItems<CustomSymptom>(store, pid, SYMPTOM_KIND)).map((item) => ({ id: item.id, label: item.data.label })),
  );
}

/** Saves a new entry. Each save is its own entry, so she can check in more than once a day. */
export function useSaveMood(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  const { session } = useSession();
  return useMutation({
    mutationFn: async (input: { mood: MoodKey; symptoms: string[]; note: string }) => {
      const now = new Date();
      const entry: MoodEntry = {
        day: localToday(now),
        at: now.toISOString(),
        mood: input.mood,
        symptoms: input.symptoms,
        note: input.note.trim(),
        by: session?.user.id ?? '',
      };
      await saveItem(vault, { id: newId(), pregnancyId: pregnancyId!, kind: ENTRY_KIND, data: entry });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: moodKey(pregnancyId) }),
  });
}

export function useRemoveMood(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  return useMutation({
    mutationFn: (id: string) => removeItems(vault, [id]),
    onSettled: () => queryClient.invalidateQueries({ queryKey: moodKey(pregnancyId) }),
  });
}

export function useAddSymptom(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  return useMutation({
    mutationFn: (label: string) => saveItem(vault, { id: newId(), pregnancyId: pregnancyId!, kind: SYMPTOM_KIND, data: { label } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: moodKey(pregnancyId) }),
  });
}

/** Takes one of her own symptoms off the list. Past entries keep it. */
export function useRemoveSymptom(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  return useMutation({
    mutationFn: (ids: string[]) => removeItems(vault, ids),
    onSettled: () => queryClient.invalidateQueries({ queryKey: moodKey(pregnancyId) }),
  });
}
