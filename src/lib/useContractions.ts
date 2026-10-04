import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  CONTRACTION_KIND,
  PLAN_KIND,
  SESSION_END_KIND,
  cleanPlan,
  toSessions,
  type CallPlan,
  type Contraction,
  type Session,
  type SessionEnd,
  type TimedContraction,
} from '@/lib/contractions';
import { useSession } from '@/lib/session';
import { listItems, newId, removeItems, saveItem, stableId, useVaultQuery, vaultQueryKey } from '@/lib/vault/records';
import { useVault } from '@/lib/vault/VaultProvider';

const contractionsKey = (pregnancyId: string | undefined) => vaultQueryKey(pregnancyId, 'contractions');

/** One call plan per household, the same record on both phones. */
const planId = (pregnancyId: string) => stableId('contraction-plan', pregnancyId);

export type TimerData = { sessions: Session[]; endedIds: string[]; contractions: TimedContraction[] };

/** Every timed contraction grouped into sessions, and the sessions she ended. */
export function useContractions(pregnancyId: string | undefined) {
  return useVaultQuery(pregnancyId, ['contractions', 'all'], async (store, pid): Promise<TimerData> => {
    const contractions = (await listItems<Contraction>(store, pid, CONTRACTION_KIND)).map((i) => ({ id: i.id, ...i.data }));
    const endedIds = (await listItems<SessionEnd>(store, pid, SESSION_END_KIND)).map((i) => i.id);
    return { sessions: toSessions(contractions), endedIds, contractions };
  });
}

export function useCallPlan(pregnancyId: string | undefined) {
  return useVaultQuery(pregnancyId, ['contractions', 'plan'], async (store, pid): Promise<CallPlan | null> => {
    const record = await store.get(planId(pid));
    return record && !record.deleted ? (record.data as CallPlan) : null;
  });
}

/**
 * Starts a contraction at the moment of the tap, in the current session or a
 * new one. It is saved straight away, so leaving the app or closing it does
 * not lose the start.
 */
export function useStartContraction(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  const { session } = useSession();
  return useMutation({
    mutationFn: async ({ at, sessionId }: { at: Date; sessionId: string | null }) => {
      const contraction: Contraction = { session: sessionId ?? newId(), start: at.toISOString(), end: null, by: session?.user.id ?? '' };
      await saveItem(vault, { id: newId(), pregnancyId: pregnancyId!, kind: CONTRACTION_KIND, data: contraction });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: contractionsKey(pregnancyId) }),
  });
}

export function useStopContraction(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  return useMutation({
    mutationFn: async ({ running, at }: { running: TimedContraction; at: Date }) => {
      const { id, ...data } = running;
      const contraction: Contraction = { ...data, end: at.toISOString() };
      await saveItem(vault, { id, pregnancyId: pregnancyId!, kind: CONTRACTION_KIND, data: contraction });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: contractionsKey(pregnancyId) }),
  });
}

/** Deletes contractions: one started by mistake, one row, or a whole session. */
export function useRemoveContractions(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  return useMutation({
    mutationFn: (ids: string[]) => removeItems(vault, ids),
    onSettled: () => queryClient.invalidateQueries({ queryKey: contractionsKey(pregnancyId) }),
  });
}

/** Ends the current session, so the next tap starts a new one. Nothing is deleted. */
export function useEndSession(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  return useMutation({
    mutationFn: (sessionId: string) =>
      saveItem(vault, { id: sessionId, pregnancyId: pregnancyId!, kind: SESSION_END_KIND, data: { ended: new Date().toISOString() } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: contractionsKey(pregnancyId) }),
  });
}

export function useSaveCallPlan(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  return useMutation({
    mutationFn: (plan: CallPlan) =>
      saveItem(vault, { id: planId(pregnancyId!), pregnancyId: pregnancyId!, kind: PLAN_KIND, data: cleanPlan(plan) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: contractionsKey(pregnancyId) }),
  });
}
