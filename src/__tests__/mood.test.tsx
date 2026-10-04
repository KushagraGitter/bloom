import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import MoodScreen from '@/app/mood';
import { ENTRY_KIND, SYMPTOM_KIND } from '@/lib/mood';
import { writeRecord, type LocalStore } from '@/lib/vault/localStore';
import { readyVault } from '@/lib/vault/testHelpers';
import { vaultWrapper } from '@/lib/vault/testWrapper';
import type { Vault } from '@/lib/vault/VaultProvider';

jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)) }));

jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) } }));

jest.mock('@/lib/session', () => ({
  useSession: () => ({ session: { user: { id: 'me', email: 'ananya@example.com' } }, loading: false }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

// Membership for the screen, and the household's two members for "Logged by".
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
  return { isSupabaseConfigured: true, supabase: { from: () => q } };
});

let vault: Vault;
let store: LocalStore;

async function entry(id: string, day: string, hour: number, data: Record<string, unknown>) {
  const [y, m, d] = day.split('-').map(Number);
  await writeRecord(store, {
    id,
    pregnancyId: 'p1',
    kind: ENTRY_KIND,
    data: { day, at: new Date(y, m - 1, d, hour).toISOString(), mood: 'okay', symptoms: [], note: '', by: 'me', ...data },
  });
}

async function show(seed: () => Promise<void> = async () => {}) {
  ({ vault, store } = await readyVault());
  await seed();
  return render(<MoodScreen />, { wrapper: vaultWrapper(vault) });
}

const saved = async (kind = ENTRY_KIND) => (await store.list('p1', kind)).map((r) => r.data as Record<string, unknown>);
const time = (h: number, m: number) => new Date(2026, 9, 3, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

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

describe('Mood and symptoms', () => {
  it('saves a mood with the ticked symptoms and a note, and lists it', async () => {
    await show();
    const save = await screen.findByRole('button', { name: 'Pick a mood to save' });
    expect(save).toBeDisabled();
    expect(await screen.findByText('Saved entries show here, newest first.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'Good' }));
    expect(screen.getByRole('radio', { name: 'Good', checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tired' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Back pain' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Nausea' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Nausea' }));
    expect(screen.getByRole('button', { name: 'Tired', selected: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nausea', selected: false })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Notes'), '  Worse after dinner ');
    await fireEvent.press(screen.getByRole('button', { name: 'Save today’s entry' }));

    expect(await screen.findByRole('button', { name: 'Saved. Tap to save again' })).toBeTruthy();
    expect(await saved()).toEqual([
      { day: '2026-10-03', at: new Date(2026, 9, 3, 10, 0).toISOString(), mood: 'good', symptoms: ['Back pain', 'Tired'], note: 'Worse after dinner', by: 'me' },
    ]);
    expect(screen.getByLabelText('Notes').props.value).toBe('');
    expect(await screen.findByText('Back pain · Tired')).toBeTruthy();
    expect(screen.getByText('Worse after dinner')).toBeTruthy();
    expect(screen.getByText(`Today, ${time(10, 0)}`)).toBeTruthy();

    // Mood and symptoms stay picked, so saving again later in the day is one tap.
    await fireEvent.press(screen.getByRole('button', { name: 'Saved. Tap to save again' }));
    await waitFor(async () => expect(await saved()).toHaveLength(2));
  });

  it('adds her own symptom, ticked, and ticks a listed one instead of adding it twice', async () => {
    await show();
    await screen.findByRole('radio', { name: 'Great' });
    await fireEvent.changeText(screen.getByLabelText('Other symptom'), '  itchy   skin');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('button', { name: 'Itchy skin', selected: true })).toBeTruthy();
    expect(screen.getByLabelText('Other symptom').props.value).toBe('');
    await waitFor(async () => expect(await saved(SYMPTOM_KIND)).toEqual([{ label: 'Itchy skin' }]));

    await fireEvent.changeText(screen.getByLabelText('Other symptom'), 'NAUSEA');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('button', { name: 'Nausea', selected: true })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'NAUSEA' })).toBeNull();
    expect(await saved(SYMPTOM_KIND)).toEqual([{ label: 'Itchy skin' }]);
  });

  it('shows her own symptoms from before, and takes one off the list after asking', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await show(async () => {
      await writeRecord(store, { id: 's1', pregnancyId: 'p1', kind: SYMPTOM_KIND, data: { label: 'Hiccups' } });
      await writeRecord(store, { id: 's2', pregnancyId: 'p1', kind: SYMPTOM_KIND, data: { label: 'hiccups' } });
    });
    const chip = await screen.findByRole('button', { name: 'Hiccups' });
    expect(screen.queryByRole('button', { name: 'hiccups' })).toBeNull();

    await fireEvent(screen.getByRole('button', { name: 'Tired' }), 'longPress');
    expect(alert).not.toHaveBeenCalled();
    await fireEvent(chip, 'longPress');
    expect(alert.mock.calls[0][0]).toBe('Take “Hiccups” off the list?');
    await act(async () => alert.mock.calls[0][2]?.find((b) => b.style === 'destructive')?.onPress?.());
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Hiccups' })).toBeNull());
    expect(await saved(SYMPTOM_KIND)).toEqual([]);
  });

  it('lists past entries newest first, says who logged one, and removes one after asking', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await show(async () => {
      await entry('e1', '2026-09-30', 9, { mood: 'low', symptoms: ['Headache', 'Nausea'] });
      await entry('e2', '2026-10-02', 21, { mood: 'okay', symptoms: ['Heartburn'], note: 'After dinner', by: 'kush' });
      await entry('e3', '2026-10-01', 8, { mood: 'great' });
    });

    expect(await screen.findByText('After dinner')).toBeTruthy();
    // The first three are the faces at the top.
    expect(screen.getAllByText(/^(Low|Okay|Great)$/).map((n) => n.props.children).slice(3)).toEqual(['Okay', 'Great', 'Low']);
    expect(screen.getByText('No symptoms')).toBeTruthy();
    expect(await screen.findByText('Logged by Kush')).toBeTruthy();
    expect(screen.getAllByText(/^Logged by/)).toHaveLength(1);

    const yesterday = `Yesterday, ${new Date(2026, 9, 2, 21).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
    await fireEvent.press(screen.getByRole('button', { name: `Remove the entry from ${yesterday}` }));
    expect(await saved()).toHaveLength(3);
    await act(async () => alert.mock.calls[0][2]?.find((b) => b.style === 'destructive')?.onPress?.());
    await waitFor(() => expect(screen.queryByText('After dinner')).toBeNull());
    expect((await store.list('p1', ENTRY_KIND)).map((r) => r.id).sort()).toEqual(['e1', 'e3']);
  });

  it('goes back to Today', async () => {
    await show();
    await fireEvent.press(await screen.findByRole('button', { name: 'Back to Today' }));
    expect(router.back).toHaveBeenCalled();
  });
});
