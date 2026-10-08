import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import type { HouseholdKey } from '@/lib/vault/crypto';
import { resolveHouseholdKey, keyFitsHousehold } from '@/lib/vault/householdKey';
import { loadHouseholdKey, saveHouseholdKey } from '@/lib/vault/keys';
import type { LocalStore } from '@/lib/vault/localStore';
import { openLocalStoreAsync } from '@/lib/vault/openDb';
import { countVaultRecords, supabaseVault } from '@/lib/vault/remote';
import { useVaultSync } from '@/lib/vault/useVaultSync';

export type VaultState =
  /** Not signed in to a pregnancy yet. */
  | 'idle'
  | 'loading'
  /** This phone has the key and syncs. */
  | 'ready'
  /** This phone has to be given the key, by QR code or recovery phrase. */
  | 'needs-key'
  /** Couldn't check (usually offline on first open). */
  | 'error'
  /** The web build has no keychain or on-phone database. */
  | 'unsupported';

export type Vault = {
  state: VaultState;
  role: 'owner' | 'partner' | null;
  householdKey: HouseholdKey | null;
  store: LocalStore | null;
  /** Sync status, and `requestSync` to upload a change straight away. Null until ready. */
  sync: ReturnType<typeof useVaultSync> | null;
  /** Takes a key scanned or typed on this phone. Resolves false if it doesn't belong to this household. */
  adoptKey: (key: HouseholdKey) => Promise<boolean>;
  retry: () => void;
};

const noop = async () => false;
const IDLE: Vault = {
  state: 'idle',
  role: null,
  householdKey: null,
  store: null,
  sync: null,
  adoptKey: noop,
  retry: () => {},
};

/** Exported so tests can hand screens a ready vault. */
export const VaultContext = createContext<Vault>(IDLE);

/** The phone's own database, opened once for the life of the app. Onboarding uses it before the provider is mounted. */
let storePromise: Promise<LocalStore> | null = null;
export function openLocalStore() {
  storePromise ??= openLocalStoreAsync();
  storePromise.catch(() => {
    storePromise = null;
  });
  return storePromise;
}

/**
 * Gives the app this phone's local store and household key for the signed-in
 * pregnancy, and keeps it syncing. Mount once, inside the signed-in part of
 * the app; `useVault` returns an idle vault outside it.
 */
export function VaultProvider({
  pregnancyId,
  role,
  children,
}: {
  pregnancyId: string | undefined;
  role: 'owner' | 'partner' | undefined;
  children: ReactNode;
}) {
  const unsupported = Platform.OS === 'web';
  const [attempt, setAttempt] = useState(0);
  // What the last check found, and for which pregnancy, role and attempt; a
  // check for anything else is still running.
  const [result, setResult] = useState<{
    for: string;
    state: 'ready' | 'needs-key' | 'error';
    key: HouseholdKey | null;
    store: LocalStore | null;
  } | null>(null);
  const current = pregnancyId && role ? `${pregnancyId}:${role}:${attempt}` : null;

  useEffect(() => {
    if (unsupported || !current || !pregnancyId || !role) return;
    let cancelled = false;
    (async () => {
      const opened = await openLocalStore();
      const resolved = await resolveHouseholdKey({
        role,
        loadKey: () => loadHouseholdKey(pregnancyId),
        saveKey: (key) => saveHouseholdKey(pregnancyId, key),
        countRecords: () => countVaultRecords(pregnancyId),
      });
      if (cancelled) return;
      setResult({
        for: current,
        state: resolved.status,
        key: resolved.status === 'ready' ? resolved.key : null,
        store: opened,
      });
    })().catch(() => {
      if (!cancelled) setResult({ for: current, state: 'error', key: null, store: null });
    });
    return () => {
      cancelled = true;
    };
  }, [unsupported, current, pregnancyId, role]);

  const settled = result && result.for === current ? result : null;
  const state: VaultState = unsupported ? 'unsupported' : !current ? 'idle' : (settled?.state ?? 'loading');
  const householdKey = settled?.key ?? null;
  const store = settled?.store ?? null;

  const sync = useVaultSync({ pregnancyId, store, householdKey });

  const adoptKey = useCallback(
    async (key: HouseholdKey) => {
      if (!pregnancyId) return false;
      if (!(await keyFitsHousehold(key, pregnancyId, supabaseVault))) return false;
      await saveHouseholdKey(pregnancyId, key);
      setResult((r) => (r && r.for === current ? { ...r, state: 'ready', key } : r));
      return true;
    },
    [pregnancyId, current],
  );

  const value = useMemo<Vault>(
    () => ({
      state,
      role: role ?? null,
      householdKey,
      store,
      sync: state === 'ready' ? sync : null,
      adoptKey,
      retry: () => setAttempt((n) => n + 1),
    }),
    [state, role, householdKey, store, sync, adoptKey],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): Vault {
  return useContext(VaultContext);
}
