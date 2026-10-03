import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { LocalStore } from '@/lib/vault/localStore';
import { readyVault } from '@/lib/vault/testHelpers';
import { vaultWrapper } from '@/lib/vault/testWrapper';
import type { Vault } from '@/lib/vault/VaultProvider';

import { doseId, useDoses, useToggleDose } from '../data';

jest.mock('@/lib/session', () => ({ useSession: () => ({ session: { user: { id: 'me' } }, loading: false }) }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)) }));

const DAY = '2026-10-03';

let vault: Vault;
let store: LocalStore;
let syncs: number[];

beforeEach(async () => {
  ({ vault, store, syncs } = await readyVault());
});

async function setup() {
  return renderHook(() => ({ toggle: useToggleDose('p1'), doses: useDoses('p1') }), { wrapper: vaultWrapper(vault) });
}

describe('useToggleDose', () => {
  it('saves a tick in the vault, stamped with who made it, and starts a sync', async () => {
    const { result } = await setup();
    await act(async () => {
      await result.current.toggle.mutateAsync({ medicationId: 'm1', day: DAY, taken: true });
    });

    expect(await store.get(doseId('m1', DAY))).toMatchObject({
      kind: 'dose',
      dirty: true,
      deleted: false,
      data: { medication_id: 'm1', day: DAY, logged_by: 'me' },
    });
    expect(syncs).toHaveLength(1);
    await waitFor(() => expect(result.current.doses.data).toEqual([expect.objectContaining({ medication_id: 'm1', pregnancy_id: 'p1', day: DAY })]));
  });

  it('un-ticks only that dose, leaving a delete for the other phone', async () => {
    const { result } = await setup();
    await act(async () => {
      await result.current.toggle.mutateAsync({ medicationId: 'm1', day: DAY, taken: true });
      await result.current.toggle.mutateAsync({ medicationId: 'm2', day: DAY, taken: true });
      await result.current.toggle.mutateAsync({ medicationId: 'm1', day: DAY, taken: false });
    });

    expect(await store.get(doseId('m1', DAY))).toMatchObject({ deleted: true, dirty: true, data: null });
    await waitFor(() => expect(result.current.doses.data?.map((d) => d.medication_id)).toEqual(['m2']));
  });

  it('gives a dose the same id on either phone, so ticking it on both leaves one', () => {
    expect(doseId('m1', DAY)).toBe(doseId('m1', DAY));
    expect(doseId('m1', DAY)).not.toBe(doseId('m1', '2026-10-04'));
    expect(doseId('m1', DAY)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('applies a quick tick and un-tick in the order they were made', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.toggle.mutate({ medicationId: 'm1', day: DAY, taken: true });
      result.current.toggle.mutate({ medicationId: 'm1', day: DAY, taken: false });
    });

    await waitFor(() => expect(result.current.toggle.isSuccess).toBe(true));
    await waitFor(async () => expect(await store.get(doseId('m1', DAY))).toMatchObject({ deleted: true }));
  });

  it('fails without touching anything on a phone that has no key yet', async () => {
    const locked: Vault = { ...vault, state: 'needs-key', householdKey: null, sync: null };
    const { result } = await renderHook(() => useToggleDose('p1'), { wrapper: vaultWrapper(locked) });
    await act(async () => {
      result.current.mutate({ medicationId: 'm1', day: DAY, taken: true });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(await store.get(doseId('m1', DAY))).toBeNull();
  });
});
