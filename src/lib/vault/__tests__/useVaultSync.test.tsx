import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';
import { newHouseholdKey } from '@/lib/vault/crypto';
import { createLocalStoreAsync, writeRecord, type LocalStore } from '@/lib/vault/localStore';
import { fakeServer, memoryDb } from '@/lib/vault/testHelpers';
import { createSyncRunner, useVaultSync } from '@/lib/vault/useVaultSync';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)),
}));
jest.mock('@/lib/supabase', () => {
  const channel: { on: jest.Mock; subscribe: jest.Mock } = { on: jest.fn(() => channel), subscribe: jest.fn(() => channel) };
  return { supabase: { channel: jest.fn(() => channel), removeChannel: jest.fn() } };
});

const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));

describe('createSyncRunner', () => {
  it('runs one sync at a time and folds requests made meanwhile into one more run', async () => {
    let release!: () => void;
    const run = jest.fn(
      () =>
        new Promise<{ pushed: number; pulled: number }>((resolve) => {
          release = () => resolve({ pushed: 0, pulled: 0 });
        }),
    );
    const done = jest.fn();
    const runner = createSyncRunner(run, done);

    const first = runner.request();
    runner.request();
    runner.request();
    expect(run).toHaveBeenCalledTimes(1);

    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(run).toHaveBeenCalledTimes(2);
    release();
    await first;
    expect(run).toHaveBeenCalledTimes(2);
    expect(done).toHaveBeenCalledTimes(2);
  });

  it('reports a failed sync and keeps working', async () => {
    const run = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ pushed: 1, pulled: 0 });
    const done = jest.fn();
    const runner = createSyncRunner(run, done);
    await runner.request();
    await runner.request();
    expect(done.mock.calls).toEqual([
      [null, new Error('offline')],
      [{ pushed: 1, pulled: 0 }, null],
    ]);
  });
});

describe('useVaultSync', () => {
  const P = 'p1';
  const key = newHouseholdKey();
  const channel = () => (supabase.channel as jest.Mock).mock.results[0].value as { on: jest.Mock; subscribe: jest.Mock };

  async function setup() {
    const server = fakeServer();
    const mine = await createLocalStoreAsync(memoryDb());
    const theirs = await createLocalStoreAsync(memoryDb());
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } } });
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const mount = (store: LocalStore | null) =>
      renderHook(() => useVaultSync({ pregnancyId: P, store, householdKey: key, remote: server.remote }), { wrapper });
    return { server, mine, theirs, invalidate, mount };
  }

  beforeEach(() => jest.clearAllMocks());

  it('waits for the store and key', async () => {
    const { mount } = await setup();
    await mount(null);
    await settle();
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it('syncs on mount and listens for the other phone on its own channel', async () => {
    const { server, mine, mount } = await setup();
    await writeRecord(mine, { id: 'a', pregnancyId: P, kind: 'reading', data: { v: 1 } });
    const { result } = await mount(mine);
    await settle();

    expect(server.rows.size).toBe(1);
    expect(result.current.lastSyncedAt).not.toBeNull();
    expect(result.current.error).toBeNull();
    expect(supabase.channel).toHaveBeenCalledWith('vault:p1');
    expect(channel().on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'vault_records', filter: 'pregnancy_id=eq.p1' },
      expect.any(Function),
    );
  });

  it("pulls when the other phone writes, then refreshes what's on screen", async () => {
    const { server, mine, theirs, invalidate, mount } = await setup();
    const { result } = await mount(mine);
    await settle();
    expect(invalidate).not.toHaveBeenCalled();

    // The other phone uploads; realtime nudges this one.
    await writeRecord(theirs, { id: 'b', pregnancyId: P, kind: 'appointment', data: { title: 'Scan' } });
    const { syncOnce } = jest.requireActual<typeof import('@/lib/vault/sync')>('@/lib/vault/sync');
    await syncOnce({ store: theirs, remote: server.remote, key, pregnancyId: P });
    const nudge = channel().on.mock.calls[0][2] as () => void;
    await act(async () => nudge());
    await settle();

    expect((await mine.list(P, 'appointment')).map((r) => r.data)).toEqual([{ title: 'Scan' }]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['vault', 'p1'] });
    expect(result.current.syncing).toBe(false);
  });

  it('syncs again when the app returns to the foreground, and stops listening on unmount', async () => {
    const listeners: ((s: string) => void)[] = [];
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, fn) => {
      listeners.push(fn as (s: string) => void);
      return { remove } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    const { server, mine, mount } = await setup();
    const { unmount } = await mount(mine);
    await settle();

    await writeRecord(mine, { id: 'c', pregnancyId: P, kind: 'reading', data: { v: 2 } });
    await act(async () => listeners.forEach((fn) => fn('active')));
    await settle();
    expect(server.rows.has('c')).toBe(true);

    await unmount();
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel());
    expect(remove).toHaveBeenCalled();
  });
});
