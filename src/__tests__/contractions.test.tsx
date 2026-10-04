import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';

import ContractionsScreen from '@/app/contractions';
import { CONTRACTION_KIND, PLAN_KIND, SESSION_END_KIND } from '@/lib/contractions';
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

jest.mock('@/lib/supabase', () => {
  const membership = {
    role: 'owner',
    pregnancy: { id: 'p1', owner_id: 'me', lmp_date: '2026-01-15', due_date: '2026-10-22', babies: 1, units: 'metric' },
  };
  const q = {
    select: () => q,
    eq: () => q,
    limit: () => q,
    maybeSingle: async () => ({ data: membership, error: null }),
    then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
  };
  return { isSupabaseConfigured: true, supabase: { from: () => q } };
});

const NOW = new Date(2026, 9, 4, 2, 0, 0);
const at = (secondsAfterNow: number) => new Date(NOW.getTime() + secondsAfterNow * 1000).toISOString();
const time = (secondsAfterNow: number) =>
  new Date(NOW.getTime() + secondsAfterNow * 1000).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

let vault: Vault;
let store: LocalStore;

async function contraction(id: string, start: number, length: number | null, session = 's1') {
  await writeRecord(store, {
    id,
    pregnancyId: 'p1',
    kind: CONTRACTION_KIND,
    data: { session, start: at(start), end: length === null ? null : at(start + length), by: 'me' },
  });
}

async function show(seed: () => Promise<void> = async () => {}) {
  ({ vault, store } = await readyVault());
  await seed();
  return await render(<ContractionsScreen />, { wrapper: vaultWrapper(vault) });
}

const saved = async (kind = CONTRACTION_KIND): Promise<Record<string, unknown>[]> =>
  (await store.list('p1', kind)).map((r) => ({ id: r.id, ...(r.data as object) }));

/**
 * Moves the clock on. Only the date is faked (a faked setInterval makes RNTL
 * poll on the fake clock, where queries never answer), so the screen's own
 * ticking picks the change up within half a second; tests wait for it with findBy.
 */
const wait = (seconds: number) => jest.setSystemTime(Date.now() + seconds * 1000);

/** Presses "Remove" on the next "are you sure?". */
const confirmNext = () =>
  jest.spyOn(Alert, 'alert').mockImplementationOnce((_t, _m, buttons) => buttons?.find((b) => b.style === 'destructive')?.onPress?.());

beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
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
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
    ],
  });
  jest.clearAllMocks();
});
afterEach(async () => {
  // Lets queries still announcing results finish inside act, so none lands after the test.
  await act(async () => {
    for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
  jest.useRealTimers();
});

describe('Contraction timer', () => {
  it('times contractions, saving each start and end, with lengths, gaps and averages', async () => {
    await show();
    expect(await screen.findByText('No contractions timed yet.')).toBeTruthy();
    expect(screen.getByText('READY')).toBeTruthy();
    expect(screen.getByText('0:00')).toBeTruthy();

    await fireEvent.press(await screen.findByRole('button', { name: 'Start contraction' }));
    expect(await screen.findByRole('button', { name: 'Stop contraction' })).toBeTruthy();
    expect(screen.getByText('CONTRACTION')).toBeTruthy();
    const [first] = await saved();
    expect(first).toMatchObject({ start: at(0), end: null, by: 'me' });

    wait(45);
    expect(await screen.findByText('0:45')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Stop contraction' }));
    expect(await screen.findByText('RESTING')).toBeTruthy();
    await waitFor(async () => expect(await saved()).toEqual([{ ...first, end: at(45) }]));

    // Five minutes after the first one started, the next.
    wait(255);
    expect(await screen.findByText('4:15')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Start contraction' }));
    await screen.findByRole('button', { name: 'Stop contraction' });
    wait(50);
    await fireEvent.press(screen.getByRole('button', { name: 'Stop contraction' }));
    await screen.findByRole('button', { name: 'Start contraction' });

    const list = await saved();
    expect(list).toHaveLength(2);
    expect(new Set(list.map((c) => c.session)).size).toBe(1);

    expect(await screen.findByLabelText('Avg length, 48 seconds')).toBeTruthy();
    expect(screen.getByLabelText('Avg apart, 5 minutes')).toBeTruthy();
    expect(screen.getByLabelText('Count, 2')).toBeTruthy();
    expect(screen.getByLabelText('5 minutes apart')).toBeTruthy();
    expect(screen.getByLabelText('Lasted 50 seconds')).toBeTruthy();
    expect(screen.getByLabelText('First')).toBeTruthy();
    expect(screen.getAllByText('5:00')).toHaveLength(2);
  });

  it('cancels one started by mistake', async () => {
    await show(() => contraction('a', -600, 40));
    await fireEvent.press(await screen.findByRole('button', { name: 'Start contraction' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Started by mistake? Cancel it' }));
    expect(await screen.findByRole('button', { name: 'Start contraction' })).toBeTruthy();
    await waitFor(async () => expect((await saved()).map((c) => c.id)).toEqual(['a']));
    expect(screen.getByLabelText('Count, 1')).toBeTruthy();
  });

  it('carries on a contraction started on the other phone', async () => {
    await show(() => contraction('a', -30, null));
    expect(await screen.findByRole('button', { name: 'Stop contraction' })).toBeTruthy();
    expect(await screen.findByText('0:30')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Stop contraction' }));
    await waitFor(async () => expect(await saved()).toMatchObject([{ id: 'a', end: at(0) }]));
  });

  it('removes one contraction after asking', async () => {
    await show(async () => {
      await contraction('a', -900, 40);
      await contraction('b', -600, 50);
    });
    confirmNext();
    await fireEvent.press(await screen.findByRole('button', { name: `Remove the contraction at ${time(-600)}` }));
    await waitFor(async () => expect((await saved()).map((c) => c.id)).toEqual(['a']));
    expect(await screen.findByLabelText('Count, 1')).toBeTruthy();
  });

  it('ends a session, keeping it under earlier sessions, and removes an earlier one after asking', async () => {
    await show(async () => {
      await contraction('a', -900, 40);
      await contraction('b', -600, 60);
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'End session' }));
    expect(await screen.findByText('No contractions timed yet.')).toBeTruthy();
    expect(await saved(SESSION_END_KIND)).toMatchObject([{ id: 's1' }]);
    expect(screen.getByText('Earlier sessions')).toBeTruthy();
    expect(screen.getByText('2 contractions · avg 0:50 long · 5:00 apart')).toBeTruthy();

    // The next tap starts a fresh session.
    await fireEvent.press(screen.getByRole('button', { name: 'Start contraction' }));
    await screen.findByRole('button', { name: 'Stop contraction' });
    const fresh = (await saved()).find((c) => c.id !== 'a' && c.id !== 'b');
    expect(fresh?.session).not.toBe('s1');

    confirmNext();
    await fireEvent.press(screen.getByRole('button', { name: /^Remove the session from / }));
    await waitFor(async () => expect((await saved()).map((c) => c.id)).toEqual([expect.not.stringMatching(/^(a|b)$/)]));
    expect(await saved(SESSION_END_KIND)).toEqual([]);
    await waitFor(() => expect(screen.queryByText('Earlier sessions')).toBeNull());
  });

  it('starts a new session after a long quiet spell', async () => {
    await show(() => contraction('old', -3 * 3600, 40, 'yesterday'));
    expect(await screen.findByText('No contractions timed yet.')).toBeTruthy();
    expect(screen.getByText('READY')).toBeTruthy();
    expect(screen.getByText('Earlier sessions')).toBeTruthy();
  });

  it('keeps her own notes on when to call, and rings the number', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await show();
    expect(await screen.findByText(/^Add what your doctor or midwife told you/)).toBeTruthy();
    await fireEvent.press(await screen.findByRole('button', { name: 'Add when to call' }));

    await fireEvent.changeText(screen.getByLabelText('What your doctor or midwife said'), ' Call when 5 min apart for an hour ');
    await fireEvent.changeText(screen.getByLabelText('Hospital or birth centre'), 'City Hospital');
    await fireEvent.changeText(screen.getByLabelText('Phone'), '020 7946 0000');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Call when 5 min apart for an hour')).toBeTruthy();
    const plans = await saved(PLAN_KIND);
    expect(plans).toEqual([{ id: expect.any(String), advice: 'Call when 5 min apart for an hour', place: 'City Hospital', phone: '020 7946 0000' }]);

    await fireEvent.press(screen.getByRole('link', { name: 'Call City Hospital · 020 7946 0000' }));
    expect(open).toHaveBeenCalledWith('tel:02079460000');

    // Editing opens with what is saved and writes over the same record.
    await fireEvent.press(screen.getByRole('button', { name: 'Edit when to call' }));
    expect(screen.getByLabelText('Hospital or birth centre').props.value).toBe('City Hospital');
    await fireEvent.changeText(screen.getByLabelText('Hospital or birth centre'), 'Birth centre');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Birth centre · 020 7946 0000')).toBeTruthy();
    expect((await saved(PLAN_KIND)).map((p) => p.id)).toEqual([plans[0].id]);
  });

  it('cannot start without the household key', async () => {
    ({ vault, store } = await readyVault());
    await render(<ContractionsScreen />, { wrapper: vaultWrapper({ ...vault, state: 'needs-key', store: null } as unknown as Vault) });
    const button = await screen.findByRole('button', { name: 'Start contraction' });
    expect(button).toBeDisabled();
    expect(screen.getByText('This phone needs the household key')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add when to call' })).toBeNull();
  });
});
