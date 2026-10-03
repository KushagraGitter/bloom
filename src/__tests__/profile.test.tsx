import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import ProfileScreen from '@/app/profile';
import { openSystemSettings, permissionState, sendTestReminder } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() } }));
jest.mock('@/lib/auth', () => ({ signOut: jest.fn(async () => {}) }));
jest.mock('@/lib/notifications', () => ({
  permissionState: jest.fn(),
  askForPermission: jest.fn(),
  sendTestReminder: jest.fn(),
  openSystemSettings: jest.fn(),
}));

jest.mock('@/lib/session', () => ({
  useSession: () => ({ session: { user: { id: 'me', email: 'ananya@example.com' } }, loading: false }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

jest.mock('@/lib/supabase', () => {
  const calls: { table: string; op: string; value?: unknown; filters: Record<string, unknown> }[] = [];
  const pregnancy = {
    id: 'p1',
    owner_id: 'me',
    lmp_date: '2026-04-15',
    due_date: '2027-01-20',
    method: 'lmp',
    babies: 1,
    first_pregnancy: true,
    sex: 'unknown',
    nickname: null,
    height_cm: 162,
    pre_weight_kg: 59,
    blood_group: 'B+',
    conditions: [],
    allergies: null,
    doctor: null,
    hospital: null,
    hospital_phone: null,
    emergency_contact: null,
    emergency_phone: null,
    units: 'metric',
  };
  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    let op = 'select';
    let value: unknown;
    const result = () => {
      if (op !== 'select') {
        calls.push({ table, op, value, filters });
        return { data: null, error: null };
      }
      if (table === 'members') {
        return filters.user_id
          ? { data: { role: 'owner', pregnancy }, error: null }
          : { data: [{ user_id: 'me', role: 'owner', profile: { name: 'Ananya Rao' } }], error: null };
      }
      if (table === 'profiles') return { data: { id: 'me', name: 'Ananya Rao', avatar_url: null }, error: null };
      if (table === 'reminder_prefs') return { data: [{ kind: 'water', enabled: false }], error: null };
      return { data: null, error: null };
    };
    const q = {
      select: () => q,
      eq: (col: string, v: unknown) => ((filters[col] = v), q),
      is: () => q,
      gt: () => q,
      order: () => q,
      limit: () => q,
      insert: (v: unknown) => ((op = 'insert'), (value = v), q),
      update: (v: unknown) => ((op = 'update'), (value = v), q),
      upsert: (v: unknown) => ((op = 'upsert'), (value = v), q),
      delete: () => ((op = 'delete'), q),
      single: async () => result(),
      maybeSingle: async () => result(),
      then: (resolve: (v: unknown) => void) => resolve(result()),
    };
    return q;
  };
  const rpc = jest.fn(async (fn: string, args: unknown) => {
    calls.push({ table: fn, op: 'rpc', value: args, filters: {} });
    return { data: { id: 'i1', pregnancy_id: 'p1', code: '123456', expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString() }, error: null };
  });
  return { isSupabaseConfigured: true, supabase: { from, rpc, __calls: calls } };
});

const calls = () => (supabase as unknown as { __calls: { table: string; op: string; value?: unknown }[] }).__calls;

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => jest.restoreAllMocks());

beforeEach(() => {
  jest.mocked(permissionState).mockReset().mockResolvedValue('granted');
  jest.mocked(sendTestReminder).mockReset().mockResolvedValue();
  jest.mocked(openSystemSettings).mockReset().mockResolvedValue();
});

describe('Profile', () => {
  it('shows details and this person’s reminder switches', async () => {
    await render(<ProfileScreen />, { wrapper });
    expect(await screen.findAllByText('Ananya Rao')).toHaveLength(2);
    expect(screen.getByText('162 cm')).toBeTruthy();
    expect(screen.getByText('B+')).toBeTruthy();
    expect(await screen.findByRole('switch', { name: 'Drink water', checked: false })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Vitamins', checked: true })).toBeTruthy();
  });

  it('lets the owner create an invite code for their partner', async () => {
    await render(<ProfileScreen />, { wrapper });
    await fireEvent.press(await screen.findByRole('button', { name: 'Create invite code' }));
    expect(await screen.findByText('123 456')).toBeTruthy();
    expect(screen.getByText(/^Expires in 4\d hours · works once$/)).toBeTruthy();
    expect(calls()).toContainEqual(expect.objectContaining({ table: 'new_invite', op: 'rpc', value: { p_pregnancy_id: 'p1' } }));
  });

  it('edits a detail through the sheet', async () => {
    await render(<ProfileScreen />, { wrapper });
    await fireEvent.press(await screen.findByRole('button', { name: 'Nickname: not set. Edit' }));
    await fireEvent.changeText(screen.getByLabelText('Nickname'), 'Peanut');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(calls()).toContainEqual(expect.objectContaining({ table: 'pregnancies', op: 'update', value: { nickname: 'Peanut' } }));
  });
});

describe('Profile reminders and the phone’s permission', () => {
  const noteText = /Notifications are off for Bloom/;

  /** The whole screen, the partner list included, has finished loading. */
  const loaded = () => waitFor(() => expect(screen.getAllByText('Ananya Rao')).toHaveLength(2));

  it('says so when the phone has notifications turned off, and takes her to Settings', async () => {
    jest.mocked(permissionState).mockResolvedValue('denied');
    await render(<ProfileScreen />, { wrapper });
    await loaded();

    expect(await screen.findByText(noteText)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));
    expect(openSystemSettings).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Send a test reminder' })).toBeNull();
  });

  it('keeps quiet about it when notifications are allowed', async () => {
    await render(<ProfileScreen />, { wrapper });
    await loaded();
    await screen.findByRole('button', { name: 'Send a test reminder' });
    expect(screen.queryByText(noteText)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open Settings' })).toBeNull();
  });

  it('keeps quiet about it before the phone has been asked', async () => {
    jest.mocked(permissionState).mockResolvedValue('undetermined');
    await render(<ProfileScreen />, { wrapper });
    await loaded();
    await screen.findByRole('switch', { name: 'Vitamins', checked: true });
    await waitFor(() => expect(permissionState).toHaveBeenCalled());
    expect(screen.queryByText(noteText)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send a test reminder' })).toBeNull();
  });

  it('lets a development build send itself a test reminder', async () => {
    await render(<ProfileScreen />, { wrapper });
    await loaded();
    expect(await screen.findByText('Arrives in 5 seconds')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Send a test reminder' }));
    expect(sendTestReminder).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('On its way')).toBeTruthy();
  });

  it('keeps the test reminder out of a release build', async () => {
    jest.replaceProperty(globalThis as { __DEV__?: boolean }, '__DEV__', false);
    await render(<ProfileScreen />, { wrapper });
    await loaded();
    await screen.findByRole('switch', { name: 'Vitamins', checked: true });
    await waitFor(() => expect(permissionState).toHaveBeenCalled());
    await screen.findByText('REMINDERS');
    expect(screen.queryByRole('button', { name: 'Send a test reminder' })).toBeNull();
    expect(screen.queryByText('Arrives in 5 seconds')).toBeNull();
  });

  it('says when the test reminder could not be sent', async () => {
    jest.mocked(sendTestReminder).mockRejectedValue(new Error('no'));
    await render(<ProfileScreen />, { wrapper });
    await loaded();
    await fireEvent.press(await screen.findByRole('button', { name: 'Send a test reminder' }));
    expect(await screen.findByText('Couldn’t send it')).toBeTruthy();
  });
});
