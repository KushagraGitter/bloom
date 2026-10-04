import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import TodayScreen from '@/app/(tabs)/index';
import { clock } from '@/lib/appointments';
import { copyOldData } from '@/lib/copyOldData';
import { doseId, readingKind, tallyKind } from '@/lib/data';
import { addDays, localToday } from '@/lib/pregnancy';
import type { LocalStore } from '@/lib/vault/localStore';
import { readyVault } from '@/lib/vault/testHelpers';
import { vaultWrapper } from '@/lib/vault/testWrapper';
import type { Vault } from '@/lib/vault/VaultProvider';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));
jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)) }));

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
    appointments: [
      { id: 'a0', pregnancy_id: 'p1', title: 'Booking visit', appt_date: addDays(localToday(), -3), appt_time: '10:00', place: null },
      { id: 'a2', pregnancy_id: 'p1', title: 'Routine checkup', appt_date: addDays(localToday(), 25), appt_time: '11:30:00', place: 'Dr Rao' },
      { id: 'a1', pregnancy_id: 'p1', title: 'Glucose tolerance test', appt_date: addDays(localToday(), 11), appt_time: '09:00:00', place: 'City Clinic' },
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

// Only who is in the household comes from the server; health data is in the vault.
jest.mock('@/lib/supabase', () => {
  const from = (table: string) => {
    const rows = mockRows();
    const filters: Record<string, unknown> = {};
    const result = () => {
      if (table === 'members') return { data: filters.user_id ? rows.membership : rows.members, error: null };
      if (table === 'profiles') return { data: rows.profile, error: null };
      return { data: null, error: null };
    };
    const q = {
      select: () => q,
      eq: (col: string, v: unknown) => ((filters[col] = v), q),
      order: () => q,
      limit: () => q,
      maybeSingle: async () => result(),
      then: (resolve: (v: unknown) => void) => resolve(result()),
    };
    return q;
  };
  return { isSupabaseConfigured: true, supabase: { from } };
});

let vault: Vault;
let store: LocalStore;

beforeEach(async () => {
  mockState = undefined;
  ({ vault, store } = await readyVault());
});

/** Puts the test's rows into this phone's vault, then shows Today. */
async function show() {
  const rows = mockRows();
  await copyOldData(store, 'p1', {
    pregnancy: null,
    readings: [...rows.today, ...Object.values(rows.latest)] as Record<string, unknown>[],
    medications: rows.medications,
    doses: rows.med_doses,
    appointments: rows.appointments,
  });
  return render(<TodayScreen />, { wrapper: vaultWrapper(vault) });
}

describe('Today', () => {
  it('shows today’s check-ins, who logged them, and the tallies', async () => {
    await show();

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
    await show();
    await screen.findByLabelText('1 kicks today');

    await fireEvent.press(screen.getByRole('button', { name: 'Tap a kick' }));
    expect(await screen.findByLabelText('2 kicks today')).toBeTruthy();
    const kicks = await store.list('p1', tallyKind('kicks', localToday()));
    expect(kicks.map((k) => k.data)).toContainEqual(expect.objectContaining({ type: 'kicks', value_num: 1, logged_by: 'me' }));
    expect(kicks.filter((k) => k.dirty)).toHaveLength(2);
  });

  it('checks a typed reading before saving it', async () => {
    await show();
    await fireEvent.press(await screen.findByRole('button', { name: /^Blood pressure/ }));
    await fireEvent.changeText(screen.getByLabelText('Systolic / diastolic'), '76/114');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter both numbers, top one first, like 114/76.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Systolic / diastolic'), '114/76');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () =>
      expect((await store.list('p1', readingKind('bp'))).map((r) => r.data)).toContainEqual(
        expect.objectContaining({ type: 'bp', value_num: 114, value_num2: 76, value_text: null, logged_by: 'me' }),
      ),
    );
  });

  it('lists the vitamins due today, shows who ticked, and ticks one off', async () => {
    await show();
    expect(await screen.findByText('Prenatal multivitamin')).toBeTruthy();
    expect(screen.getByText('Morning · 1 tablet · with breakfast')).toBeTruthy();
    expect(screen.getByText('Afternoon · As prescribed')).toBeTruthy();
    expect(screen.getByText(/^Kush marked it taken · /)).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Prenatal multivitamin, Morning · 1 tablet · with breakfast', checked: true })).toBeTruthy();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Iron, Afternoon · As prescribed', checked: false }));
    expect(await screen.findByRole('checkbox', { name: 'Iron, Afternoon · As prescribed', checked: true })).toBeTruthy();
    expect(await store.get(doseId('m2', localToday()))).toMatchObject({
      kind: 'dose',
      deleted: false,
      data: { medication_id: 'm2', day: localToday(), logged_by: 'me' },
    });
  });

  it('un-ticks a vitamin', async () => {
    await show();
    await fireEvent.press(await screen.findByRole('checkbox', { name: /^Prenatal multivitamin/, checked: true }));

    expect(await screen.findByRole('checkbox', { name: /^Prenatal multivitamin/, checked: false })).toBeTruthy();
    expect(await store.get(doseId('m1', localToday()))).toMatchObject({ deleted: true, dirty: true });
  });

  it('links to the Vitamins tab', async () => {
    await show();
    await fireEvent.press(await screen.findByRole('link', { name: 'See all' }));
    expect(router.navigate).toHaveBeenCalledWith('/vitamins');
  });

  it('suggests adding vitamins when there are none', async () => {
    mockRows().medications = [];
    mockRows().med_doses = [];
    await show();

    expect(await screen.findByText('Add the vitamins you take and tick them off here.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Add' })).toBeTruthy();
  });

  it('lists the tools, opens appointments and mood, and marks the timer as not built yet', async () => {
    await show();
    await fireEvent.press(await screen.findByRole('button', { name: 'Appointments' }));
    expect(router.push).toHaveBeenCalledWith('/appointments');
    await fireEvent.press(screen.getByRole('button', { name: 'Mood & symptoms' }));
    expect(router.push).toHaveBeenLastCalledWith('/mood');

    (router.push as jest.Mock).mockClear();
    await fireEvent.press(screen.getByRole('button', { name: 'Contraction timer, coming soon' }));
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getAllByText('Soon')).toHaveLength(1);
  });

  it('shows the next appointment that has not happened yet, and opens the calendar from it', async () => {
    await show();

    const card = await screen.findByRole('link', { name: /^Next appointment: Glucose tolerance test, / });
    expect(screen.getByText('Next appointment')).toBeTruthy();
    expect(screen.getByText('Glucose tolerance test')).toBeTruthy();
    expect(screen.getByText(`City Clinic · ${clock('09:00')}`)).toBeTruthy();
    expect(screen.queryByText('Booking visit')).toBeNull();
    expect(screen.queryByText('Routine checkup')).toBeNull();

    (router.push as jest.Mock).mockClear();
    await fireEvent.press(card);
    expect(router.push).toHaveBeenCalledWith('/appointments');
  });

  it('shows no appointment card when nothing is coming up', async () => {
    mockRows().appointments = mockRows().appointments.filter((a) => a.id === 'a0');
    await show();
    await screen.findByText('Hi, Ananya');
    await screen.findByText('Prenatal multivitamin');

    expect(screen.queryByText('Next appointment')).toBeNull();
    expect(screen.queryByText('Booking visit')).toBeNull();
  });
});

