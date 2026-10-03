import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';

import { askForPermission, clearScheduled, permissionState, replaceScheduled } from '@/lib/notifications';
import { addDays } from '@/lib/pregnancy';
import type { PlannedReminder } from '@/lib/reminders';
import { useNotificationPermission, useReminders } from '@/lib/useReminders';

jest.mock('@/lib/notifications', () => ({
  permissionState: jest.fn(),
  askForPermission: jest.fn(),
  replaceScheduled: jest.fn(),
  clearScheduled: jest.fn(),
}));

let mockSession: { session: { user: { id: string } } | null; loading: boolean };
jest.mock('@/lib/session', () => ({ useSession: () => mockSession }));

type Row = Record<string, unknown>;
const mockDb: {
  membership: Row | null;
  rows: Record<string, Row[]>;
  /** Tables whose queries wait until `release` is called. */
  hang: string[];
  held: (() => void)[];
} = { membership: null, rows: {}, hang: [], held: [] };

jest.mock('@/lib/supabase', () => {
  const from = (table: string) => {
    const answer = (data: unknown) => ({ data, error: null });
    /** Answers now, or once `release` is called for a table that is made to wait. */
    const reply = (data: unknown, resolve: (v: { data: unknown; error: null }) => void) => {
      if (mockDb.hang.includes(table)) mockDb.held.push(() => resolve(answer(data)));
      else resolve(answer(data));
    };
    const q: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'order', 'limit']) q[method] = () => q;
    q.maybeSingle = () => new Promise((resolve) => reply(mockDb.membership, resolve));
    q.then = (resolve: (v: unknown) => void) => reply(mockDb.rows[table] ?? [], resolve);
    return q;
  };
  return { isSupabaseConfigured: true, supabase: { from } };
});

// Saturday 3 October 2026, ten in the morning, thirty weeks along.
const TODAY = '2026-10-03';
const NOW = new Date(2026, 9, 3, 10, 0);
const TOMORROW_NOW = new Date(2026, 9, 4, 10, 0);

const medication = (id: string, name: string, time_of_day: string): Row => ({
  id,
  pregnancy_id: 'p1',
  name,
  dose: null,
  time_of_day,
  start_date: '2026-09-01',
  end_date: null,
  created_at: '2026-09-01T08:00:00Z',
});

const doseRow = (medication_id: string, day: string, logged_by = 'me'): Row => ({
  medication_id,
  pregnancy_id: 'p1',
  day,
  taken_at: `${day}T08:00:00Z`,
  logged_by,
});

const allOff = ['vitamins', 'water', 'kicks', 'appointments'].map((kind) => ({ kind, enabled: false }));

/** Only the date is faked, so the real timers React Query and the screens use keep running. */
function fakeNow(now: Date) {
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
      'setTimeout',
      'clearTimeout',
    ],
  });
}

beforeEach(() => {
  fakeNow(NOW);
  jest.clearAllMocks();
  jest.mocked(permissionState).mockReset().mockResolvedValue('granted');
  jest.mocked(askForPermission).mockReset().mockResolvedValue('granted');
  jest.mocked(replaceScheduled).mockReset().mockResolvedValue();
  jest.mocked(clearScheduled).mockReset().mockResolvedValue();

  mockSession = { session: { user: { id: 'me' } }, loading: false };
  mockDb.membership = { role: 'owner', pregnancy: { id: 'p1', lmp_date: addDays(TODAY, -30 * 7) } };
  mockDb.rows = {
    reminder_prefs: [],
    medications: [medication('folic', 'Folic acid', 'morning'), medication('iron', 'Iron', 'evening')],
    med_doses: [],
    appointments: [
      { id: 'scan', pregnancy_id: 'p1', title: 'Growth scan', appt_date: '2026-10-05', appt_time: '09:00:00', place: null },
    ],
  };
  mockDb.hang = [];
  mockDb.held = [];
});

afterEach(() => jest.useRealTimers());

