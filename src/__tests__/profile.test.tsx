import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import ProfileScreen from '@/app/profile';
import { pregnancyDetailsId } from '@/lib/data';
import { openSystemSettings, permissionState, sendTestReminder } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { writeRecord } from '@/lib/vault/localStore';
import { readyVault } from '@/lib/vault/testHelpers';
import { vaultWrapper } from '@/lib/vault/testWrapper';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() } }));
jest.mock('@/lib/auth', () => ({ signOut: jest.fn(async () => {}) }));
jest.mock('@/lib/notifications', () => ({
  permissionState: jest.fn(),
  askForPermission: jest.fn(),
  sendTestReminder: jest.fn(),
  openSystemSettings: jest.fn(),
  clearScheduled: jest.fn(async () => {}),
}));

jest.mock('expo-print', () => ({ printToFileAsync: jest.fn(async () => ({ uri: 'file:///cache/summary.pdf' })) }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-file-system', () => {
  const written: Record<string, string> = {};
  class File {
    uri: string;
    constructor(dir: string, name: string) {
      this.uri = `${dir}/${name}`;
    }
    create() {}
    write(content: string) {
      written[this.uri] = content;
    }
  }
  return { File, Paths: { cache: 'file:///cache' }, __written: written };
});

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 0,
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)) }));

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
  const functions = { invoke: jest.fn(async () => ({ data: { deleted: true }, error: null })) };
  const auth = { signOut: jest.fn(async () => ({ error: null })) };
  return { isSupabaseConfigured: true, supabase: { from, rpc, functions, auth, __calls: calls } };
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

  it('offers System, Light and Dark, following the phone until one is picked', async () => {
    await render(<ProfileScreen />, { wrapper });
    expect(await screen.findByRole('radio', { name: 'System', checked: true })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Light', checked: false })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Dark', checked: false })).toBeTruthy();
  });

  it('lets the owner create an invite code for their partner', async () => {
    await render(<ProfileScreen />, { wrapper });
    await fireEvent.press(await screen.findByRole('button', { name: 'Create invite code' }));
    expect(await screen.findByText('123 456')).toBeTruthy();
    expect(screen.getByText(/^Expires in 4\d hours · works once$/)).toBeTruthy();
    expect(calls()).toContainEqual(expect.objectContaining({ table: 'new_invite', op: 'rpc', value: { p_pregnancy_id: 'p1' } }));
  });

  it('edits a detail into the vault, not the readable pregnancy row', async () => {
    const { vault, store } = await readyVault();
    await render(<ProfileScreen />, { wrapper: vaultWrapper(vault) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Nickname: not set. Edit' }));
    await fireEvent.changeText(screen.getByLabelText('Nickname'), 'Peanut');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('button', { name: 'Nickname: Peanut. Edit' })).toBeTruthy();
    const record = await store.get(pregnancyDetailsId('p1'));
    expect(record).toMatchObject({ kind: 'pregnancy', dirty: true, data: { nickname: 'Peanut', blood_group: 'B+', lmp_date: '2026-04-15' } });
    expect(calls().filter((c) => c.table === 'pregnancies')).toEqual([]);
  });

  it('shows the details kept in the vault over the server’s copy', async () => {
    const { vault, store } = await readyVault();
    await writeRecord(store, { id: pregnancyDetailsId('p1'), pregnancyId: 'p1', kind: 'pregnancy', data: { blood_group: 'O+', height_cm: 170 } });
    await render(<ProfileScreen />, { wrapper: vaultWrapper(vault) });
    expect(await screen.findByText('170 cm')).toBeTruthy();
    expect(screen.getByText('O+')).toBeTruthy();
    expect(screen.queryByText('B+')).toBeNull();
  });

  it('recalculates the due date when the period date changes', async () => {
    const { vault, store } = await readyVault();
    await render(<ProfileScreen />, { wrapper: vaultWrapper(vault) });
    await fireEvent.press(await screen.findByRole('button', { name: /^Last period started: .*\. Edit$/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await store.get(pregnancyDetailsId('p1')))?.data).toMatchObject({ lmp_date: '2026-04-15', due_date: '2027-01-20', method: 'lmp' }));
  });
});

describe('Profile connected health', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows the row where the build offers health data', async () => {
    await render(<ProfileScreen />, { wrapper });
    expect(await screen.findByText('Connected health')).toBeTruthy();
  });

  it('hides it where the build leaves it out (Health Connect for now)', async () => {
    const { healthSource } = jest.requireActual<typeof import('@/lib/health/source')>('@/lib/health/source');
    jest.replaceProperty(healthSource, 'offered', false);
    await render(<ProfileScreen />, { wrapper });
    await screen.findByText('Household key');
    expect(screen.queryByText('Connected health')).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect((require('@/lib/health/source.android') as typeof import('@/lib/health/source')).healthSource.offered).toBe(false);
  });
});

