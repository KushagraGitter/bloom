import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import MealsScreen from '@/app/(tabs)/meals';
import { MEAL_KIND } from '@/lib/meals';
import type { MealScanDraft } from '@/lib/scan';
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
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));
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

const DRAFT: MealScanDraft = {
  items: [
    { name: 'Dal tadka', portion: '1 bowl', kcal: 180, protein_g: 9, iron_mg: 2, calcium_mg: 40, folate_mcg: 90, fibre_g: 4 },
    { name: 'Jeera rice', portion: '1 cup', kcal: 210, protein_g: 4, iron_mg: 0.5, calcium_mg: 15, folate_mcg: 10, fibre_g: 1 },
    { name: 'Roti', portion: '2', kcal: 140, protein_g: 5, iron_mg: 1.5, calcium_mg: null, folate_mcg: 30, fibre_g: 3 },
  ],
  confidence: 'high',
  unreadable_lines: [],
};

let store: LocalStore;

async function show() {
  const opened = await readyVault();
  store = opened.store;
  return render(<MealsScreen />, { wrapper: vaultWrapper(opened.vault) });
}

const saved = async () => (await store.list('p1', MEAL_KIND)).map((r) => r.data as Record<string, unknown>);

/** A scan the test answers when it chooses. */
function pendingScan() {
  let answer!: (v: unknown) => void;
  invoke.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)) as never);
  return (value: unknown) => act(async () => answer(value));
}

beforeAll(() => {
  jest.useFakeTimers({
    now: new Date(2026, 9, 3, 13, 30),
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

describe('Snap your plate', () => {
  it('reads the photo, lets her leave a food out, and saves the checked meal', async () => {
    await show();
    await screen.findByText('Nothing logged yet today.');
    const answer = pendingScan();
    await fireEvent.press(screen.getByRole('button', { name: 'Take a photo' }));

    expect(await screen.findByText('Scanning your meal')).toBeTruthy();
    expect(screen.getByText('Reading your plate…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save meal' })).toBeDisabled();
    expect(screen.queryByLabelText('What was eaten?')).toBeNull();
    expect(invoke).toHaveBeenCalledWith('scan', {
      body: { kind: 'meal', pregnancyId: 'p1', file: { mediaType: 'image/jpeg', data: 'SlBFRw==' }, week: 24 },
    });

    await answer({ data: { draft: DRAFT }, error: null });
    expect(await screen.findByText('Check your meal')).toBeTruthy();
    expect(screen.getByText('Filled by AI · check & edit')).toBeTruthy();
    expect(screen.getByLabelText('What was eaten?').props.value).toBe('Dal tadka, Jeera rice, Roti');
    expect(screen.getByLabelText('Calories (kcal)').props.value).toBe('530');
    expect(screen.getByLabelText('Calcium (mg)').props.value).toBe('55');
    expect(screen.getByText('530')).toBeTruthy();
    // Lunchtime, so the meal starts on lunch.
    expect(screen.getByRole('radio', { name: 'Lunch', checked: true })).toBeTruthy();
    expect(await saved()).toEqual([]);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Jeera rice, 1 cup' }));
    expect(screen.getByRole('checkbox', { name: 'Jeera rice, 1 cup', checked: false })).toBeTruthy();
    expect(screen.getByLabelText('What was eaten?').props.value).toBe('Dal tadka, Roti');
    expect(screen.getByLabelText('Calories (kcal)').props.value).toBe('320');
    expect(screen.getByLabelText('Iron (mg)').props.value).toBe('3.5');

    await fireEvent.press(screen.getByRole('button', { name: 'Save meal' }));
    await waitFor(async () => expect(await saved()).toHaveLength(1));
    expect((await saved())[0]).toEqual({
      day: '2026-10-03',
      slot: 'lunch',
      time: '13:30',
      food: 'Dal tadka, Roti',
      note: null,
      amounts: { kcal: 320, protein: 14, iron: 3.5, calcium: 40, folate: 120, fibre: 7 },
      by: 'me',
      ai: true,
    });
    expect(await screen.findByText('Dal tadka, Roti')).toBeTruthy();
    expect(screen.getByLabelText('Read from a photo by AI')).toBeTruthy();
  });

  it('says when no food was spotted and lets her type the meal in', async () => {
    await show();
    await screen.findByText('Nothing logged yet today.');
    invoke.mockResolvedValueOnce({ data: { draft: { items: [], confidence: 'low', unreadable_lines: [] } }, error: null } as never);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose a photo' }));

    expect(await screen.findByText("Couldn't spot any food in that photo. Type the meal in below.")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('What was eaten?'), 'Khichdi');
    await fireEvent.press(screen.getByRole('button', { name: 'Save meal' }));
    await waitFor(async () => expect(await saved()).toHaveLength(1));
    // Nothing the AI read made it in, so it isn't marked as AI.
    expect((await saved())[0]).not.toHaveProperty('ai');
  });

  it('when the scan fails, offers to try again or type it in', async () => {
    await show();
    await screen.findByText('Nothing logged yet today.');
    invoke.mockResolvedValueOnce({ data: null, error: { name: 'FunctionsFetchError', context: new TypeError('offline') } } as never);
    await fireEvent.press(screen.getByRole('button', { name: 'Take a photo' }));

    expect(await screen.findByText('Couldn’t reach the AI. Check your connection and try again.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save meal' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Type it in' }));
    expect(await screen.findByText('Add a meal')).toBeTruthy();
    expect(screen.getByLabelText('What was eaten?').props.value).toBe('');
  });

  it('says how to allow the camera when it is refused', async () => {
    const picker = jest.requireMock('expo-image-picker');
    picker.requestCameraPermissionsAsync.mockResolvedValueOnce({ granted: false });
    await show();
    await screen.findByText('Nothing logged yet today.');
    await fireEvent.press(screen.getByRole('button', { name: 'Take a photo' }));
    expect(
      await screen.findByText('Bloom needs permission to use the camera or photos. You can allow it in your phone’s Settings.'),
    ).toBeTruthy();
    expect(invoke).not.toHaveBeenCalled();
  });
});