/**
 * TanStack Query announces a result a moment after it arrives, and the screen
 * then reacts a moment after that. Waits those out inside act, so a test that
 * expects nothing to happen has given it the chance to, and ends settled.
 */
const settle = () =>
  act(async () => {
    for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });

/** Lets everything held back by `mockDb.hang` through. */
const release = () => act(async () => mockDb.held.splice(0).forEach((go) => go()));

/** The app coming back to the foreground, as every listener on AppState would hear it. */
const foreground = () =>
  act(async () => {
    for (const [, listener] of (AppState.addEventListener as jest.Mock).mock.calls) listener('active');
  });

const plans = (): PlannedReminder[][] => jest.mocked(replaceScheduled).mock.calls.map(([plan]) => plan);
const keysOf = (plan: PlannedReminder[]) => plan.map((r) => r.key);
const lastPlan = () => plans()[plans().length - 1];

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useReminders(), { wrapper }).then((view) => ({ client, ...view }));
}

/** Gets the data the hook watches to show up again, as when the app refreshes it. */
const refetch = (client: QueryClient) =>
  act(async () => {
    await client.invalidateQueries();
  });

/** Waits for every query the hook depends on to have an answer. */
const loaded = (client: QueryClient) =>
  waitFor(() => {
    for (const key of [['membership', 'me'], ['reminders', 'p1', 'me'], ['meds', 'p1'], ['doses', 'p1'], ['appointments', 'p1']]) {
      expect(client.getQueryData(key)).toBeDefined();
    }
  });

