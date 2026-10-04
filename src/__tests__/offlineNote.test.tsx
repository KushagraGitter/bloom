import { render, screen } from '@testing-library/react-native';

import { Text } from '@/components';
import { VaultGate } from '@/components/VaultGate';
import { VaultNotice } from '@/components/VaultNotice';
import { readyVault } from '@/lib/vault/testHelpers';
import { vaultWrapper } from '@/lib/vault/testWrapper';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const OFFLINE = /^Offline\. What you add is saved on this phone/;

async function vault(error: unknown) {
  const { vault: v } = await readyVault();
  return { ...v, sync: { ...v.sync, error } };
}

describe('offline note', () => {
  it('shows on vault screens while syncing fails', async () => {
    await render(<VaultNotice />, { wrapper: vaultWrapper(await vault(new Error('offline'))) });
    expect(screen.getByText(OFFLINE)).toBeTruthy();
  });

  it('shows above gated content, which stays usable', async () => {
    await render(
      <VaultGate what="meals">
        <Text>Your meals</Text>
      </VaultGate>,
      { wrapper: vaultWrapper(await vault(new Error('offline'))) },
    );
    expect(screen.getByText(OFFLINE)).toBeTruthy();
    expect(screen.getByText('Your meals')).toBeTruthy();
  });

  it('stays away while sync works', async () => {
    await render(<VaultNotice />, { wrapper: vaultWrapper(await vault(null)) });
    expect(screen.queryByText(OFFLINE)).toBeNull();
  });
});
