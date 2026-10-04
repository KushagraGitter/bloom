import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import ProgressScreen from '@/app/(tabs)/progress';
import { IMAGE_KIND, PHOTO_KIND } from '@/lib/bumpPhotos';
import { readingKind, tallyKind } from '@/lib/data';
import { writeRecord, type LocalStore } from '@/lib/vault/localStore';
import { readyVault } from '@/lib/vault/testHelpers';
import { vaultWrapper } from '@/lib/vault/testWrapper';
import type { Vault } from '@/lib/vault/VaultProvider';

jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)) }));

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
  launchCameraAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: 'file:///cam.jpg', width: 3024, height: 4032 }] })),
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///lib.jpg', width: 3024, height: 4032, exif: { DateTimeOriginal: '2026:09:12 18:01:44' } }],
  })),
}));

// The resize writes the target height into the "JPEG", so the test can tell the photo from its thumbnail.
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => {
      let height = 0;
      const context = {
        resize: (s: { height?: number }) => {
          height = s.height ?? 0;
          return context;
        },
        renderAsync: async () => ({
          saveAsync: async () => ({ uri: 'file:///out.jpg', width: (height * 3) / 4, height, base64: `jpeg${height}` }),
          release: () => {},
        }),
        release: () => {},
      };
      return context;
    },
  },
}));

jest.mock('@/lib/supabase', () => {
  const membership = {
    role: 'owner',
    pregnancy: { id: 'p1', owner_id: 'me', lmp_date: '2026-04-15', due_date: '2027-01-20', babies: 1, units: 'metric' },
  };
  const q = { select: () => q, eq: () => q, limit: () => q, maybeSingle: async () => ({ data: membership, error: null }) };
  return { isSupabaseConfigured: true, supabase: { from: () => q } };
});

let vault: Vault;
let store: LocalStore;
let n = 0;

/** A check-in taken at 9 am local time on `day`. */
async function checkin(type: 'weight' | 'bp' | 'sugar' | 'sleep', day: string, value: number, extra: Record<string, unknown> = {}) {
  const [y, m, d] = day.split('-').map(Number);
  await writeRecord(store, {
    id: `r${++n}`,
    pregnancyId: 'p1',
    kind: readingKind(type),
    data: { type, value_num: value, value_num2: null, value_text: null, taken_at: new Date(y, m - 1, d, 9).toISOString(), logged_by: 'me', ...extra },
  });
}

async function kicks(day: string, count: number) {
  for (let i = 0; i < count; i++) {
    await writeRecord(store, { id: `k${++n}`, pregnancyId: 'p1', kind: tallyKind('kicks', day), data: { type: 'kicks', value_num: 1 } });
  }
}

async function photo(id: string, week: number, withImage = true) {
  if (withImage) await writeRecord(store, { id: `${id}-img`, pregnancyId: 'p1', kind: IMAGE_KIND, data: { photoId: id, jpeg: `full-${id}` } });
  await writeRecord(store, {
    id,
    pregnancyId: 'p1',
    kind: PHOTO_KIND,
    data: { week, day: '2026-09-01', imageId: `${id}-img`, thumb: `thumb-${id}`, width: 960, height: 1280, by: 'me' },
  });
}

async function setUp(seed: () => Promise<void> = async () => {}) {
  ({ vault, store } = await readyVault());
  await seed();
}

const show = () => render(<ProgressScreen />, { wrapper: vaultWrapper(vault) });

const kinds = async (kind: string) => (await store.list('p1', kind)).map((r) => r.data as Record<string, unknown>);

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

