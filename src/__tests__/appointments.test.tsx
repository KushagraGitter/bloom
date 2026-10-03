import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';

import AppointmentsScreen from '@/app/appointments';
import { clock, dayLong, dayTitle, monthAbbr, monthName, monthTitle } from '@/lib/appointments';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

jest.mock('@/lib/session', () => ({
  useSession: () => ({ session: { user: { id: 'me', email: 'ananya@example.com' } }, loading: false }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

// The pickers are native, so a button stands in for each and picks the value below.
let mockPick = { date: new Date(2026, 11, 5), time: new Date(2026, 11, 5, 14, 30) };

jest.mock('@react-native-community/datetimepicker', () => {
  const { createElement } = jest.requireActual('react');
  const { Pressable, Text } = jest.requireActual('react-native');
  function Picker(props: { mode: 'date' | 'time'; onValueChange: (e: unknown, d: Date) => void }) {
    return createElement(
      Pressable,
      {
        accessibilityRole: 'button',
        accessibilityLabel: `${props.mode} picker`,
        onPress: () => props.onValueChange({ nativeEvent: {} }, mockPick[props.mode]),
      },
      createElement(Text, null, `${props.mode} picker`),
    );
  }
  return { __esModule: true, default: Picker };
});

type Row = Record<string, unknown>;
type Call = { op: string; row?: Row; filters?: Row };

// The supabase mock is hoisted above this file's statements, so its data
// comes from hoisted functions, built on first use.
function makeDb() {
  const appointment = (id: string, title: string, appt_date: string, appt_time: string | null, place: string | null) => ({
    id,
    pregnancy_id: 'p1',
    title,
    appt_date,
    appt_time,
    place,
  });
  return {
    calls: [] as Call[],
    failLoad: false,
    failInsert: false,
    failDelete: false,
    membership: {
      role: 'owner',
      pregnancy: { id: 'p1', owner_id: 'me', lmp_date: '2026-04-15', due_date: '2027-01-20', babies: 1, units: 'metric' },
    },
    // The database sends times as HH:mm:ss.
    appointments: [
      appointment('a0', 'Booking visit', '2026-09-20', '10:00:00', 'City Clinic'),
      appointment('a1', 'Blood test', '2026-10-03', '08:00:00', null),
      appointment('a2', 'Glucose tolerance test', '2026-10-14', '09:00:00', 'City Clinic'),
      appointment('a3', 'Routine checkup', '2026-10-28', '11:30:00', 'Dr Rao'),
      appointment('a4', 'Growth scan', '2026-11-11', null, null),
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
    let pending: Row | undefined;
    const offline = { data: null, error: new Error('offline') };
    const run = () => {
      if (table === 'members') return { data: db.membership, error: null };
      if (op === 'select') return db.failLoad ? offline : { data: db.appointments, error: null };
      if (op === 'insert') {
        if (db.failInsert) return offline;
        db.calls.push({ op, row: pending });
        const row = { id: `new-${db.calls.length}`, ...pending, appt_time: pending?.appt_time ? `${pending.appt_time}:00` : null };
        db.appointments.push(row);
        return { data: row, error: null };
      }
      if (db.failDelete) return offline;
      db.calls.push({ op, filters: { ...filters } });
      db.appointments = db.appointments.filter((r) => !Object.entries(filters).every(([k, v]) => r[k] === v));
      return { data: null, error: null };
    };
    const q = {
      select: () => q,
      eq: (col: string, value: unknown) => ((filters[col] = value), q),
      order: () => q,
      limit: () => q,
      insert: (row: Row) => ((op = 'insert'), (pending = row), q),
      delete: () => ((op = 'delete'), q),
      single: async () => run(),
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

// "Today" is 3 October 2026, 10:00. Only the date is faked, so the waits and
// timers the tests rely on keep working.
beforeAll(() => {
  jest.useFakeTimers({
    now: new Date(2026, 9, 3, 10, 0),
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
      'setTimeout',
      'clearTimeout',
    ],
  });
});
afterAll(() => jest.useRealTimers());

beforeEach(() => {
  mockState = undefined;
  jest.clearAllMocks();
});

const dayName = (day: string) => `${Number(day.slice(8))} ${monthName(day)}`;
const dayButton = (day: string, booked = false) => ({ name: `${dayName(day)}${booked ? ', has appointment' : ''}` });

const titlesShown = () =>
  screen
    .getAllByText(/^(Booking visit|Blood test|Glucose tolerance test|Routine checkup|Growth scan|Dentist)$/)
    .map((node) => node.props.children);

async function openSheet() {
  await fireEvent.press(await screen.findByRole('button', { name: 'Add appointment' }));
}

describe('Appointments', () => {
  it('lists what is coming up, soonest first, leaving out the past', async () => {
    await render(<AppointmentsScreen />, { wrapper });
    await screen.findByText('Glucose tolerance test');

    expect(screen.getByText('Upcoming')).toBeTruthy();
    expect(titlesShown()).toEqual(['Blood test', 'Glucose tolerance test', 'Routine checkup', 'Growth scan']);
    expect(screen.getByText(clock('08:00'))).toBeTruthy();
    expect(screen.getByText(`${clock('09:00')} · City Clinic`)).toBeTruthy();
    expect(screen.getByText(`${clock('11:30')} · Dr Rao`)).toBeTruthy();
    expect(screen.getByText('No time set')).toBeTruthy();
    expect(screen.getAllByText(monthAbbr('2026-10-14'))).toHaveLength(3);
    expect(screen.getAllByText(monthAbbr('2026-11-11'))).toHaveLength(1);
  });

  it('marks the days that have something booked on the calendar', async () => {
    await render(<AppointmentsScreen />, { wrapper });
    await screen.findByText('Glucose tolerance test');

    expect(screen.getByText(monthTitle('2026-10'))).toBeTruthy();
    for (const day of ['2026-10-03', '2026-10-14', '2026-10-28']) {
      expect(screen.getByRole('button', dayButton(day, true))).toBeTruthy();
    }
    expect(screen.getByRole('button', dayButton('2026-10-15'))).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^\d+ \S+$/ })).toHaveLength(28);
  });

  it('shows one day when it is tapped, and all upcoming again when it is tapped away', async () => {
    await render(<AppointmentsScreen />, { wrapper });
    await screen.findByText('Glucose tolerance test');

    await fireEvent.press(screen.getByRole('button', dayButton('2026-10-14', true)));
    expect(screen.getByText(dayTitle('2026-10-14'))).toBeTruthy();
    expect(screen.getByRole('button', { ...dayButton('2026-10-14', true), selected: true })).toBeTruthy();
    expect(titlesShown()).toEqual(['Glucose tolerance test']);

    await fireEvent.press(screen.getByRole('button', { name: 'All upcoming' }));
    expect(screen.getByText('Upcoming')).toBeTruthy();
    expect(titlesShown()).toHaveLength(4);
    expect(screen.queryByRole('button', { name: 'All upcoming' })).toBeNull();

    // Tapping the selected day again also lets go of it.
    await fireEvent.press(screen.getByRole('button', dayButton('2026-10-14', true)));
    await fireEvent.press(screen.getByRole('button', { ...dayButton('2026-10-14', true), selected: true }));
    expect(screen.getByText('Upcoming')).toBeTruthy();
  });

  it('says so when the day she taps has nothing booked', async () => {
    await render(<AppointmentsScreen />, { wrapper });
    await fireEvent.press(await screen.findByRole('button', dayButton('2026-10-15')));

    expect(screen.getByText(dayTitle('2026-10-15'))).toBeTruthy();
    expect(screen.getByText('Nothing booked.')).toBeTruthy();
  });

  it('steps through the months', async () => {
    await render(<AppointmentsScreen />, { wrapper });
    await screen.findByText('Glucose tolerance test');

    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText(monthTitle('2026-11'))).toBeTruthy();
    expect(screen.getByRole('button', dayButton('2026-11-11', true))).toBeTruthy();
    expect(screen.queryByRole('button', dayButton('2026-10-14', true))).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText(monthTitle('2026-09'))).toBeTruthy();
    expect(screen.getByRole('button', dayButton('2026-09-20', true))).toBeTruthy();
    // The list is about what is coming up, not about the month on show.
    expect(titlesShown()).toHaveLength(4);
  });

  it('shows a past day’s appointments when she looks back and taps it', async () => {
    await render(<AppointmentsScreen />, { wrapper });
    await screen.findByText('Glucose tolerance test');
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    await fireEvent.press(screen.getByRole('button', dayButton('2026-09-20', true)));

    expect(titlesShown()).toEqual(['Booking visit']);
  });

  it('books an appointment and goes to its day', async () => {
    await render(<AppointmentsScreen />, { wrapper });
    await openSheet();

    await fireEvent.changeText(screen.getByLabelText("What's it for?"), '  Dentist  ');
    await fireEvent.press(screen.getByRole('button', { name: /^Date:/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'date picker' }));
    expect(screen.getByRole('button', { name: `Date: ${dayLong('2026-12-05')}` })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Time:/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'time picker' }));
    expect(screen.getByRole('button', { name: `Time: ${clock('14:30')}` })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Doctor or clinic'), ' Dr Mehta ');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Dentist')).toBeTruthy();
    expect(screen.getByText(monthTitle('2026-12'))).toBeTruthy();
    expect(screen.getByText(dayTitle('2026-12-05'))).toBeTruthy();
    expect(screen.getByRole('button', { ...dayButton('2026-12-05', true), selected: true })).toBeTruthy();
    expect(screen.getByText(`${clock('14:30')} · Dr Mehta`)).toBeTruthy();
    expect(screen.queryByText('New appointment')).toBeNull();
    expect(mockDb().calls).toEqual([
      { op: 'insert', row: { pregnancy_id: 'p1', title: 'Dentist', appt_date: '2026-12-05', appt_time: '14:30', place: 'Dr Mehta' } },
    ]);
  });

  it('keeps what it books in the list when she goes back to all upcoming', async () => {
    await render(<AppointmentsScreen />, { wrapper });
    await openSheet();
    await fireEvent.changeText(screen.getByLabelText("What's it for?"), 'Dentist');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Dentist');

    await fireEvent.press(screen.getByRole('button', { name: 'All upcoming' }));
    // It was booked for today, with no time, so it leads the list.
    expect(titlesShown()).toEqual(['Dentist', 'Blood test', 'Glucose tolerance test', 'Routine checkup', 'Growth scan']);
    expect(mockDb().calls[0].row).toEqual({ pregnancy_id: 'p1', title: 'Dentist', appt_date: '2026-10-03', appt_time: null, place: null });
  });

  it('lets the time be left out, or taken away again', async () => {
    await render(<AppointmentsScreen />, { wrapper });
    await openSheet();
    expect(screen.getByRole('button', { name: 'Time: not set' })).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText("What's it for?"), 'Dentist');
    await fireEvent.press(screen.getByRole('button', { name: /^Time:/ }));
    expect(screen.getByRole('button', { name: `Time: ${clock('09:00')}` })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Clear time' }));
    expect(screen.getByRole('button', { name: 'Time: not set' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('Dentist');
    expect(mockDb().calls[0].row).toMatchObject({ appt_time: null });
  });

  it('starts the date on the day that is selected, or on today', async () => {
    await render(<AppointmentsScreen />, { wrapper });
    await openSheet();
    expect(screen.getByRole('button', { name: `Date: ${dayLong('2026-10-03')}` })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    await fireEvent.press(screen.getByRole('button', dayButton('2026-10-14', true)));
    await openSheet();
    expect(screen.getByRole('button', { name: `Date: ${dayLong('2026-10-14')}` })).toBeTruthy();
  });

  it('opens with empty fields every time', async () => {
    await render(<AppointmentsScreen />, { wrapper });
    await openSheet();
    await fireEvent.changeText(screen.getByLabelText("What's it for?"), 'Half typed');
    await fireEvent.press(screen.getByRole('button', { name: /^Time:/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    await openSheet();
    expect(screen.getByLabelText("What's it for?").props.value).toBe('');
    expect(screen.getByRole('button', { name: 'Time: not set' })).toBeTruthy();
  });

  it('asks what it is for before saving', async () => {
    await render(<AppointmentsScreen />, { wrapper });
    await openSheet();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Enter what the appointment is for.')).toBeTruthy();
    expect(mockDb().calls).toEqual([]);
  });

  it('keeps the sheet open, with what she typed, when saving fails', async () => {
    mockDb().failInsert = true;
    await render(<AppointmentsScreen />, { wrapper });
    await openSheet();
    await fireEvent.changeText(screen.getByLabelText("What's it for?"), 'Dentist');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Couldn’t save. Check your connection and try again.')).toBeTruthy();
    expect(screen.getByLabelText("What's it for?").props.value).toBe('Dentist');
    expect(screen.getByText('New appointment')).toBeTruthy();
  });

  it('cancels an appointment only after asking', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<AppointmentsScreen />, { wrapper });
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove Routine checkup' }));

    expect(alert).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = alert.mock.calls[0];
    expect(title).toBe('Remove Routine checkup?');
    expect(message).toBe('It disappears for both of you.');
    expect(mockDb().calls).toEqual([]);

    await buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    await waitFor(() => expect(screen.queryByText('Routine checkup')).toBeNull());
    expect(mockDb().calls).toEqual([{ op: 'delete', filters: { id: 'a3' } }]);
    // The day it was on is no longer marked.
    expect(screen.getByRole('button', dayButton('2026-10-28'))).toBeTruthy();
    alert.mockRestore();
  });

  it('puts an appointment back and says so when it could not be cancelled', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockDb().failDelete = true;
    await render(<AppointmentsScreen />, { wrapper });
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove Routine checkup' }));
    await alert.mock.calls[0][2]?.find((b) => b.style === 'destructive')?.onPress?.();

    expect(await screen.findByText("Couldn't remove that. Check your connection and try again.")).toBeTruthy();
    expect(screen.getByText('Routine checkup')).toBeTruthy();
    alert.mockRestore();
  });

  it('invites her to book the first one when there is nothing yet', async () => {
    mockDb().appointments = [];
    await render(<AppointmentsScreen />, { wrapper });

    expect(await screen.findByText('Nothing booked.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '+ Add appointment' }));
    expect(screen.getByText('New appointment')).toBeTruthy();
  });

  it('says so when the appointments cannot be loaded', async () => {
    mockDb().failLoad = true;
    await render(<AppointmentsScreen />, { wrapper });

    expect(await screen.findByText("Couldn't load your appointments. Check your connection and try again.")).toBeTruthy();
    expect(screen.queryByText('Nothing booked.')).toBeNull();
  });

  it('goes back to Today', async () => {
    await render(<AppointmentsScreen />, { wrapper });
    await fireEvent.press(await screen.findByRole('button', { name: 'Back to Today' }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('goes to Today even when there is nothing to go back to', async () => {
    (router.canGoBack as jest.Mock).mockReturnValueOnce(false);
    await render(<AppointmentsScreen />, { wrapper });
    await fireEvent.press(await screen.findByRole('button', { name: 'Back to Today' }));
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});
