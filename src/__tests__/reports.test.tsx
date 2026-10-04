import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import ReportsScreen from '@/app/(tabs)/reports';
import { QUESTION_KIND, REPORT_KIND, type Report, type ScanDraft } from '@/lib/reports';
import { supabase } from '@/lib/supabase';
import { writeRecord, type LocalStore } from '@/lib/vault/localStore';
import { readyVault } from '@/lib/vault/testHelpers';
import { vaultWrapper } from '@/lib/vault/testWrapper';
import type { Vault } from '@/lib/vault/VaultProvider';

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

const invoke = jest.mocked(supabase.functions.invoke);

const DRAFT: ScanDraft = {
  title: 'Complete blood count',
  kind: 'blood',
  report_date: '2026-09-30',
  lab: 'City Lab',
  values: [
    { name: 'Haemoglobin', value: '11.9', unit: 'g/dL', ref_range: '11.5–15.0', flagged_by_lab: false },
    { name: 'Platelets', value: '2.3', unit: 'lakh/µL', ref_range: '1.5–4.5', flagged_by_lab: true },
    { name: 'MCV', value: '84', unit: 'fL', ref_range: '80–100', flagged_by_lab: false },
  ],
  summary: 'A blood count with three results.',
  unreadable_lines: ['A handwritten note at the bottom'],
};

let vault: Vault;
let store: LocalStore;

async function show(seed: () => Promise<void> = async () => {}) {
  ({ vault, store } = await readyVault());
  await seed();
  return render(<ReportsScreen />, { wrapper: vaultWrapper(vault) });
}

const saved = async (kind = REPORT_KIND) => (await store.list('p1', kind)).map((r) => r.data as Record<string, unknown>);

function report(id: string, data: Partial<Report>) {
  return writeRecord(store, {
    id,
    pregnancyId: 'p1',
    kind: REPORT_KIND,
    data: {
      title: 'Report',
      kind: 'blood',
      week: 20,
      place: '',
      date: '',
      values: [],
      summary: '',
      file: '',
      source: 'manual',
      added: '2026-10-01T10:00:00.000Z',
      by: 'me',
      ...data,
    },
  });
}

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

/** Lets queries still announcing results finish inside act, so none lands after the test. */
afterEach(() =>
  act(async () => {
    for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  }),
);

