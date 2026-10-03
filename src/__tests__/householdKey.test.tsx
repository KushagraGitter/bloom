import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import HouseholdKeyScreen from '@/app/household-key';
import { newHouseholdKey } from '@/lib/vault/crypto';
import { QR_PREFIX } from '@/lib/vault/householdKey';
import { toRecoveryPhrase } from '@/lib/vault/keys';
import { useVault, type Vault } from '@/lib/vault/VaultProvider';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true } }));
jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/vault/VaultProvider', () => ({ useVault: jest.fn() }));

// The camera is native: a button stands in for it and "scans" mockScanned.
let mockScanned = '';
let mockPermission: { granted: boolean; canAskAgain: boolean } | null = { granted: true, canAskAgain: true };
const mockRequestPermission = jest.fn();
jest.mock('expo-camera', () => {
  const { createElement } = jest.requireActual('react');
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    useCameraPermissions: () => [mockPermission, mockRequestPermission],
    CameraView: (props: { onBarcodeScanned: (r: { data: string }) => void }) =>
      createElement(
        Pressable,
        { accessibilityRole: 'button', accessibilityLabel: 'camera', onPress: () => props.onBarcodeScanned({ data: mockScanned }) },
        createElement(Text, null, 'camera'),
      ),
  };
});

function vault(over: Partial<Vault>): Vault {
  return { state: 'ready', role: 'owner', householdKey: null, store: null, sync: null, adoptKey: jest.fn(async () => true), retry: jest.fn(), ...over };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPermission = { granted: true, canAskAgain: true };
});

describe('household key screen, on a phone that has the key', () => {
  it('keeps the QR code and the phrase hidden until asked for', async () => {
    const key = newHouseholdKey();
    jest.mocked(useVault).mockReturnValue(vault({ householdKey: key }));
    await render(<HouseholdKeyScreen />);

    expect(screen.queryByLabelText('Household key QR code')).toBeNull();
    expect(screen.queryByText(toRecoveryPhrase(key).replace(/-/g, ' '))).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Show QR code' }));
    expect(screen.getByLabelText('Household key QR code')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Show recovery phrase' }));
    expect(screen.getByText(toRecoveryPhrase(key).replace(/-/g, ' '))).toBeTruthy();
    expect(screen.queryByLabelText('Household key QR code')).toBeNull();
  });
});

describe('household key screen, on a phone that needs the key', () => {
  it('takes the key from her phone’s QR code', async () => {
    const key = newHouseholdKey();
    const adoptKey = jest.fn(async () => true);
    jest.mocked(useVault).mockReturnValue(vault({ state: 'needs-key', role: 'partner', adoptKey }));
    await render(<HouseholdKeyScreen />);
    expect(screen.getByText(/Get it from her phone/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Scan the QR code' }));
    mockScanned = QR_PREFIX + toRecoveryPhrase(key);
    await fireEvent.press(screen.getByRole('button', { name: 'camera' }));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const [adopted] = adoptKey.mock.calls[0] as unknown as [typeof key];
    expect(Array.from(adopted.bytes)).toEqual(Array.from(key.bytes));
  });

  it('ignores QR codes that are not a Bloom key', async () => {
    const adoptKey = jest.fn(async () => true);
    jest.mocked(useVault).mockReturnValue(vault({ state: 'needs-key', role: 'partner', adoptKey }));
    await render(<HouseholdKeyScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Scan the QR code' }));
    mockScanned = 'https://example.com';
    await fireEvent.press(screen.getByRole('button', { name: 'camera' }));
    expect(screen.getByRole('alert')).toHaveTextContent("That isn't a Bloom household code.");
    expect(adoptKey).not.toHaveBeenCalled();
  });

  it('asks for the camera first', async () => {
    mockPermission = { granted: false, canAskAgain: true };
    jest.mocked(useVault).mockReturnValue(vault({ state: 'needs-key', role: 'partner' }));
    await render(<HouseholdKeyScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Scan the QR code' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Allow camera' }));
    expect(mockRequestPermission).toHaveBeenCalled();
  });

  it('takes a typed recovery phrase, and says when it has a typo or belongs elsewhere', async () => {
    const key = newHouseholdKey();
    const adoptKey = jest.fn(async () => false);
    jest.mocked(useVault).mockReturnValue(vault({ state: 'needs-key', role: 'owner', adoptKey }));
    await render(<HouseholdKeyScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Type the recovery phrase' }));
    await fireEvent.changeText(screen.getByLabelText('Recovery phrase'), 'K1 nonsense');
    await fireEvent.press(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/isn't right/));
    expect(adoptKey).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Recovery phrase'), toRecoveryPhrase(key).toLowerCase());
    await fireEvent.press(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/different household/));
    expect(adoptKey).toHaveBeenCalledTimes(1);
    expect(router.back).not.toHaveBeenCalled();
  });
});

it('offers a retry when the check failed', async () => {
  const retry = jest.fn();
  jest.mocked(useVault).mockReturnValue(vault({ state: 'error', retry }));
  await render(<HouseholdKeyScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalled();
});