describe('useReminders', () => {
  afterEach(settle);

  describe('scheduling', () => {
    it('hands the phone the plan once everything it depends on has loaded', async () => {
      await setup();
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(1));

      expect(keysOf(plans()[0])).toEqual(
        expect.arrayContaining(['water:9', 'kicks', 'vitamins:2026-10-03:evening', 'appointments:scan:two-hours']),
      );
      expect(clearScheduled).not.toHaveBeenCalled();
    });

    it('leaves the phone alone while any of it is still on its way', async () => {
      mockDb.hang = ['appointments'];
      const { client } = await setup();
      await waitFor(() => expect(client.getQueryData(['doses', 'p1'])).toBeDefined());
      await waitFor(() => expect(client.getQueryData(['reminders', 'p1', 'me'])).toBeDefined());
      await settle();
      expect(replaceScheduled).not.toHaveBeenCalled();
      expect(clearScheduled).not.toHaveBeenCalled();

      await release();
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(1));
    });

    it('schedules nothing while the phone has not allowed notifications', async () => {
      jest.mocked(permissionState).mockResolvedValue('denied');
      const { client } = await setup();
      await loaded(client);
      await settle();
      expect(replaceScheduled).not.toHaveBeenCalled();
      expect(askForPermission).not.toHaveBeenCalled();
    });

    it('starts as soon as notifications are allowed in Settings and she comes back to the app', async () => {
      jest.mocked(permissionState).mockResolvedValue('denied');
      const { client } = await setup();
      await loaded(client);
      expect(replaceScheduled).not.toHaveBeenCalled();

      jest.mocked(permissionState).mockResolvedValue('granted');
      await foreground();
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(1));
    });

    it('asks the phone for permission when a reminder is on, and schedules once it says yes', async () => {
      jest.mocked(permissionState).mockResolvedValue('undetermined');
      await setup();
      await waitFor(() => expect(askForPermission).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(1));
      expect(askForPermission).toHaveBeenCalledTimes(1);
    });

    it('does not schedule when the phone is asked and says no', async () => {
      jest.mocked(permissionState).mockResolvedValue('undetermined');
      jest.mocked(askForPermission).mockResolvedValue('denied');
      const { client } = await setup();
      await waitFor(() => expect(askForPermission).toHaveBeenCalledTimes(1));
      await loaded(client);
      await settle();
      expect(replaceScheduled).not.toHaveBeenCalled();
    });

    it('does not ask again while the first prompt is still open', async () => {
      jest.mocked(permissionState).mockResolvedValue('undetermined');
      jest.mocked(askForPermission).mockImplementation(() => new Promise(() => {}));
      const { client } = await setup();
      await waitFor(() => expect(askForPermission).toHaveBeenCalledTimes(1));

      // Every switch off, then back on: the screen sees "something is on" a second time.
      mockDb.rows.reminder_prefs = allOff;
      await refetch(client);
      await settle();
      mockDb.rows.reminder_prefs = [];
      await refetch(client);
      await settle();
      expect(askForPermission).toHaveBeenCalledTimes(1);
    });

    it('does not ask for permission when every reminder is switched off', async () => {
      jest.mocked(permissionState).mockResolvedValue('undetermined');
      mockDb.rows.reminder_prefs = allOff;
      const { client } = await setup();
      await loaded(client);
      await settle();
      expect(askForPermission).not.toHaveBeenCalled();
    });

    it('does not ask before it knows which reminders are on', async () => {
      jest.mocked(permissionState).mockResolvedValue('undetermined');
      mockDb.hang = ['reminder_prefs'];
      const { client } = await setup();
      await waitFor(() => expect(client.getQueryData(['meds', 'p1'])).toBeDefined());
      await settle();
      expect(askForPermission).not.toHaveBeenCalled();

      await release();
      await waitFor(() => expect(askForPermission).toHaveBeenCalledTimes(1));
    });

    it('with every reminder off, tells the phone to hold none', async () => {
      mockDb.rows.reminder_prefs = allOff;
      await setup();
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(1));
      expect(plans()[0]).toEqual([]);
    });
  });

  describe('keeping up', () => {
    it('plans again when a switch is turned off', async () => {
      const { client } = await setup();
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(1));

      mockDb.rows.reminder_prefs = [{ kind: 'water', enabled: false }];
      await refetch(client);
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(2));
      expect(keysOf(lastPlan()).some((k) => k.startsWith('water:'))).toBe(false);
      expect(keysOf(lastPlan())).toContain('kicks');
    });

    it('drops a vitamin reminder once the dose is ticked, even from the other phone', async () => {
      const { client } = await setup();
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(1));
      expect(keysOf(plans()[0])).toContain('vitamins:2026-10-03:evening');

      mockDb.rows.med_doses = [doseRow('iron', TODAY, 'partner')];
      await refetch(client);
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(2));
      expect(keysOf(lastPlan())).not.toContain('vitamins:2026-10-03:evening');
      expect(keysOf(lastPlan())).toContain('vitamins:2026-10-04:evening');
    });

    it('plans again when an appointment is booked', async () => {
      const { client } = await setup();
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(1));

      mockDb.rows.appointments = [
        ...mockDb.rows.appointments,
        { id: 'dentist', pregnancy_id: 'p1', title: 'Dentist', appt_date: '2026-10-07', appt_time: null, place: null },
      ];
      await refetch(client);
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(2));
      expect(keysOf(lastPlan())).toContain('appointments:dentist:day-before');
    });

    it('leaves the phone alone when the data changed but the plan did not', async () => {
      const { client } = await setup();
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(1));

      // A dose from last week changes the data and nothing coming up.
      mockDb.rows.med_doses = [doseRow('iron', '2026-09-26')];
      await refetch(client);
      await settle();
      expect(replaceScheduled).toHaveBeenCalledTimes(1);
    });

    it('brings the next day’s vitamins into the window when the day turns over', async () => {
      await setup();
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(1));
      expect(keysOf(plans()[0])).not.toContain('vitamins:2026-10-10:morning');

      jest.setSystemTime(TOMORROW_NOW);
      await foreground();
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(2));
      expect(keysOf(lastPlan())).toContain('vitamins:2026-10-10:morning');
      expect(keysOf(lastPlan()).some((k) => k.startsWith('vitamins:2026-10-03'))).toBe(false);
    });

    it('does one change to the phone at a time', async () => {
      let finishFirst!: () => void;
      jest.mocked(replaceScheduled).mockImplementationOnce(() => new Promise<void>((resolve) => (finishFirst = resolve)));
      const { client } = await setup();
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(1));

      mockDb.rows.reminder_prefs = [{ kind: 'water', enabled: false }];
      await refetch(client);
      await settle();
      expect(replaceScheduled).toHaveBeenCalledTimes(1);

      await act(async () => finishFirst());
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(2));
      expect(keysOf(lastPlan()).some((k) => k.startsWith('water:'))).toBe(false);
    });

    it('skips the plans that were overtaken while the phone was busy, and applies the newest', async () => {
      let finishFirst!: () => void;
      jest.mocked(replaceScheduled).mockImplementationOnce(() => new Promise<void>((resolve) => (finishFirst = resolve)));
      const { client } = await setup();
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(1));

      // Two more changes while the first is under way: water off, then kick counts off as well.
      mockDb.rows.reminder_prefs = [{ kind: 'water', enabled: false }];
      await refetch(client);
      await settle();
      mockDb.rows.reminder_prefs = [
        { kind: 'water', enabled: false },
        { kind: 'kicks', enabled: false },
      ];
      await refetch(client);
      await settle();
      expect(replaceScheduled).toHaveBeenCalledTimes(1);

      await act(async () => finishFirst());
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(2));
      await settle();
      expect(replaceScheduled).toHaveBeenCalledTimes(2);
      expect(keysOf(lastPlan()).some((k) => k.startsWith('water:'))).toBe(false);
      expect(keysOf(lastPlan())).not.toContain('kicks');
    });

    it('lets a clear overtake a plan that was waiting for the phone', async () => {
      let finishFirst!: () => void;
      jest.mocked(replaceScheduled).mockImplementationOnce(() => new Promise<void>((resolve) => (finishFirst = resolve)));
      const { client, rerender } = await setup();
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(1));

      // A newer plan is waiting, and then she signs out.
      mockDb.rows.reminder_prefs = [{ kind: 'water', enabled: false }];
      await refetch(client);
      await settle();
      mockSession = { session: null, loading: false };
      await rerender({});
      await settle();

      await act(async () => finishFirst());
      await waitFor(() => expect(clearScheduled).toHaveBeenCalledTimes(1));
      await settle();
      expect(replaceScheduled).toHaveBeenCalledTimes(1);
    });

    it('does not offer the newest plan again because an older one was turned down', async () => {
      let refuseFirst!: () => void;
      jest
        .mocked(replaceScheduled)
        .mockImplementationOnce(() => new Promise<void>((_, reject) => (refuseFirst = () => reject(new Error('the phone said no')))));
      const { client } = await setup();
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(1));

      mockDb.rows.reminder_prefs = [{ kind: 'water', enabled: false }];
      await refetch(client);
      await settle();
      await act(async () => refuseFirst());
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(2));

      // Something unrelated changes; the newest plan is already on the phone.
      mockDb.rows.med_doses = [doseRow('iron', '2026-09-26')];
      await refetch(client);
      await settle();
      expect(replaceScheduled).toHaveBeenCalledTimes(2);
    });

    it('offers the plan again the next time something changes after the phone turned it down', async () => {
      jest.mocked(replaceScheduled).mockRejectedValueOnce(new Error('the phone said no'));
      const { client } = await setup();
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(1));
      await settle();

      mockDb.rows.med_doses = [doseRow('iron', '2026-09-26')];
      await refetch(client);
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(2));
      expect(keysOf(plans()[1])).toEqual(keysOf(plans()[0]));
    });
  });

  describe('when there is nobody to remind', () => {
    it('leaves the phone alone when the app opens with no sign-in, as it does when it starts offline', async () => {
      mockSession = { session: null, loading: false };
      await setup();
      await settle();
      expect(clearScheduled).not.toHaveBeenCalled();
      expect(replaceScheduled).not.toHaveBeenCalled();
    });

    it('carries on once that sign-in comes back, and clears if she then signs out', async () => {
      mockSession = { session: null, loading: false };
      const { client, rerender } = await setup();
      await settle();

      mockSession = { session: { user: { id: 'me' } }, loading: false };
      await rerender({});
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(1));
      await loaded(client);
      expect(clearScheduled).not.toHaveBeenCalled();

      mockSession = { session: null, loading: false };
      await rerender({});
      await waitFor(() => expect(clearScheduled).toHaveBeenCalledTimes(1));
    });

    it('clears the phone when she signs out with the app open', async () => {
      const { client, rerender } = await setup();
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(1));
      await loaded(client);
      expect(clearScheduled).not.toHaveBeenCalled();

      mockSession = { session: null, loading: false };
      await rerender({});
      await waitFor(() => expect(clearScheduled).toHaveBeenCalledTimes(1));
      expect(replaceScheduled).toHaveBeenCalledTimes(1);
    });

    it('clears the phone when the pregnancy is gone, as for a partner who was removed', async () => {
      mockDb.membership = null;
      await setup();
      await waitFor(() => expect(clearScheduled).toHaveBeenCalledTimes(1));
      expect(replaceScheduled).not.toHaveBeenCalled();
    });

    it('does not clear anything while the session is still loading', async () => {
      mockSession = { session: null, loading: true };
      await setup();
      await settle();
      expect(clearScheduled).not.toHaveBeenCalled();
    });

    it('does not clear anything while her pregnancy is still loading', async () => {
      mockDb.hang = ['members'];
      await setup();
      await settle();
      expect(clearScheduled).not.toHaveBeenCalled();

      await release();
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(1));
      expect(clearScheduled).not.toHaveBeenCalled();
    });

    it('goes back to scheduling the same plan when she signs in again', async () => {
      const { client, rerender } = await setup();
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(1));
      await loaded(client);

      mockSession = { session: null, loading: false };
      await rerender({});
      await waitFor(() => expect(clearScheduled).toHaveBeenCalledTimes(1));

      mockSession = { session: { user: { id: 'me' } }, loading: false };
      await rerender({});
      await waitFor(() => expect(replaceScheduled).toHaveBeenCalledTimes(2));
      expect(keysOf(plans()[1])).toEqual(keysOf(plans()[0]));
    });
  });
});

