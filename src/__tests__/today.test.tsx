import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

import TodayScreen from '@/app/(tabs)/index';
import { addDays, localToday } from '@/lib/pregnancy';
import { supabase } from '@/lib/supabase';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));

jest.mock('@/lib/session', () => ({
  useSession: () => ({ session: { user: { id: 'me', email: 'ananya@example.com' } }, loading: false }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

// The supabase mock is hoisted above this file's statements, so its data
// comes from hoisted functions, built on first use.
function minutesAgo(n: number) {
  return new Date(Date.now() - n * 60 * 1000).toISOString();
}

function makeRows() {
  const earlier = minutesAgo(1);
  return {
    lastWeek: minutesAgo(7 * 24 * 60),
    membership: {
      role: 'owner',
      pregnancy: { id: 'p1', owner_id: 'me', lmp_date: '2026-04-15', due_date: '2027-01-20', babies: 1, units: 'metric' },
    },
    profile: { id: 'me', name: 'Ananya Rao', avatar_url: null },
    members: [
      { user_id: 'me', role: 'owner', profile: { name: 'Ananya Rao' } },
      { user_id: 'kush', role: 'partner', profile: { name: 'Kush S' } },
    ],
    today: [
      { id: 'k1', pregnancy_id: 'p1', type: 'kicks', value_num: 1, value_num2: null, value_text: null, taken_at: earlier, logged_by: 'me' },
      { id: 'w1', pregnancy_id: 'p1', type: 'water', value_num: 1, value_num2: null, value_text: null, taken_at: earlier, logged_by: 'kush' },
    ] as Record<string, unknown>[],
    medications: [
      { id: 'm1', pregnancy_id: 'p1', name: 'Prenatal multivitamin', dose: '1 tablet · with breakfast', time_of_day: 'morning', start_date: addDays(localToday(), -10), end_date: null, created_at: '2026-09-20T08:00:00+00:00' },
      { id: 'm2', pregnancy_id: 'p1', name: 'Iron', dose: null, time_of_day: 'afternoon', start_date: addDays(localToday(), -10), end_date: null, created_at: '2026-09-21T08:00:00+00:00' },
    ] as Record<string, unknown>[],
    med_doses: [
      { medication_id: 'm1', pregnancy_id: 'p1', day: localToday(), taken_at: earlier, logged_by: 'kush' },
    ] as Record<string, unknown>[],
    latest: {
      weight: { id: 'r1', pregnancy_id: 'p1', type: 'weight', value_num: 64.2, value_num2: null, value_text: null, taken_at: earlier, logged_by: 'kush' },
      bp: { id: 'r2', pregnancy_id: 'p1', type: 'bp', value_num: 112, value_num2: 74, value_text: null, taken_at: minutesAgo(7 * 24 * 60), logged_by: 'me' },
    } as Record<string, unknown>,
  };
}

let mockState: ReturnType<typeof makeRows> | undefined;
function mockRows() {
  mockState ??= makeRows();
  return mockState;
}

jest.mock('@/lib/supabase', () => {
  const inserts: unknown[] = [];
  const upserts: unknown[] = [];
  const deletes: unknown[] = [];
  const from = (table: string) => {
    const rows = mockRows();
    const filters: Record<string, unknown> = {};
    let insertRow: unknown = null;
    let deleting = false;
    const result = (single: boolean) => {
      if (deleting) {
        deletes.push({ table, filters: { ...filters } });
        rows.med_doses = rows.med_doses.filter((r) => !Object.entries(filters).every(([k, v]) => r[k] === v));
        return { data: null, error: null };
      }
      if (insertRow) return { data: null, error: null };
      if (table === 'members') return { data: filters.user_id ? rows.membership : rows.members, error: null };
      if (table === 'profiles') return { data: rows.profile, error: null };
      if (table === 'medications') return { data: rows.medications, error: null };
      if (table === 'med_doses') return { data: rows.med_doses, error: null };
      if (table === 'readings') {
        if (single) return { data: rows.latest[filters.type as string] ?? null, error: null };
        return { data: rows.today, error: null };
      }
      return { data: null, error: null };
    };
    const q = {
      select: () => q,
      eq: (col: string, v: unknown) => ((filters[col] = v), q),
      gte: () => q,
      order: () => q,
      limit: () => q,
      insert: (row: Record<string, unknown>) => {
        insertRow = row;
        inserts.push(row);
        rows.today.push({ id: `new-${inserts.length}`, value_num2: null, value_text: null, taken_at: new Date().toISOString(), logged_by: 'me', ...row });
        return q;
      },
      upsert: (row: Record<string, unknown>, opts: unknown) => {
        insertRow = row;
        upserts.push({ row, opts });
        rows.med_doses.unshift({ taken_at: new Date().toISOString(), logged_by: 'me', ...row });
        return q;
      },
      delete: () => {
        deleting = true;
        return q;
      },
      maybeSingle: async () => result(true),
      then: (resolve: (v: unknown) => void) => resolve(result(false)),
    };
    return q;
  };
  const channel = { on: () => channel, subscribe: () => channel };
  return {
    isSupabaseConfigured: true,
    supabase: { from, channel: () => channel, removeChannel: jest.fn(), __inserts: inserts, __upserts: upserts, __deletes: deletes },
  };
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockState = undefined;
});

describe('Today', () => {
  it('shows today’s check-ins, who logged them, and the tallies', async () => {
    await render(<TodayScreen />, { wrapper });

    expect(await screen.findByText('Hi, Ananya')).toBeTruthy();
    expect(await screen.findByText('64.2 kg')).toBeTruthy();
    expect(screen.getByText(/^Kush · /)).toBeTruthy();
    // Last week's BP is not today's, so the card asks for a new one.
    expect(screen.getByText('Last: 112/74, ' + new Date(mockRows().lastWeek).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))).toBeTruthy();
    expect(screen.getAllByText('+ Log')).toHaveLength(3);
    expect(screen.getByLabelText('1 kicks today')).toBeTruthy();
    expect(screen.getByLabelText('1 of 10 glasses')).toBeTruthy();
  });

  it('counts a kick straight away and saves it', async () => {
    await render(<TodayScreen />, { wrapper });
    await screen.findByLabelText('1 kicks today');

    await fireEvent.press(screen.getByRole('button', { name: 'Tap a kick' }));
    expect(await screen.findByLabelText('2 kicks today')).toBeTruthy();
    expect((supabase as unknown as { __inserts: unknown[] }).__inserts).toContainEqual({ pregnancy_id: 'p1', type: 'kicks', value_num: 1 });
  });

  it('checks a typed reading before saving it', async () => {
    await render(<TodayScreen />, { wrapper });
    await fireEvent.press(await screen.findByRole('button', { name: /^Blood pressure/ }));
    await fireEvent.changeText(screen.getByLabelText('Systolic / diastolic'), '76/114');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter both numbers, top one first, like 114/76.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Systolic / diastolic'), '114/76');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect((supabase as unknown as { __inserts: unknown[] }).__inserts).toContainEqual({
      pregnancy_id: 'p1',
      type: 'bp',
      value_num: 114,
      value_num2: 76,
      value_text: null,
    });
  });

  it('lists the vitamins due today, shows who ticked, and ticks one off', async () => {
    await render(<TodayScreen />, { wrapper });
    expect(await screen.findByText('Prenatal multivitamin')).toBeTruthy();
    expect(screen.getByText('Morning · 1 tablet · with breakfast')).toBeTruthy();
    expect(screen.getByText('Afternoon · As prescribed')).toBeTruthy();
    expect(screen.getByText(/^Kush marked it taken · /)).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Prenatal multivitamin, Morning · 1 tablet · with breakfast', checked: true })).toBeTruthy();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Iron, Afternoon · As prescribed', checked: false }));
    expect(await screen.findByRole('checkbox', { name: 'Iron, Afternoon · As prescribed', checked: true })).toBeTruthy();
    expect((supabase as unknown as { __upserts: unknown[] }).__upserts).toContainEqual({
      row: { pregnancy_id: 'p1', medication_id: 'm2', day: localToday() },
      opts: { onConflict: 'medication_id,day', ignoreDuplicates: true },
    });
  });

  it('un-ticks a vitamin', async () => {
    await render(<TodayScreen />, { wrapper });
    await fireEvent.press(await screen.findByRole('checkbox', { name: /^Prenatal multivitamin/, checked: true }));

    expect(await screen.findByRole('checkbox', { name: /^Prenatal multivitamin/, checked: false })).toBeTruthy();
    expect((supabase as unknown as { __deletes: unknown[] }).__deletes).toContainEqual({
      table: 'med_doses',
      filters: { medication_id: 'm1', day: localToday() },
    });
  });

  it('links to the Vitamins tab', async () => {
    await render(<TodayScreen />, { wrapper });
    await fireEvent.press(await screen.findByRole('link', { name: 'See all' }));
    expect(router.navigate).toHaveBeenCalledWith('/vitamins');
  });

  it('suggests adding vitamins when there are none', async () => {
    mockRows().medications = [];
    mockRows().med_doses = [];
    await render(<TodayScreen />, { wrapper });

    expect(await screen.findByText('Add the vitamins you take and tick them off here.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Add' })).toBeTruthy();
  });
});