describe('Reports', () => {
  it('reads a photo with the AI, lets her correct it, and saves only what she confirms', async () => {
    await show();
    expect(await screen.findByText('Reports you add show here, with their results and the lab’s ranges.')).toBeTruthy();
    const answer = pendingScan();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose a photo' }));

    expect(await screen.findByText('Scanning report')).toBeTruthy();
    expect(screen.getByText('Reading your report…')).toBeTruthy();
    expect(screen.getByText('cbc.jpg')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save report' })).toBeDisabled();
    expect(invoke).toHaveBeenCalledWith('scan', {
      body: { kind: 'report', pregnancyId: 'p1', file: { mediaType: 'image/jpeg', data: 'SlBFRw==' }, week: 24 },
    });
    expect(await saved()).toEqual([]);

    await answer({ data: { draft: DRAFT }, error: null });
    expect(await screen.findByText('Check your report')).toBeTruthy();
    expect(screen.getByText('Filled by AI · check & edit')).toBeTruthy();
    expect(screen.getByText('3 values found')).toBeTruthy();
    expect(screen.getByText('· A handwritten note at the bottom')).toBeTruthy();
    expect(screen.getByLabelText('Report name').props.value).toBe('Complete blood count');
    expect(screen.getByLabelText('Week').props.value).toBe('24');
    expect(screen.getByLabelText('Lab / clinic').props.value).toBe('City Lab');
    expect(screen.getByRole('radio', { name: 'Blood test', checked: true })).toBeTruthy();
    expect(screen.getByText('A blood count with three results.')).toBeTruthy();
    expect(screen.getByText('Platelets · range 1.5–4.5 · marked')).toBeTruthy();
    // Nothing is saved until she taps Save.
    expect(await saved()).toEqual([]);

    await fireEvent.changeText(screen.getByLabelText('Haemoglobin result'), '11.8 g/dL');
    await fireEvent.press(screen.getByRole('button', { name: 'Remove MCV' }));
    await fireEvent.changeText(screen.getByLabelText('Test name'), 'TSH');
    await fireEvent.changeText(screen.getByLabelText('Result'), '1.8 mIU/L');
    await fireEvent.press(screen.getByRole('button', { name: 'Add value' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save report' }));

    await waitFor(() => expect(screen.queryByText('Check your report')).toBeNull());
    expect(await saved()).toEqual([
      {
        title: 'Complete blood count',
        kind: 'blood',
        week: 24,
        place: 'City Lab',
        date: '2026-09-30',
        values: [
          { name: 'Haemoglobin', value: '11.8 g/dL', range: '11.5–15.0', flagged: false },
          { name: 'Platelets', value: '2.3 lakh/µL', range: '1.5–4.5', flagged: true },
          { name: 'TSH', value: '1.8 mIU/L', range: '', flagged: false },
        ],
        summary: 'A blood count with three results.',
        file: 'cbc.jpg',
        source: 'ai',
        added: new Date(2026, 9, 3, 10, 0).toISOString(),
        by: 'me',
      },
    ]);

    expect(await screen.findByText('Complete blood count')).toBeTruthy();
    expect(screen.getByText('Lab range 11.5–15.0')).toBeTruthy();
    expect(screen.getByText('Marked on the report')).toBeTruthy();
    expect(screen.getByText('Not a diagnosis. Go over results with your doctor.')).toBeTruthy();
    expect(screen.queryByText(/^Added by/)).toBeNull();
  });

  it('when the day’s scans are used up, offers to fill it in by hand with the file name kept', async () => {
    await show();
    await screen.findByText(/Reports you add show here/);
    invoke.mockResolvedValueOnce({
      data: null,
      error: { name: 'FunctionsHttpError', context: { status: 429, json: async () => ({ error: 'daily_limit' }) } },
    } as never);
    await fireEvent.press(screen.getByRole('button', { name: 'Take a photo' }));

    expect(await screen.findByText('You’ve used today’s AI scans. Fill this one in by hand, or scan it tomorrow.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save report' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Fill it in by hand' }));

    expect(await screen.findByText('Add a report')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Scan' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save report' }));
    await waitFor(async () => expect(await saved()).toHaveLength(1));
    expect((await saved())[0]).toMatchObject({ title: 'Photo', kind: 'scan', source: 'manual', file: 'Photo', summary: '', week: null });
  });

  it('can try a failed scan again', async () => {
    await show();
    await screen.findByText(/Reports you add show here/);
    invoke.mockResolvedValueOnce({ data: null, error: { name: 'FunctionsFetchError', context: new TypeError('offline') } } as never);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose a photo' }));
    expect(await screen.findByText('Couldn’t reach the AI. Check your connection and try again.')).toBeTruthy();

    invoke.mockResolvedValueOnce({ data: { draft: DRAFT }, error: null } as never);
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Check your report')).toBeTruthy();
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('cancelling while it reads saves nothing, even when the answer arrives later', async () => {
    await show();
    await screen.findByText(/Reports you add show here/);
    const answer = pendingScan();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose a photo' }));
    await screen.findByText('Reading your report…');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByText('Scanning report')).toBeNull());
    await answer({ data: { draft: DRAFT }, error: null });
    expect(screen.queryByText('Check your report')).toBeNull();
    expect(await saved()).toEqual([]);
  });

  it('adds a report by hand, checking the name and week', async () => {
    await show();
    await fireEvent.press(await screen.findByRole('button', { name: 'or add one by hand' }));
    expect(await screen.findByText('Add a report')).toBeTruthy();
    expect(invoke).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Save report' }));
    expect(await screen.findByText('Give the report a name.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Report name'), 'Thyroid panel');
    await fireEvent.changeText(screen.getByLabelText('Week'), '60');
    await fireEvent.press(screen.getByRole('button', { name: 'Save report' }));
    expect(await screen.findByText('The week should be a number from 1 to 42.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Week'), '12');
    // A value typed but not added with + is kept too.
    await fireEvent.changeText(screen.getByLabelText('Test name'), 'TSH');
    await fireEvent.changeText(screen.getByLabelText('Result'), '1.8');
    await fireEvent.press(screen.getByRole('button', { name: 'Save report' }));

    await waitFor(async () => expect(await saved()).toHaveLength(1));
    expect((await saved())[0]).toMatchObject({
      title: 'Thyroid panel',
      week: 12,
      source: 'manual',
      values: [{ name: 'TSH', value: '1.8', range: '', flagged: false }],
    });
    expect(await screen.findByText('Thyroid panel')).toBeTruthy();
    expect(screen.queryByText(/Lab range/)).toBeNull();
  });

  it('lists reports by week, filters them, says who added one, and removes one after asking', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await show(async () => {
      await report('r1', { title: 'Thyroid panel', week: 12 });
      await report('r2', { title: 'Anatomy scan', kind: 'scan', week: 20, place: 'Sunrise Clinic', by: 'kush' });
      await report('r3', { title: 'Complete blood count', week: 22 });
    });
    expect(await screen.findByText('Anatomy scan')).toBeTruthy();
    expect(screen.getAllByText(/^(Thyroid panel|Anatomy scan|Complete blood count)$/).map((n) => n.props.children)).toEqual([
      'Complete blood count',
      'Anatomy scan',
      'Thyroid panel',
    ]);
    expect(screen.getByText('Week 20 · Sunrise Clinic')).toBeTruthy();
    expect(await screen.findByText('Added by Kush')).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'Scans' }));
    expect(screen.queryByText('Thyroid panel')).toBeNull();
    expect(screen.getByText('Anatomy scan')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Notes' }));
    expect(screen.getByText('No reports of this kind yet.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'All' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Remove Thyroid panel' }));
    expect(alert.mock.calls[0][0]).toBe('Remove “Thyroid panel”?');
    expect(await saved()).toHaveLength(3);
    await act(async () => alert.mock.calls[0][2]?.find((b) => b.style === 'destructive')?.onPress?.());
    await waitFor(() => expect(screen.queryByText('Thyroid panel')).toBeNull());
    expect((await store.list('p1', REPORT_KIND)).map((r) => r.id).sort()).toEqual(['r2', 'r3']);
  });

  it('keeps questions for the next visit', async () => {
    await show();
    expect(await screen.findByText('Jot down anything to ask the doctor.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('New question'), '  What to eat before   the glucose test? ');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('· What to eat before the glucose test?')).toBeTruthy();
    expect(screen.getByLabelText('New question').props.value).toBe('');
    expect((await saved(QUESTION_KIND)).map((q) => q.text)).toEqual(['What to eat before the glucose test?']);

    await fireEvent.press(screen.getByRole('button', { name: 'Remove question: What to eat before the glucose test?' }));
    await waitFor(() => expect(screen.queryByText('· What to eat before the glucose test?')).toBeNull());
    expect(await saved(QUESTION_KIND)).toEqual([]);
  });

  it('says when it can’t use the camera', async () => {
    await show();
    await screen.findByText(/Reports you add show here/);
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValueOnce({ granted: false } as never);
    await fireEvent.press(screen.getByRole('button', { name: 'Take a photo' }));
    expect(await screen.findByText('Bloom needs permission to use the camera or photos. You can allow it in your phone’s Settings.')).toBeTruthy();
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
    expect(screen.queryByText('Scanning report')).toBeNull();
  });
});
