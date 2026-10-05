import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import WeekDeckScreen from '@/app/week/[week]';
import WeeksScreen from '@/app/weeks';
import { WEEKLY_CARDS } from '@/content/weeklyCards';
import { savedId, seenId } from '@/lib/useWeeklyCards';
import type { LocalStore } from '@/lib/vault/localStore';
import { readyVault } from '@/lib/vault/testHelpers';
import { vaultWrapper } from '@/lib/vault/testWrapper';
import type { Vault } from '@/lib/vault/VaultProvider';
import { SAVED_KIND } from '@/lib/weeklyCards';

jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)) }));

let mockParams: { week: string } = { week: '24' };
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/lib/session', () => ({
  useSession: () => ({ session: { user: { id: 'me', email: 'ananya@example.com' } }, loading: false }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

// Twenty-four weeks along on 3 October 2026.
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

async function show(ui: React.ReactElement, week = '24') {
  mockParams = { week };
  ({ vault, store } = await readyVault());
  return render(ui, { wrapper: vaultWrapper(vault) });
}

const seenNow = async (week = 24) => ((await store.get(seenId('p1', 'me', week)))?.data as { seen: string[] } | undefined)?.seen;

/** Lets the vault writes and the queries they refresh finish. */
const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });

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
afterEach(settle);

const week24 = WEEKLY_CARDS[24];

describe('A week’s deck', () => {
  it('shows the first card, turns it over with the size line, and marks it seen', async () => {
    await show(<WeekDeckScreen />);
    const card = await screen.findByRole('button', { name: `Baby this week. ${week24.baby.front}` });
    expect(screen.getByText('THIS WEEK')).toBeTruthy();
    await fireEvent.press(card);
    expect(
      screen.getByRole('button', { name: `Baby this week. Baby is about the size of an ear of corn. ${week24.baby.back}` }),
    ).toBeTruthy();
    await settle();
    expect(await seenNow()).toEqual(['baby']);
  });

  it('names the partner card and keeps every card passed when stepping through quickly', async () => {
    await show(<WeekDeckScreen />);
    expect(await screen.findByRole('button', { name: `For Kush. ${week24.partner.front}` })).toBeTruthy();
    const next = screen.getByRole('button', { name: 'Next card' });
    await fireEvent.press(next);
    await fireEvent.press(next);
    await settle();
    expect(await seenNow()).toEqual(['baby', 'body', 'try']);
    expect(screen.getByLabelText('Card 3 of 5')).toBeTruthy();
  });

  it('saves the kind thought for the household, and takes it off again', async () => {
    await show(<WeekDeckScreen />);
    const next = await screen.findByRole('button', { name: 'Next card' });
    for (let i = 0; i < 4; i++) await fireEvent.press(next);
    expect(screen.getByRole('button', { name: 'Next card' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Save this thought' }));
    expect(await screen.findByRole('button', { name: 'Saved to your thoughts' })).toBeTruthy();
    expect((await store.get(savedId('p1', 24)))?.data).toEqual({ week: 24, savedAt: new Date(2026, 9, 3, 10, 0).toISOString() });

    await fireEvent.press(screen.getByRole('button', { name: 'Saved to your thoughts' }));
    expect(await screen.findByRole('button', { name: 'Save this thought' })).toBeTruthy();
    expect(await store.list('p1', SAVED_KIND)).toEqual([]);
  });

  it('keeps a future week closed and marks nothing', async () => {
    await show(<WeekDeckScreen />, '30');
    expect(await screen.findByText('These cards open in week 30.')).toBeTruthy();
    await settle();
    expect(await seenNow(30)).toBeUndefined();
  });

  it('says which weeks have cards when the week is not one of them', async () => {
    await show(<WeekDeckScreen />, 'soon');
    expect(await screen.findByText('There are cards for weeks 4 to 41.')).toBeTruthy();
  });
});

describe('All weeks', () => {
  it('lists the weeks so far, newest first, with a peek at next week and the saved thoughts', async () => {
    await show(<WeeksScreen />);
    // The rows show before the seen cards load, so wait for this week's status.
    expect(await screen.findByRole('button', { name: 'Week 24, 5 new' })).toBeTruthy();
    const rows = screen.getAllByRole('button', { name: /^Week \d+/ });
    expect(rows[0].props.accessibilityLabel).toBe('Week 24, 5 new');
    expect(rows).toHaveLength(21);
    expect(screen.getByText('NEXT WEEK · WEEK 25')).toBeTruthy();
    expect(screen.getByText(WEEKLY_CARDS[25].baby.front)).toBeTruthy();
    expect(screen.queryByText(WEEKLY_CARDS[25].body.front)).toBeNull();
    expect(screen.getByText('Save a kind thought from any week and it will wait for you here.')).toBeTruthy();

    await fireEvent.press(rows[3]);
    expect(router.push).toHaveBeenCalledWith('/week/21');
  });
});
