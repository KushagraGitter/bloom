import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { HouseholdKey } from '@/lib/vault/crypto';
import type { LocalStore } from '@/lib/vault/localStore';
import { supabaseVault } from '@/lib/vault/remote';
import { syncOnce, type SyncResult, type VaultRemote } from '@/lib/vault/sync';

/** Query keys of anything read from the local store start with this, so a pull can refresh them all. */
export const vaultKey = (pregnancyId: string) => ['vault', pregnancyId] as const;

/**
 * Runs one sync at a time. A request that arrives mid-sync is folded into a
 * single follow-up run, so a burst of edits or nudges costs at most two syncs.
 */
export function createSyncRunner(run: () => Promise<SyncResult>, onDone: (result: SyncResult | null, error: unknown) => void) {
  let running: Promise<void> | null = null;
  let again = false;

  const loop = async () => {
    do {
      again = false;
      try {
        onDone(await run(), null);
      } catch (error) {
        onDone(null, error);
      }
    } while (again);
    running = null;
  };

  return {
    request(): Promise<void> {
      if (running) {
        again = true;
        return running;
      }
      running = loop();
      return running;
    },
  };
}

export type VaultSyncStatus = { syncing: boolean; error: unknown; lastSyncedAt: Date | null };

/**
 * Keeps this phone's records and the household's encrypted copies in step:
 * syncs when mounted, when the app comes back to the foreground, when the
 * other phone writes (a realtime nudge, which carries nothing readable) and
 * whenever `requestSync` is called after a local change. Mount once, from the
 * tabs layout.
 */
export function useVaultSync({
  pregnancyId,
  store,
  householdKey,
  remote = supabaseVault,
}: {
  pregnancyId: string | undefined;
  store: LocalStore | null;
  householdKey: HouseholdKey | null;
  remote?: VaultRemote;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<VaultSyncStatus>({ syncing: false, error: null, lastSyncedAt: null });

  const runner = useMemo(() => {
    if (!pregnancyId || !store || !householdKey) return null;
    return createSyncRunner(
      () => {
        setStatus((s) => ({ ...s, syncing: true }));
        return syncOnce({ store, remote, key: householdKey, pregnancyId });
      },
      (result, error) => {
        setStatus((s) => ({ syncing: false, error, lastSyncedAt: result ? new Date() : s.lastSyncedAt }));
        if (result && result.pulled > 0) queryClient.invalidateQueries({ queryKey: vaultKey(pregnancyId) });
      },
    );
  }, [pregnancyId, store, householdKey, remote, queryClient]);

  useEffect(() => {
    if (!runner || !pregnancyId) return;
    runner.request();

    const channel = supabase
      .channel(`vault:${pregnancyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vault_records', filter: `pregnancy_id=eq.${pregnancyId}` },
        () => runner.request(),
      )
      .subscribe();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') runner.request();
    });

    return () => {
      supabase.removeChannel(channel);
      appState.remove();
    };
  }, [runner, pregnancyId]);

  return { ...status, requestSync: () => runner?.request() ?? Promise.resolve() };
}
