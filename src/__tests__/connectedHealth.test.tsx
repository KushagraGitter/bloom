import { fireEvent, render, screen } from '@testing-library/react-native';

import ConnectedHealthScreen from '@/app/connected-health';
import { useHealthSettings } from '@/lib/health/settings';
import { healthSource } from '@/lib/health/source';
import type { HealthSource } from '@/lib/health/source.types';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true } }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => void mockStore.set(k, v)),
  deleteItemAsync: jest.fn(async (k: string) => void mockStore.delete(k)),
}));
jest.mock('@/lib/health/source', () => ({
  healthSource: {
    name: 'Apple Health',
    asksForHistory: false,
    status: jest.fn(),
    request: jest.fn(),
    granted: jest.fn(),
    countSince: jest.fn(),
  },
}));

const source = healthSource as jest.Mocked<HealthSource>;

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  useHealthSettings.setState({ metrics: null });
  source.name = 'Apple Health';
  source.asksForHistory = false;
  delete source.openSettings;
  delete source.hasHistory;
  source.status.mockResolvedValue('ready');
  source.request.mockResolvedValue(null);
  source.granted.mockResolvedValue(null);
  source.countSince.mockResolvedValue(0);
});

const sleepSwitch = () => screen.getByRole('switch', { name: 'Sleep' });

describe('connected health', () => {
  it('explains that Expo Go cannot read health data', async () => {
    source.status.mockResolvedValue('needs-build');
    await render(<ConnectedHealthScreen />);
    expect(await screen.findByText(/needs the installed Bloom app/)).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('asks the phone before switching a metric on, and remembers it', async () => {
    await render(<ConnectedHealthScreen />);
    await fireEvent.press(await screen.findByRole('switch', { name: 'Sleep' }));

    expect(source.request).toHaveBeenCalledWith(['sleep']);
    expect(sleepSwitch().props.accessibilityState.checked).toBe(true);
    expect(JSON.parse(mockStore.get('bloom.health')!)).toEqual(['sleep']);

    await fireEvent.press(sleepSwitch());
    expect(sleepSwitch().props.accessibilityState.checked).toBe(false);
    expect(source.request).toHaveBeenCalledTimes(1);
  });

  it('leaves a metric off when Health Connect says no', async () => {
    source.name = 'Health Connect';
    source.granted.mockResolvedValue([]);
    source.request.mockResolvedValue([]);
    source.openSettings = jest.fn();
    await render(<ConnectedHealthScreen />);
    await fireEvent.press(await screen.findByRole('switch', { name: 'Sleep' }));

    expect(sleepSwitch().props.accessibilityState.checked).toBe(false);
    expect(screen.getByText(/didn’t allow that/)).toBeTruthy();
    expect(mockStore.has('bloom.health')).toBe(false);
  });

  it('shows a metric as off once Health Connect takes access away', async () => {
    mockStore.set('bloom.health', JSON.stringify(['sleep', 'steps']));
    source.granted.mockResolvedValue(['steps']);
    await render(<ConnectedHealthScreen />);
    expect((await screen.findByRole('switch', { name: 'Steps' })).props.accessibilityState.checked).toBe(true);
    expect(sleepSwitch().props.accessibilityState.checked).toBe(false);
  });

  it('counts the last week for the metrics that are on', async () => {
    mockStore.set('bloom.health', JSON.stringify(['sleep', 'steps']));
    source.countSince.mockImplementation(async (m) => (m === 'sleep' ? 6 : 0));
    await render(<ConnectedHealthScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Check now' }));

    expect(await screen.findByText('Sleep: 6 entries')).toBeTruthy();
    expect(screen.getByText('Steps: nothing yet')).toBeTruthy();
    expect(screen.getByText(/shares it with Apple Health/)).toBeTruthy();
  });

  it('stops reading on this phone', async () => {
    mockStore.set('bloom.health', JSON.stringify(['sleep']));
    await render(<ConnectedHealthScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Stop reading on this phone' }));
    expect(sleepSwitch().props.accessibilityState.checked).toBe(false);
    expect(mockStore.has('bloom.health')).toBe(false);
  });
});
