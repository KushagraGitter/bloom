import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';

import VitaminsScreen from '@/app/(tabs)/vitamins';
import { addDays, localToday } from '@/lib/pregnancy';

jest.mock('@/lib/session', () => ({
  useSession: () => ({ session: { user: { id: 'me', email: 'ananya@example.com' } }, loading: false }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

type Row = Record<string, unknown>;
type Call = { op: string; table: string; row?: Row; opts?: unknown; filters?: Row };

// The supabase mock is hoisted above this file's statements, so its data
// comes from hoisted functions, built on first use.
function makeDb() {
  const today = localToday();
  const dose = (medication_id: string, day: string, logged_by: string) => ({
    medication_id,
    pregnancy_id: 'p1',
    day,
    taken_at: new Date().toISOString(),
    logged_by,
  });
  const medication = (id: string, name: string, dose: string | null, time_of_day: string, created_at: string) => ({
    id,
    pregnancy_id: 'p1',
    name,
    dose,
    time_of_day,
    start_date: addDays(today, -10),
    end_date: null,
    created_at,
  });
  return {
    today,
    calls: [] as Call[],
    membership: {
      role: 'owner',
      pregnancy: { id: 'p1', owner_id: 'me', lmp_date: '2026-04-15', due_date: '2027-01-20', babies: 1, units: 'metric' },
    },
    members: [
      { user_id: 'me', role: 'owner', profile: { name: 'Ananya Rao' } },
      { user_id: 'kush', role: 'partner', profile: { name: 'Kush S' } },
    ],
    medications: [
      medication('m1', 'Prenatal multivitamin', '1 tablet · with breakfast', 'morning', '2026-09-20T08:00:00+00:00'),
      medication('m2', 'Iron', null, 'afternoon', '2026-09-21T08:00:00+00:00'),
      medication('m3', 'Omega-3 (DHA)', '1 softgel · with dinner', 'evening', '2026-09-22T08:00:00+00:00'),
    ] as Row[],
    med_doses: [
      // Today her partner ticked the prenatal; the two days before, everything was taken.
      dose('m1', today, 'kush'),
      ...['m1', 'm2', 'm3'].flatMap((id) => [dose(id, addDays(today, -1), 'me'), dose(id, addDays(today, -2), 'me')]),
    ] as Row[],
  };
}

let mockState: ReturnType<typeof makeDb> | undefined;
function mockDb() {
  mockState ??= makeDb();
  return mockState;
}

jest.mock('@/lib/supabase', () => {
  const from = (table: string) => {
    const db = mockDb();
    const filters: Row = {};
    let op = 'select';
    const run = () => {
      if (op === 'delete') {
        db.calls.push({ op, table, filters: { ...filters } });
        const rows = (db as unknown as Record<string, Row[]>)[table];
        (db as unknown as Record<string, Row[]>)[table] = rows.filter((r) => !Object.entries(filters).every(([k, v]) => r[k] === v));
      }
      if (table === 'members') return { data: filters.user_id ? db.membership : db.members, error: null };
      return { data: op === 'select' ? (db as unknown as Record<string, Row[]>)[table] : null, error: null };
    };
    const q = {
      select: () => q,
      eq: (col: string, value: unknown) => ((filters[col] = value), q),
      order: () => q,
      limit: () => q,
      insert: (row: Row) => {
        op = 'insert';
        db.calls.push({ op, table, row });
        (db as unknown as Record<string, Row[]>)[table].push({ id: `new-${db.calls.length}`, end_date: null, created_at: new Date().toISOString(), ...row });
        return q;
      },
      upsert: (row: Row, opts: unknown) => {
        op = 'upsert';
        db.calls.push({ op, table, row, opts });
        (db as unknown as Record<string, Row[]>)[table].unshift({ taken_at: new Date().toISOString(), logged_by: 'me', ...row });
        return q;
      },
      delete: () => {
        op = 'delete';
        return q;
      },
      maybeSingle: async () => run(),
      then: (resolve: (v: unknown) => void) => resolve(run()),
    };
    return q;
  };
  return { isSupabaseConfigured: true, supabase: { from } };
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

describe('Vitamins', () => {
  it('lists today’s medicines by time of day, with the streak and who ticked what', async () => {
    await render(<VitaminsScreen />, { wrapper });

    expect(await screen.findByText('Prenatal multivitamin')).toBeTruthy();
    expect(screen.getByText('Morning')).toBeTruthy();
    expect(screen.getByText('Afternoon')).toBeTruthy();
    expect(screen.getByText('Evening')).toBeTruthy();
    expect(screen.getByLabelText('1 of 3 taken today')).toBeTruthy();
    // Today is unfinished, so the run is the two complete days before it.
    expect(screen.getByText('2-day streak')).toBeTruthy();
    expect(screen.getByText('As prescribed')).toBeTruthy();
    expect(screen.getByText(/^Kush marked it taken · /)).toBeTruthy();
    expect(screen.getAllByText('Take')).toHaveLength(2);
    expect(screen.getAllByText('Taken')).toHaveLength(1);
  });

  it('ticks a dose off straight away and saves it for today', async () => {
    await render(<VitaminsScreen />, { wrapper });
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Iron, As prescribed' }));

    expect(await screen.findByLabelText('2 of 3 taken today')).toBeTruthy();
    expect(mockDb().calls).toContainEqual({
      op: 'upsert',
      table: 'med_doses',
      row: { pregnancy_id: 'p1', medication_id: 'm2', day: mockDb().today },
      opts: { onConflict: 'medication_id,day', ignoreDuplicates: true },
    });
  });

  it('un-ticks a dose', async () => {
    await render(<VitaminsScreen />, { wrapper });
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Prenatal multivitamin, 1 tablet · with breakfast' }));

    expect(await screen.findByLabelText('0 of 3 taken today')).toBeTruthy();
    expect(mockDb().calls).toContainEqual({
      op: 'delete',
      table: 'med_doses',
      filters: { medication_id: 'm1', day: mockDb().today },
    });
  });

  it('adds a medicine by hand', async () => {
    await render(<VitaminsScreen />, { wrapper });
    await fireEvent.press(await screen.findByRole('button', { name: 'Add medicine' }));

    await fireEvent.changeText(screen.getByLabelText('Name'), ' Vitamin B12 ');
    await fireEvent.changeText(screen.getByLabelText('Dose & how to take'), '1 tablet after dinner');
    await fireEvent.press(screen.getByRole('radio', { name: 'Evening' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Vitamin B12')).toBeTruthy();
    expect(mockDb().calls).toContainEqual({
      op: 'insert',
      table: 'medications',
      row: { pregnancy_id: 'p1', name: 'Vitamin B12', dose: '1 tablet after dinner', time_of_day: 'evening', start_date: mockDb().today },
    });
  });

  it('opens with empty fields every time', async () => {
    await render(<VitaminsScreen />, { wrapper });
    await fireEvent.press(await screen.findByRole('button', { name: 'Add medicine' }));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Half typed');
    await fireEvent.press(screen.getByRole('radio', { name: 'Evening' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Add medicine' }));
    expect(screen.getByLabelText('Name').props.value).toBe('');
    expect(screen.getByRole('radio', { name: 'Morning', checked: true })).toBeTruthy();
  });

  it('asks for a name before saving', async () => {
    await render(<VitaminsScreen />, { wrapper });
    await fireEvent.press(await screen.findByRole('button', { name: 'Add medicine' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('Enter the medicine’s name.')).toBeTruthy();
    expect(mockDb().calls.filter((c) => c.op === 'insert')).toHaveLength(0);
  });

  it('removes a medicine only after asking', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<VitaminsScreen />, { wrapper });
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove Iron' }));

    expect(alert).toHaveBeenCalledTimes(1);
    const [title, , buttons] = alert.mock.calls[0];
    expect(title).toBe('Remove Iron?');
    expect(mockDb().calls.filter((c) => c.op === 'delete')).toHaveLength(0);

    await buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    await waitFor(() => expect(screen.queryByText('Iron')).toBeNull());
    expect(mockDb().calls).toContainEqual({ op: 'delete', table: 'medications', filters: { id: 'm2' } });
    alert.mockRestore();
  });

  it('invites her to add the first one when there is nothing yet', async () => {
    mockDb().medications = [];
    mockDb().med_doses = [];
    await render(<VitaminsScreen />, { wrapper });

    expect(await screen.findByText('Nothing here yet.')).toBeTruthy();
    expect(screen.queryByText(/streak/)).toBeNull();
    expect(screen.getByRole('button', { name: '+ Add medicine by hand' })).toBeTruthy();
  });
});
