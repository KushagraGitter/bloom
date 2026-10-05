import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { useSession } from '@/lib/session';
import { listItems, readyStore, removeItems, saveItem, stableId, useVaultQuery, vaultQueryKey } from '@/lib/vault/records';
import { useVault } from '@/lib/vault/VaultProvider';
import { SAVED_KIND, SEEN_KIND, withSeen, type CardKind, type SavedThought, type SeenCards } from '@/lib/weeklyCards';

const cardsKey = (pregnancyId: string | undefined) => vaultQueryKey(pregnancyId, 'cards');

/** Each person's seen cards for a week have one record, so both phones add to the same one. */
export const seenId = (pregnancyId: string, userId: string, week: number) => stableId(SEEN_KIND, pregnancyId, userId, String(week));

/** A week's kind thought is saved once for the household. */
export const savedId = (pregnancyId: string, week: number) => stableId(SAVED_KIND, pregnancyId, String(week));

/** The cards this person has seen, by week. */
export function useSeenCards(pregnancyId: string | undefined) {
  const { session } = useSession();
  const userId = session?.user.id;
  return useVaultQuery(pregnancyId, ['cards', 'seen', userId], async (store, pid) => {
    const byWeek = new Map<number, CardKind[]>();
    for (const item of await listItems<SeenCards>(store, pid, SEEN_KIND)) {
      if (item.data.by === userId) byWeek.set(item.data.week, item.data.seen);
    }
    return byWeek;
  });
}

/** Saved kind thoughts, newest first. */
export function useSavedThoughts(pregnancyId: string | undefined) {
  return useVaultQuery(pregnancyId, ['cards', 'saved'], async (store, pid) =>
    (await listItems<SavedThought>(store, pid, SAVED_KIND))
      .map((item) => ({ id: item.id, ...item.data }))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
  );
}

/**
 * Marks a card as seen by this person. Marks are written one after another,
 * each adding to what the store holds, so a quick swipe through the deck keeps
 * every card it passed.
 */
export function useMarkSeen(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  const { session } = useSession();
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  return useMutation({
    mutationFn: ({ week, kind }: { week: number; kind: CardKind }) => {
      const run = async () => {
        const by = session?.user.id ?? '';
        const id = seenId(pregnancyId!, by, week);
        const current = await readyStore(vault).get(id);
        const seen = current && !current.deleted ? (current.data as SeenCards).seen : [];
        if (seen.includes(kind)) return;
        const data: SeenCards = { week, by, seen: withSeen(seen, kind) };
        await saveItem(vault, { id, pregnancyId: pregnancyId!, kind: SEEN_KIND, data });
      };
      const next = queue.current.then(run, run);
      queue.current = next.catch(() => {});
      return next;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: cardsKey(pregnancyId) }),
  });
}

/** Saves a week's kind thought, or takes it off the saved list. */
export function useSaveThought(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  return useMutation({
    mutationFn: async ({ week, saved }: { week: number; saved: boolean }) => {
      const id = savedId(pregnancyId!, week);
      if (!saved) return removeItems(vault, [id]);
      const data: SavedThought = { week, savedAt: new Date().toISOString() };
      await saveItem(vault, { id, pregnancyId: pregnancyId!, kind: SAVED_KIND, data });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: cardsKey(pregnancyId) }),
  });
}
