import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

import { useRealtimeSync } from '../data';

jest.mock('@/lib/session', () => ({ useSession: () => ({ session: null, loading: false }) }));
jest.mock('@/lib/supabase', () => {
  const makeChannel = () => {
    const channel: { on: jest.Mock; subscribe: jest.Mock } = { on: jest.fn(() => channel), subscribe: jest.fn(() => channel) };
    return channel;
  };
  return { supabase: { channel: jest.fn(() => makeChannel()), removeChannel: jest.fn() } };
});

type Listener = [type: string, filter: { event: string; table: string; filter?: string }, callback: () => void];

function setup(pregnancyId: string | undefined) {
  const client = new QueryClient();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { invalidate, render: () => renderHook(() => useRealtimeSync(pregnancyId), { wrapper }) };
}

const channels = () => (supabase.channel as jest.Mock).mock.results.map((r) => r.value as { on: jest.Mock; subscribe: jest.Mock });

beforeEach(() => jest.clearAllMocks());

describe('useRealtimeSync', () => {
  it('listens to readings, medications, doses and appointments on one channel', async () => {
    await setup('p1').render();

    expect(supabase.channel).toHaveBeenCalledTimes(1);
    expect(supabase.channel).toHaveBeenCalledWith('pregnancy:p1');
    const [channel] = channels();
    expect(channel.subscribe).toHaveBeenCalledTimes(1);

    const listeners = channel.on.mock.calls as Listener[];
    expect(listeners.map(([, f]) => `${f.event} ${f.table}`).sort()).toEqual(
      ['readings', 'medications', 'med_doses', 'appointments'].flatMap((t) => ['DELETE', 'INSERT', 'UPDATE'].map((e) => `${e} ${t}`)).sort(),
    );
    // Inserts and updates only for this pregnancy; deletes can't be filtered.
    for (const [, f] of listeners) expect(f.filter).toBe(f.event === 'DELETE' ? undefined : 'pregnancy_id=eq.p1');
  });

  it('refetches just what changed', async () => {
    const { invalidate, render } = setup('p1');
    await render();
    const listeners = channels()[0].on.mock.calls as Listener[];
    const on = (event: string, table: string) => listeners.find(([, f]) => f.event === event && f.table === table)![2];

    on('INSERT', 'med_doses')();
    expect(invalidate).toHaveBeenLastCalledWith({ queryKey: ['doses', 'p1'] });
    on('DELETE', 'medications')();
    expect(invalidate).toHaveBeenLastCalledWith({ queryKey: ['meds', 'p1'] });
    on('UPDATE', 'readings')();
    expect(invalidate).toHaveBeenLastCalledWith({ queryKey: ['readings', 'p1'] });
    on('INSERT', 'appointments')();
    expect(invalidate).toHaveBeenLastCalledWith({ queryKey: ['appointments', 'p1'] });
  });

  it('leaves the channel when the app moves on', async () => {
    const { unmount } = await setup('p1').render();
    await unmount();
    expect(supabase.removeChannel).toHaveBeenCalledWith(channels()[0]);
  });

  it('does nothing until there is a pregnancy', async () => {
    await setup(undefined).render();
    expect(supabase.channel).not.toHaveBeenCalled();
  });
});