describe('Today on a phone without the household key', () => {
  it('says so, shows no health data, and offers to add the key', async () => {
    await copyOldData(store, 'p1', { pregnancy: null, readings: mockRows().today, medications: [], doses: [], appointments: [] });
    const locked: Vault = { ...vault, state: 'needs-key', householdKey: null, sync: null };
    await render(<TodayScreen />, { wrapper: vaultWrapper(locked) });

    expect(await screen.findByText('This phone needs the household key')).toBeTruthy();
    expect(screen.getByLabelText('0 kicks today')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add the key' }));
    expect(router.push).toHaveBeenCalledWith('/household-key');
  });
});

describe('Today left open as the day goes by', () => {
  afterEach(() => jest.useRealTimers());

  /** Only the date and the timeouts are faked, so the waits keep working while a test moves the clock on by hand. */
  function fakeClockAt(now: Date) {
    jest.useFakeTimers({
      now,
      doNotFake: [
        'hrtime',
        'nextTick',
        'performance',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
      ],
    });
  }

  it('moves the next appointment on as each one starts, without leaving the screen', async () => {
    // It is 8:50 on 3 October 2026.
    fakeClockAt(new Date(2026, 9, 3, 8, 50));
    mockRows().appointments.push(
      { id: 'a3', pregnancy_id: 'p1', title: 'Growth scan', appt_date: '2026-10-03', appt_time: '09:00:00', place: null },
      { id: 'a4', pregnancy_id: 'p1', title: 'Dentist', appt_date: '2026-10-03', appt_time: '11:00:00', place: null },
    );
    await show();
    expect(await screen.findByRole('link', { name: /^Next appointment: Growth scan, / })).toBeTruthy();

    // Just after 9:01: the 9:00 one has started, so the 11:00 one is next.
    await act(async () => {
      jest.advanceTimersByTime((11 * 60 + 1) * 1000);
    });
    expect(await screen.findByRole('link', { name: /^Next appointment: Dentist, / })).toBeTruthy();
    expect(screen.queryByText('Growth scan')).toBeNull();

    // Just after 11:01: nothing is left today, so it looks ahead to the next day booked.
    await act(async () => {
      jest.advanceTimersByTime(120 * 60 * 1000);
    });
    expect(await screen.findByRole('link', { name: /^Next appointment: Glucose tolerance test, / })).toBeTruthy();
    expect(screen.queryByText('Dentist')).toBeNull();
  });

  it('does not bring the day’s last appointment back for a moment after midnight', async () => {
    // 23:59:30 on 3 October 2026. The minute turns over at midnight and the day a second later;
    // in between, the card must not pair the new time with the old day.
    fakeClockAt(new Date(2026, 9, 3, 23, 59, 30));
    mockRows().appointments.push(
      { id: 'a5', pregnancy_id: 'p1', title: 'Late scan', appt_date: '2026-10-03', appt_time: '23:59:00', place: null },
      { id: 'a6', pregnancy_id: 'p1', title: 'Morning clinic', appt_date: '2026-10-04', appt_time: '09:00:00', place: null },
    );
    await show();
    expect(await screen.findByRole('link', { name: /^Next appointment: Late scan, / })).toBeTruthy();

    // 0.2 seconds past midnight: the minute has turned over, the day's own timer has not gone off.
    // Nothing is waited for here, since the card has to be right as the minute turns, not a second on.
    await act(async () => {
      jest.advanceTimersByTime(30.2 * 1000);
    });
    expect(screen.getByRole('link', { name: /^Next appointment: Morning clinic, / })).toBeTruthy();
    expect(screen.queryByText('Late scan')).toBeNull();
  });
});
