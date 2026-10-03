import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';

import { newHouseholdKey, type HouseholdKey } from '@/lib/vault/crypto';
import { keyFitsHousehold } from '@/lib/vault/householdKey';
import { loadHouseholdKey, saveHouseholdKey } from '@/lib/vault/keys';
import { countVaultRecords } from '@/lib/vault/remote';
import { useVaultSync } from '@/lib/vault/useVaultSync';
import { useVault, VaultProvider } from '@/lib/vault/VaultProvider';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)),
}));
jest.mock('@/lib/vault/keys', () => ({ loadHouseholdKey: jest.fn(), saveHouseholdKey: jest.fn(async () => {}) }));
jest.mock('@/lib/vault/remote', () => ({ countVaultRecords: jest.fn(), supabaseVault: {} }));
jest.mock('@/lib/vault/openDb', () => ({ openLocalStoreAsync: jest.fn(async () => ({ mockStore: true })) }));
jest.mock('@/lib/vault/useVaultSync', () => ({ useVaultSync: jest.fn(() => ({ syncing: false, error: null, lastSyncedAt: null })) }));
jest.mock('@/lib/vault/householdKey', () => ({
  ...jest.requireActual('@/lib/vault/householdKey'),
  keyFitsHousehold: jest.fn(async () => true),
}));

async function mount(role: 'owner' | 'partner' | undefined, pregnancyId: string | undefined = 'p1') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <VaultProvider pregnancyId={pregnancyId} role={role}>
      {children}
    </VaultProvider>
  );
  const { result } = await renderHook(() => useVault(), { wrapper });
  return result;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(loadHouseholdKey).mockResolvedValue(null);
  jest.mocked(countVaultRecords).mockResolvedValue(0);
});

describe('VaultProvider', () => {
  it('is idle outside a pregnancy', async () => {
    const vault = await mount(undefined, undefined);
    expect(vault.current.state).toBe('idle');
    expect(loadHouseholdKey).not.toHaveBeenCalled();
  });

  it('sets up the key on her phone the first time, and starts syncing with it', async () => {
    const vault = await mount('owner');
    await waitFor(() => expect(vault.current.state).toBe('ready'));
    const saved = jest.mocked(saveHouseholdKey).mock.calls[0];
    expect(saved[0]).toBe('p1');
    expect(vault.current.householdKey).toBe(saved[1]);
    expect(jest.mocked(useVaultSync)).toHaveBeenLastCalledWith({ pregnancyId: 'p1', store: { mockStore: true }, householdKey: saved[1] });
  });

  it('waits for the key on the partner’s phone, and takes one that fits', async () => {
    const vault = await mount('partner');
    await waitFor(() => expect(vault.current.state).toBe('needs-key'));
    expect(jest.mocked(useVaultSync)).toHaveBeenLastCalledWith(expect.objectContaining({ householdKey: null }));

    const wrong = newHouseholdKey();
    jest.mocked(keyFitsHousehold).mockResolvedValueOnce(false);
    let ok: boolean | undefined;
    await act(async () => {
      ok = await vault.current.adoptKey(wrong);
    });
    expect(ok).toBe(false);
    expect(saveHouseholdKey).not.toHaveBeenCalled();

    const right: HouseholdKey = newHouseholdKey();
    await act(async () => {
      ok = await vault.current.adoptKey(right);
    });
    expect(ok).toBe(true);
    expect(saveHouseholdKey).toHaveBeenCalledWith('p1', right);
    expect(vault.current.state).toBe('ready');
    expect(vault.current.householdKey).toBe(right);
  });

  it('reports a failed check and can try again', async () => {
    jest.mocked(countVaultRecords).mockRejectedValueOnce(new Error('offline'));
    const vault = await mount('owner');
    await waitFor(() => expect(vault.current.state).toBe('error'));
    await act(async () => vault.current.retry());
    await waitFor(() => expect(vault.current.state).toBe('ready'));
  });

  it('does nothing on the web', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const vault = await mount('owner');
    expect(vault.current.state).toBe('unsupported');
    expect(loadHouseholdKey).not.toHaveBeenCalled();
  });
});
