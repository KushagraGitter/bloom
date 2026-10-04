import { act, fireEvent, render, screen } from '@testing-library/react-native';

import VitaminsScreen from '@/app/(tabs)/vitamins';
import type { RxScanDraft } from '@/lib/scan';
import { untilLine } from '@/lib/vitamins';
import { supabase } from '@/lib/supabase';
import type { LocalStore } from '@/lib/vault/localStore';
import { readyVault } from '@/lib/vault/testHelpers';
import { vaultWrapper } from '@/lib/vault/testWrapper';


jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)) }));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

jest.mock('@/lib/session', () => ({
  useSession: () => ({ session: { user: { id: 'me', email: 'ananya@example.com' } }, loading: false }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: 'file:///cam.jpg', width: 3000, height: 4000, fileName: null }] })),
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///cbc.jpg', width: 3000, height: 4000, fileName: 'cbc.jpg' }],
  })),
}));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: 'file:///rx.pdf', name: 'rx.pdf', size: 2000 }] })),
}));
jest.mock('expo-file-system', () => ({ File: jest.fn(() => ({ base64: async () => 'JVBERi0=' })) }));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => {
      const context = {
        resize: () => context,
        renderAsync: async () => ({ saveAsync: async () => ({ base64: 'SlBFRw==' }), release: () => {} }),
        release: () => {},
      };
      return context;
    },
  },
}));

// Membership for the screen, the two members for "Added by", and the scan function.
jest.mock('@/lib/supabase', () => {
  const membership = {
    role: 'owner',
    pregnancy: { id: 'p1', owner_id: 'me', lmp_date: '2026-04-15', due_date: '2027-01-20', babies: 1, units: 'metric' },
  };
  const members = [
    { user_id: 'me', role: 'owner', profile: { name: 'Ananya Rao' } },
    { user_id: 'kush', role: 'partner', profile: { name: 'Kush Sharma' } },
  ];
  const q = {
    select: () => q,
    eq: () => q,
    limit: () => q,
    maybeSingle: async () => ({ data: membership, error: null }),
    then: (resolve: (v: unknown) => void) => resolve({ data: members, error: null }),
  };
  return { isSupabaseConfigured: true, supabase: { from: () => q, functions: { invoke: jest.fn() } } };
});

jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null }));


const invoke = jest.mocked(supabase.functions.invoke);

const DRAFT: RxScanDraft = {
  doctor: 'Dr Meera Rao',
  date: '2026-10-01',
  meds: [
    { name: 'Ferrous ascorbate', strength: '100 mg', dose: '1 tablet', frequency: '0-1-0', time_of_day: 'afternoon', duration_days: 90, instructions: 'after lunch' },
    { name: 'Calcium + D3', strength: '', dose: '1 tablet', frequency: 'HS', time_of_day: 'evening', duration_days: null, instructions: '' },
    { name: 'Vitamin B12', strength: '1500 mcg', dose: '1 tablet', frequency: 'OD', time_of_day: 'morning', duration_days: 30, instructions: '' },
  ],
  unreadable_lines: ['A line under the signature'],
};

let store: LocalStore;

async function show() {
  const opened = await readyVault();
  store = opened.store;
  return render(<VitaminsScreen />, { wrapper: vaultWrapper(opened.vault) });
}

const meds = async () =>
  (await store.list('p1', 'medication'))
    .map((r) => r.data as Record<string, unknown>)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map(({ created_at: _created, ...rest }) => rest);

/** A scan the test answers when it chooses. */
function pendingScan() {
  let answer!: (v: unknown) => void;
  invoke.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)) as never);
  return (value: unknown) => act(async () => answer(value));
}

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
beforeEach(() => jest.clearAllMocks());
afterEach(() =>
  act(async () => {
    for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  }),
);

describe('Scan a prescription', () => {
  it('reads it, lets her correct and untick medicines, and adds only the ticked ones', async () => {
    await show();
    await screen.findByText('Nothing here yet.');
    const answer = pendingScan();
    await fireEvent.press(screen.getByRole('button', { name: 'PDF' }));

    expect(await screen.findByText('Scanning prescription')).toBeTruthy();
    expect(screen.getByText('Reading the handwriting…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reading…' })).toBeDisabled();
    expect(invoke).toHaveBeenCalledWith('scan', {
      body: { kind: 'rx', pregnancyId: 'p1', file: { mediaType: 'application/pdf', data: 'JVBERi0=' }, week: 24 },
    });

    await answer({ data: { draft: DRAFT }, error: null });
    expect(await screen.findByText('Check medicines')).toBeTruthy();
    expect(screen.getByText('Filled by AI · check before adding')).toBeTruthy();
    expect(screen.getByText('3 medicines found')).toBeTruthy();
    expect(screen.getByText('· A line under the signature')).toBeTruthy();
    expect(screen.getByLabelText('Dose for Ferrous ascorbate').props.value).toBe('100 mg · 1 tablet · after lunch');
    expect(screen.getByLabelText('Days to take Ferrous ascorbate').props.value).toBe('90');
    expect(screen.getByText('Written as “0-1-0”')).toBeTruthy();
    expect(await meds()).toEqual([]);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Include Vitamin B12' }));
    await fireEvent.changeText(screen.getAllByLabelText('Medicine name')[1], 'Calcium + Vitamin D3');
    await fireEvent.press(screen.getAllByRole('radio', { name: 'Morning' })[1]);
    await fireEvent.press(screen.getByRole('button', { name: 'Add 2 medicines' }));

    expect(await screen.findByText('2 medicines added from your prescription')).toBeTruthy();
    expect(await meds()).toEqual([
      {
        name: 'Ferrous ascorbate',
        dose: '100 mg · 1 tablet · after lunch',
        time_of_day: 'afternoon',
        start_date: '2026-10-03',
        end_date: '2026-12-31',
        source: 'rx',
      },
      { name: 'Calcium + Vitamin D3', dose: '1 tablet', time_of_day: 'morning', start_date: '2026-10-03', end_date: null, source: 'rx' },
    ]);
    expect(await screen.findByText(untilLine('2026-12-31'))).toBeTruthy();
  });

  it('asks for a sensible number of days before adding', async () => {
    await show();
    await screen.findByText('Nothing here yet.');
    invoke.mockResolvedValueOnce({ data: { draft: DRAFT }, error: null } as never);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose a photo' }));
    await screen.findByText('Check medicines');

    await fireEvent.changeText(screen.getByLabelText('Days to take Vitamin B12'), '0');
    await fireEvent.press(screen.getByRole('button', { name: 'Add 3 medicines' }));
    expect(await screen.findByText('Days for Vitamin B12 should be from 1 to 366, or empty if it carries on.')).toBeTruthy();
    expect(await meds()).toEqual([]);
  });

  it('when the scan fails, offers to try again or add by hand', async () => {
    await show();
    await screen.findByText('Nothing here yet.');
    invoke.mockResolvedValueOnce({ data: null, error: { name: 'FunctionsFetchError', context: new TypeError('offline') } } as never);
    await fireEvent.press(screen.getByRole('button', { name: 'Take a photo' }));
    expect(await screen.findByText('Couldn’t reach the AI. Check your connection and try again.')).toBeTruthy();

    invoke.mockResolvedValueOnce({ data: { draft: { ...DRAFT, meds: [], unreadable_lines: [] } }, error: null } as never);
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText("Couldn't find any medicines on it. Try a clearer photo, or add them by hand.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add 0 medicines' })).toBeDisabled();
  });
});