describe('Profile household key', () => {
  it('opens the household key screen', async () => {
    const { router } = jest.requireMock<{ router: { push: jest.Mock } }>('expo-router');
    await render(<ProfileScreen />, { wrapper });
    await fireEvent.press(await screen.findByRole('button', { name: 'Household key: not set. Edit' }));
    expect(router.push).toHaveBeenCalledWith('/household-key');
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

describe('Profile download my data', () => {
  const Print = jest.requireMock<{ printToFileAsync: jest.Mock }>('expo-print');
  const Sharing = jest.requireMock<{ isAvailableAsync: jest.Mock; shareAsync: jest.Mock }>('expo-sharing');
  const written = jest.requireMock<{ __written: Record<string, string> }>('expo-file-system').__written;

  beforeEach(() => {
    Print.printToFileAsync.mockClear();
    Sharing.shareAsync.mockClear();
    Sharing.isAvailableAsync.mockResolvedValue(true);
  });

  it('makes a PDF summary from the vault and opens the share sheet', async () => {
    const { vault, store } = await readyVault();
    await writeRecord(store, { id: 'm1', pregnancyId: 'p1', kind: 'medication', data: { name: 'Folic acid', dose: '5 mg', time_of_day: 'morning' } });
    await render(<ProfileScreen />, { wrapper: vaultWrapper(vault) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Download PDF summary' }));
    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/summary.pdf', expect.objectContaining({ mimeType: 'application/pdf' })));
    expect(Print.printToFileAsync.mock.calls[0][0].html).toContain('Folic acid');
  });

  it('writes every record to a JSON file and shares it', async () => {
    const { vault, store } = await readyVault();
    await writeRecord(store, { id: 'q1', pregnancyId: 'p1', kind: 'question', data: { text: 'Iron?' } });
    await render(<ProfileScreen />, { wrapper: vaultWrapper(vault) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Download all data (JSON)' }));
    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalled());
    const [uri, options] = Sharing.shareAsync.mock.calls[0];
    expect(uri).toMatch(/^file:\/\/\/cache\/bloom-data-\d{4}-\d{2}-\d{2}\.json$/);
    expect(options).toMatchObject({ mimeType: 'application/json' });
    expect(JSON.parse(written[uri]).records.question).toEqual([expect.objectContaining({ id: 'q1', data: { text: 'Iron?' } })]);
  });

  it('says so when the phone cannot share files', async () => {
    Sharing.isAvailableAsync.mockResolvedValue(false);
    const { vault } = await readyVault();
    await render(<ProfileScreen />, { wrapper: vaultWrapper(vault) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Download PDF summary' }));
    expect(await screen.findByText('This phone can’t share files from Bloom.')).toBeTruthy();
    expect(Print.printToFileAsync).not.toHaveBeenCalled();
  });
});

describe('Profile delete account', () => {
  const sb = supabase as unknown as { functions: { invoke: jest.Mock }; auth: { signOut: jest.Mock } };
  const SecureStore = jest.requireMock<{ deleteItemAsync: jest.Mock }>('expo-secure-store');

  beforeEach(() => {
    sb.functions.invoke.mockClear().mockResolvedValue({ data: { deleted: true }, error: null });
    sb.auth.signOut.mockClear();
    SecureStore.deleteItemAsync.mockClear();
  });

  const open = async () => {
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete account' }));
    expect(await screen.findByText('Delete your account?')).toBeTruthy();
  };

  it('waits for DELETE to be typed, then deletes, wipes this phone and signs out', async () => {
    const { vault, store } = await readyVault();
    await writeRecord(store, { id: 'q1', pregnancyId: 'p1', kind: 'question', data: { text: 'Iron?' } });
    await render(<ProfileScreen />, { wrapper: vaultWrapper(vault) });
    await open();
    expect(screen.getByText(/everything in it/)).toBeTruthy();

    const confirm = () => screen.getAllByRole('button', { name: 'Delete account' }).at(-1)!;
    await fireEvent.press(confirm());
    expect(sb.functions.invoke).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'delete');
    await fireEvent.press(confirm());
    await waitFor(() => expect(sb.auth.signOut).toHaveBeenCalledWith({ scope: 'local' }));
    expect(sb.functions.invoke).toHaveBeenCalledWith('delete-account', { body: { confirm: 'delete my account' } });
    expect(await store.listAll('p1')).toEqual([]);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  });

  it('keeps everything on the phone when the server could not delete', async () => {
    sb.functions.invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError', context: {} } });
    const { vault, store } = await readyVault();
    await writeRecord(store, { id: 'q1', pregnancyId: 'p1', kind: 'question', data: { text: 'Iron?' } });
    await render(<ProfileScreen />, { wrapper: vaultWrapper(vault) });
    await open();
    await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await fireEvent.press(screen.getAllByRole('button', { name: 'Delete account' }).at(-1)!);
    expect(await screen.findByText(/Couldn’t reach Bloom.*Nothing was deleted/)).toBeTruthy();
    expect(await store.listAll('p1')).toHaveLength(1);
    expect(sb.auth.signOut).not.toHaveBeenCalled();
  });
});
