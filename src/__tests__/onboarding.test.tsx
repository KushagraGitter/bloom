import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import OnboardingScreen from '@/app/onboarding';

jest.mock('@/lib/session', () => ({
  useSession: () => ({ session: { user: { id: 'user-1', email: 'ananya@example.com' } }, loading: false }),
}));

jest.mock('@/lib/supabase', () => {
  const profile = { id: 'user-1', name: 'Ananya Rao', avatar_url: null };
  const query = {
    select: () => query,
    eq: () => query,
    limit: () => query,
    maybeSingle: async () => ({ data: profile, error: null }),
  };
  return { isSupabaseConfigured: true, supabase: { from: () => query, rpc: jest.fn() } };
});

jest.mock('@/lib/auth', () => ({ signOut: jest.fn(async () => {}) }));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('onboarding', () => {
  it('prefills the Google name and moves through the first steps', async () => {
    await render(<OnboardingScreen />, { wrapper });

    expect(screen.getByText('Signed in as ananya@example.com')).toBeTruthy();
    expect(await screen.findByDisplayValue('Ananya Rao')).toBeTruthy();
    expect(screen.getByText('1/7')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Hi Ananya! How should we work out your due date?')).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: /IVF transfer date/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('When was your embryo transfer?')).toBeTruthy();
    expect(screen.getByText('Embryo age at transfer')).toBeTruthy();
  });

  it('will not continue without a name or a date', async () => {
    await render(<OnboardingScreen />, { wrapper });
    const name = await screen.findByDisplayValue('Ananya Rao');

    await fireEvent.changeText(name, '  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('1/7')).toBeTruthy();

    await fireEvent.changeText(name, 'Ananya');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('3/7')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('3/7')).toBeTruthy();
  });
});
