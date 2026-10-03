import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { supabase } from '@/lib/supabase';
import type { Dose } from '@/lib/vitamins';

import { useToggleDose } from '../data';

jest.mock('@/lib/session', () => ({ useSession: () => ({ session: { user: { id: 'me' } }, loading: false }) }));

// Each write waits until the test lets it finish, so the order requests are
// sent in is visible.
jest.mock('@/lib/supabase', () => {
  const calls: string[] = [];
  const pending: ((error: Error | null) => void)[] = [];
  const settle = () => new Promise((resolve) => pending.push((error) => resolve({ error })));
  const from = () => ({
    upsert: () => {
      calls.push('upsert');
      return settle();
    },
    delete: () => ({
      eq: () => ({
        eq: () => {
          calls.push('delete');
          return settle();
        },
      }),
    }),
  });
  return { supabase: { from, __calls: calls, __finish: (error: Error | null = null) => pending.shift()?.(error) } };
});

const mocked = supabase as unknown as { __calls: string[]; __finish: (error?: Error | null) => void };
const DAY = '2026-10-03';
const KEY = ['doses', 'p1'];

function setup(existing: Dose[] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  client.setQueryData(KEY, existing);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, render: () => renderHook(() => useToggleDose('p1'), { wrapper }) };
}

const dose = (medication_id: string): Dose => ({ medication_id, pregnancy_id: 'p1', day: DAY, taken_at: `${DAY}T08:00:00Z`, logged_by: 'kush' });

beforeEach(() => {
  mocked.__calls.length = 0;
});

describe('useToggleDose', () => {
  it('shows a tick at once, stamped with who made it', async () => {
    const { client, render } = setup();
    const { result } = await render();

    await act(async () => {
      result.current.mutate({ medicationId: 'm1', day: DAY, taken: true });
    });
    expect(client.getQueryData<Dose[]>(KEY)).toEqual([expect.objectContaining({ medication_id: 'm1', day: DAY, logged_by: 'me' })]);

    await act(async () => mocked.__finish());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('removes an un-ticked dose at once and leaves the others', async () => {
    const { client, render } = setup([dose('m1'), dose('m2')]);
    const { result } = await render();

    await act(async () => {
      result.current.mutate({ medicationId: 'm1', day: DAY, taken: false });
    });
    expect(client.getQueryData<Dose[]>(KEY)?.map((d) => d.medication_id)).toEqual(['m2']);

    await act(async () => mocked.__finish());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('puts the tick back the way it was when saving fails', async () => {
    const { client, render } = setup([dose('m2')]);
    const { result } = await render();

    await act(async () => {
      result.current.mutate({ medicationId: 'm1', day: DAY, taken: true });
    });
    expect(client.getQueryData<Dose[]>(KEY)).toHaveLength(2);

    await act(async () => mocked.__finish(new Error('offline')));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData<Dose[]>(KEY)?.map((d) => d.medication_id)).toEqual(['m2']);
  });

  it('sends ticks one after another, so a quick tick and un-tick land in order', async () => {
    const { render } = setup();
    const { result } = await render();

    await act(async () => {
      result.current.mutate({ medicationId: 'm1', day: DAY, taken: true });
      result.current.mutate({ medicationId: 'm1', day: DAY, taken: false });
    });
    expect(mocked.__calls).toEqual(['upsert']);

    await act(async () => mocked.__finish());
    await waitFor(() => expect(mocked.__calls).toEqual(['upsert', 'delete']));

    await act(async () => mocked.__finish());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
