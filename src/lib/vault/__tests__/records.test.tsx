import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useQueryClient } from '@tanstack/react-query';

import { listItems, newId, removeItems, saveItem, stableId, useVaultQuery, VaultNotReadyError } from '@/lib/vault/records';
import { readyVault } from '@/lib/vault/testHelpers';
import { vaultWrapper } from '@/lib/vault/testWrapper';
import { vaultKey } from '@/lib/vault/useVaultSync';

jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)) }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[48][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('ids', () => {
  it('makes random v4 ids that fit the server’s uuid column', () => {
    const a = newId();
    expect(a).toMatch(UUID);
    expect(a[14]).toBe('4');
    expect(newId()).not.toBe(a);
  });

  it('makes the same id from the same parts, and a different one if any part differs', () => {
    expect(stableId('dose', 'm1', '2026-10-03')).toBe(stableId('dose', 'm1', '2026-10-03'));
    expect(stableId('dose', 'm1', '2026-10-03')).toMatch(UUID);
    expect(stableId('dose', 'm1', '2026-10-03')).not.toBe(stableId('dose', 'm1', '2026-10-04'));
    // Parts are kept apart, so moving text between them changes the id.
    expect(stableId('ab', 'c')).not.toBe(stableId('a', 'bc'));
  });
});

describe('saving and reading', () => {
  it('saves, lists and deletes records, starting a sync after each change', async () => {
    const { vault, store, syncs } = await readyVault();
    await saveItem(vault, { id: 'r1', pregnancyId: 'p1', kind: 'note', data: { text: 'hi' } });
    await saveItem(vault, { id: 'r2', pregnancyId: 'p1', kind: 'note', data: { text: 'there' } });
    expect((await listItems(store, 'p1', 'note')).map((i) => i.data)).toEqual([{ text: 'hi' }, { text: 'there' }]);

    await removeItems(vault, ['r1']);
    expect((await listItems(store, 'p1', 'note')).map((i) => i.id)).toEqual(['r2']);
    expect(syncs).toHaveLength(3);
  });

  it('refuses to save on a phone without the key', async () => {
    const { vault } = await readyVault();
    await expect(saveItem({ ...vault, state: 'needs-key' }, { id: 'r1', pregnancyId: 'p1', kind: 'note', data: {} })).rejects.toBeInstanceOf(
      VaultNotReadyError,
    );
  });

  it('reads once the phone has the key, and again when a sync brings in changes', async () => {
    const { vault, store } = await readyVault();
    const { result } = await renderHook(
      () => ({ notes: useVaultQuery('p1', ['notes'], (s, pid) => listItems(s, pid, 'note')), client: useQueryClient() }),
      { wrapper: vaultWrapper(vault) },
    );
    await waitFor(() => expect(result.current.notes.data).toEqual([]));

    // As if pulled from the other phone.
    await store.put({ id: 'r1', pregnancyId: 'p1', kind: 'note', data: { text: 'hi' }, updatedAt: '2026-10-03T10:00:00.000Z', deleted: false, dirty: false });
    await act(async () => {
      await result.current.client.invalidateQueries({ queryKey: vaultKey('p1') });
    });
    await waitFor(() => expect(result.current.notes.data?.map((i) => i.data)).toEqual([{ text: 'hi' }]));
  });

  it('waits while the phone has no key', async () => {
    const { vault } = await readyVault();
    const { result } = await renderHook(() => useVaultQuery('p1', ['notes'], (s, pid) => listItems(s, pid, 'note')), {
      wrapper: vaultWrapper({ ...vault, state: 'needs-key' }),
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });
});
