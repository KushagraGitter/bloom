import { fireEvent, render, screen } from '@testing-library/react-native';

import UnlockScreen from '@/app/unlock';
import { readyVault } from '@/lib/vault/testHelpers';
import { vaultWrapper } from '@/lib/vault/testWrapper';
import type { Vault } from '@/lib/vault/VaultProvider';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn() } }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/auth', () => ({ signOut: jest.fn(async () => {}) }));
jest.mock('expo-camera', () => ({ CameraView: () => null, useCameraPermissions: () => [null, jest.fn()] }));

async function vaultIn(state: Vault['state'], role: 'owner' | 'partner' = 'partner') {
  const { vault, syncs } = await readyVault(role);
  return { vault: { ...vault, state, sync: state === 'ready' ? vault.sync : null } as Vault, syncs };
}

describe('unlock screen', () => {
  it('asks a phone without the key for it', async () => {
    const { vault } = await vaultIn('needs-key');
    await render(<UnlockScreen />, { wrapper: vaultWrapper(vault) });
    expect(screen.getByText('Open Bloom on this phone')).toBeTruthy();
    expect(screen.getByText(/Get it from her phone/)).toBeTruthy();
    expect(screen.getByText('Scan the QR code')).toBeTruthy();
    expect(screen.getByText('Type the recovery phrase')).toBeTruthy();
  });

  it('asks for a sync when the key is here but the details are not yet', async () => {
    const { vault, syncs } = await vaultIn('ready');
    await render(<UnlockScreen />, { wrapper: vaultWrapper(vault) });
    expect(screen.getByText(/Getting your details/)).toBeTruthy();
    expect(syncs).toHaveLength(1);
    await fireEvent.press(screen.getByText('Try again'));
    expect(syncs).toHaveLength(2);
  });

  it('offers a retry when the check failed, and a way to sign out', async () => {
    const { vault } = await vaultIn('error');
    const retry = jest.fn();
    await render(<UnlockScreen />, { wrapper: vaultWrapper({ ...vault, retry }) });
    await fireEvent.press(screen.getByText('Try again'));
    expect(retry).toHaveBeenCalled();
    expect(screen.getByText('Sign out')).toBeTruthy();
  });
});
