import { render, screen } from '@testing-library/react-native';

import { Screen, Text } from '@/components';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

const scrollView = () => {
  const [found] = screen.container.queryAll((instance) => instance.type === 'RCTScrollView');
  return found;
};

describe('Screen', () => {
  it('scrolls its content', async () => {
    await render(
      <Screen>
        <Text>Hello</Text>
      </Screen>,
    );
    expect(scrollView()).toBeTruthy();
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('leaves the keyboard alone unless the page has a field of its own', async () => {
    await render(
      <Screen>
        <Text>Hello</Text>
      </Screen>,
    );
    expect(scrollView().props.automaticallyAdjustKeyboardInsets).toBeFalsy();
    expect(scrollView().props.keyboardShouldPersistTaps).toBeUndefined();
  });

  it('scrolls clear of the keyboard, and lets a button be pressed while it is up, when asked to', async () => {
    await render(
      <Screen keyboardAware>
        <Text>Hello</Text>
      </Screen>,
    );
    expect(scrollView().props.automaticallyAdjustKeyboardInsets).toBe(true);
    expect(scrollView().props.keyboardShouldPersistTaps).toBe('handled');
  });
});
