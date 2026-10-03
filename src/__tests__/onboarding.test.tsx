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

// The date picker is native, so a button stands in for it: pressing it picks a day twelve weeks ago.
jest.mock('@react-native-community/datetimepicker', () => {
  const { createElement } = jest.requireActual('react');
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: { onChange: (event: { type: string }, date: Date) => void }) =>
      createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          accessibilityLabel: 'Pick a date',
          onPress: () => props.onChange({ type: 'set' }, new Date(Date.now() - 84 * 24 * 60 * 60 * 1000)),
        },
        createElement(Text, null, 'Pick a date'),
      ),
  };
});

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

  it('only says the phone will ask about notifications while a reminder is on', async () => {
    await render(<OnboardingScreen />, { wrapper });
    await screen.findByDisplayValue('Ananya Rao');
    const next = () => fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    await next();
    await next();
    await fireEvent.press(screen.getByRole('button', { name: /^First day of last period/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Pick a date' }));
    await next();
    await fireEvent.press(screen.getByRole('radio', { name: 'Yes, first baby' }));
    await next();
    await next();
    await next();
    expect(screen.getByText('7/7')).toBeTruthy();
    expect(screen.getByText(/ask your phone for permission to send notifications/)).toBeTruthy();

    for (const reminder of ['Vitamins', 'Drink water', 'Kick counts']) {
      await fireEvent.press(screen.getByRole('switch', { name: reminder }));
    }
    // One is still on.
    expect(screen.getByText(/ask your phone for permission to send notifications/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('switch', { name: 'Appointments' }));
    expect(screen.queryByText(/ask your phone for permission/)).toBeNull();
    expect(screen.getByText('No reminders for now. You can switch them on any time in Profile.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('switch', { name: 'Drink water' }));
    expect(screen.getByText(/ask your phone for permission to send notifications/)).toBeTruthy();
  });
});