describe('Progress', () => {
  it('shows the week and where she is in the journey', async () => {
    await setUp();
    await show();
    expect(await screen.findByText('Week 24 of 40')).toBeTruthy();
    expect(screen.getByLabelText('Journey: trimester 2 of 3')).toBeTruthy();
    expect(screen.getByText('2nd · you’re here')).toBeTruthy();
    expect(screen.getByTestId('journey-1')).toHaveStyle({ width: '100%' });
    expect(screen.getByTestId('journey-2')).toHaveStyle({ width: '74%' });
    expect(screen.getByTestId('journey-3')).toHaveStyle({ width: '0%' });
    // Let the rest of the screen finish loading before the test ends.
    expect(await screen.findByText('None logged this week')).toBeTruthy();
    expect(await screen.findByText(/Add a photo every few weeks/)).toBeTruthy();
  });

  it('charts weight week by week and switches to blood pressure and sugar', async () => {
    await setUp(async () => {
      await checkin('weight', '2026-09-01', 63);
      await checkin('weight', '2026-09-20', 63.6);
      await checkin('weight', '2026-09-22', 64);
      await checkin('weight', '2026-10-02', 64.2);
      await checkin('bp', '2026-10-02', 112, { value_num2: 74 });
      await checkin('sugar', '2026-10-02', 140, { value_text: 'After a meal' });
    });
    await show();

    expect(await screen.findByText('Weight (kg)')).toBeTruthy();
    expect(await screen.findByLabelText('Week 19: 63, Week 22: 63.8, Week 24: 64.2')).toBeTruthy();
    expect(screen.getByText('W22')).toBeTruthy();
    expect(screen.getByText('+1.2 kg since week 19')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Weight', checked: true })).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'Blood pressure' }));
    expect(screen.getByText('Systolic BP')).toBeTruthy();
    expect(screen.getByLabelText('Week 24: 112')).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'Sugar' }));
    expect(screen.getByText('Fasting sugar (mg/dL)')).toBeTruthy();
    expect(screen.getByText('Log a fasting blood sugar on Today and it shows here, week by week.')).toBeTruthy();
    expect(screen.queryByText('W24')).toBeNull();
  });

  it('shows the 7-day kick and sleep averages', async () => {
    await setUp(async () => {
      await kicks('2026-10-03', 10);
      await kicks('2026-10-01', 7);
      await kicks('2026-09-20', 30);
      await checkin('sleep', '2026-10-03', 7);
      await checkin('sleep', '2026-10-02', 7.25);
    });
    await show();
    expect(await screen.findByText('9 / day')).toBeTruthy();
    expect(await screen.findByText('7h 08m')).toBeTruthy();
  });

  it('says when nothing has been logged', async () => {
    await setUp();
    await show();
    expect(await screen.findByText('Log her weight on Today and it shows here, week by week.')).toBeTruthy();
    expect(await screen.findByText('None counted this week')).toBeTruthy();
    expect(screen.getByText('None logged this week')).toBeTruthy();
    expect(await screen.findByText(/Add a photo every few weeks/)).toBeTruthy();
  });

  it('adds a library photo under the week it was taken, shrunk, as two records', async () => {
    await setUp();
    await show();
    await fireEvent.press(await screen.findByRole('button', { name: 'Add a bump photo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from your photos' }));

    // Taken on 12 September: week 21.
    expect(await screen.findByText('Week 21')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'One week later' }));
    expect(screen.getByText('Week 22')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('imagebutton', { name: 'Bump photo, week 22' })).toBeTruthy();
    const [entry] = await kinds(PHOTO_KIND);
    const [image] = await kinds(IMAGE_KIND);
    expect(entry).toEqual({ week: 22, day: '2026-10-03', imageId: expect.any(String), thumb: 'jpeg360', width: 960, height: 1280, by: 'me' });
    expect(image).toEqual({ photoId: expect.any(String), jpeg: 'jpeg1280' });
    const ids = (await store.list('p1', PHOTO_KIND)).map((r) => r.id);
    expect(image.photoId).toBe(ids[0]);
    expect((await store.list('p1', IMAGE_KIND))[0].id).toBe(entry.imageId);
  });

  it('files a camera photo under this week', async () => {
    await setUp();
    await show();
    await fireEvent.press(await screen.findByRole('button', { name: 'Add a bump photo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Take a photo' }));
    expect(await screen.findByText('Week 24')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(await kinds(PHOTO_KIND)).toEqual([]);
  });

  it('explains when the camera is not allowed', async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValueOnce({ granted: false } as never);
    await setUp();
    await show();
    await fireEvent.press(await screen.findByRole('button', { name: 'Add a bump photo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Take a photo' }));
    expect(await screen.findByText('Bloom isn’t allowed to use the camera.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open Settings' })).toBeTruthy();
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('opens a photo full size and removes it, with its picture, after asking', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await setUp(async () => {
      await photo('a', 12);
      await photo('b', 24);
    });
    await show();

    const tiles = await screen.findAllByRole('imagebutton');
    expect(tiles.map((t) => t.props.accessibilityLabel)).toEqual(['Bump photo, week 12', 'Bump photo, week 24']);
    await fireEvent.press(tiles[0]);
    expect(await screen.findByLabelText('Week 12 bump photo, full size')).toBeTruthy();
    expect(screen.getByText(`Added ${new Date(2026, 8, 1).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`)).toBeTruthy();
    expect(screen.getByLabelText('Week 12 bump photo, full size').props.source).toEqual({ uri: 'data:image/jpeg;base64,full-a' });

    await fireEvent.press(screen.getByRole('button', { name: 'Remove' }));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(await kinds(PHOTO_KIND)).toHaveLength(2);
    await act(async () => alert.mock.calls[0][2]?.find((b) => b.style === 'destructive')?.onPress?.());

    await waitFor(() => expect(screen.getAllByRole('imagebutton')).toHaveLength(1));
    // The viewer closes once both phones' copies are gone.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull());
    expect((await store.list('p1', PHOTO_KIND)).map((r) => r.id)).toEqual(['b']);
    expect((await store.list('p1', IMAGE_KIND)).map((r) => r.id)).toEqual(['b-img']);
  });

  it('says when the full photo has not arrived from the other phone yet', async () => {
    await setUp(async () => {
      await photo('a', 12, false);
    });
    await show();
    await fireEvent.press(await screen.findByRole('imagebutton', { name: 'Bump photo, week 12' }));
    expect(await screen.findByText('The full photo is still on its way from the other phone.')).toBeTruthy();
    expect(screen.queryByLabelText('Week 12 bump photo, full size')).toBeNull();
  });
});