describe('useNotificationPermission', () => {
  afterEach(settle);

  it('starts out checking, then says what the phone allows', async () => {
    let answer!: (state: 'denied') => void;
    jest.mocked(permissionState).mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    const { result } = await renderHook(() => useNotificationPermission());
    expect(result.current.state).toBe('checking');

    await act(async () => answer('denied'));
    expect(result.current.state).toBe('denied');
  });

  it('reads it again when the app comes back to the foreground', async () => {
    jest.mocked(permissionState).mockResolvedValue('denied');
    const { result } = await renderHook(() => useNotificationPermission());
    await waitFor(() => expect(result.current.state).toBe('denied'));

    jest.mocked(permissionState).mockResolvedValue('granted');
    await foreground();
    await waitFor(() => expect(result.current.state).toBe('granted'));
  });

  it('shows the phone’s prompt on ask, and keeps its answer', async () => {
    jest.mocked(permissionState).mockResolvedValue('undetermined');
    jest.mocked(askForPermission).mockResolvedValue('granted');
    const { result } = await renderHook(() => useNotificationPermission());
    await waitFor(() => expect(result.current.state).toBe('undetermined'));

    await act(async () => result.current.ask());
    expect(result.current.state).toBe('granted');
    expect(askForPermission).toHaveBeenCalledTimes(1);
  });

  it('lets go of the foreground listener when it leaves the screen', async () => {
    const { unmount } = await renderHook(() => useNotificationPermission());
    const calls = (AppState.addEventListener as jest.Mock).mock.results;
    const subscription = calls[calls.length - 1].value as { remove: jest.Mock };
    await unmount();
    expect(subscription.remove).toHaveBeenCalled();
  });
});
