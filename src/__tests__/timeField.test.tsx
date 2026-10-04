import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Keyboard, Platform } from 'react-native';

import { TimeField } from '@/components';
import { clock } from '@/lib/appointments';

// The picker is native, so a button stands in for it: pressing it picks the
// time below, and a second button dismisses it.
const mockPick = new Date(2026, 11, 5, 14, 30);

jest.mock('@react-native-community/datetimepicker', () => {
  const { createElement } = jest.requireActual('react');
  const { Pressable, Text } = jest.requireActual('react-native');
  function Picker(props: { mode: string; display: string; value: Date; onValueChange: (e: unknown, d: Date) => void; onDismiss: () => void }) {
    return [
      createElement(
        Pressable,
        {
          key: 'pick',
          accessibilityRole: 'button',
          accessibilityLabel: `${props.mode} picker (${props.display}) at ${props.value.getHours()}:${String(props.value.getMinutes()).padStart(2, '0')}`,
          onPress: () => props.onValueChange({ nativeEvent: {} }, mockPick),
        },
        createElement(Text, null, 'picker'),
      ),
      createElement(
        Pressable,
        { key: 'dismiss', accessibilityRole: 'button', accessibilityLabel: 'dismiss picker', onPress: () => props.onDismiss() },
        createElement(Text, null, 'dismiss'),
      ),
    ];
  }
  return { __esModule: true, default: Picker };
});

function Harness({
  onChange,
  initial = '',
  ...rest
}: {
  onChange: (t: string) => void;
  initial?: string;
  label?: string;
  startAt?: string;
}) {
  const [time, setTime] = useState(initial);
  return (
    <TimeField
      {...rest}
      value={time}
      onChange={(t) => {
        setTime(t);
        onChange(t);
      }}
    />
  );
}

async function setup(props: { initial?: string; label?: string; startAt?: string } = {}) {
  const onChange = jest.fn();
  await render(<Harness onChange={onChange} {...props} />);
  return { onChange };
}

const field = (label = 'Time') => screen.getByRole('button', { name: new RegExp(`^${label}:`) });

describe('TimeField on iOS', () => {
  it('shows a time that is optional', async () => {
    await setup();
    expect(screen.getByRole('button', { name: 'Time: not set' })).toBeTruthy();
    expect(screen.getByText('Optional')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear time' })).toBeNull();
  });

  it('starts at 9:00, or wherever it is told to, so the wheels show something chosen', async () => {
    const { onChange } = await setup();
    await fireEvent.press(field());
    expect(onChange).toHaveBeenCalledWith('09:00');
    expect(screen.getByRole('button', { name: `Time: ${clock('09:00')}` })).toBeTruthy();
  });

  it('starts at the time it is given', async () => {
    const { onChange } = await setup({ startAt: '14:05' });
    await fireEvent.press(field());
    expect(onChange).toHaveBeenCalledWith('14:05');
    expect(screen.getByRole('button', { name: 'time picker (spinner) at 14:05' })).toBeTruthy();
  });

  it('follows the wheels', async () => {
    const { onChange } = await setup();
    await fireEvent.press(field());
    await fireEvent.press(screen.getByRole('button', { name: /^time picker \(spinner\)/ }));

    expect(onChange).toHaveBeenLastCalledWith('14:30');
    expect(screen.getByRole('button', { name: `Time: ${clock('14:30')}` })).toBeTruthy();
    // On the field itself it reads as the phone writes a time, not as 14:30.
    expect(screen.getByText(clock('14:30'))).toBeTruthy();
    expect(screen.queryByText('Optional')).toBeNull();
  });

  it('keeps the time it already has when opened, and shows it on the wheels', async () => {
    const { onChange } = await setup({ initial: '16:45' });
    await fireEvent.press(field());

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'time picker (spinner) at 16:45' })).toBeTruthy();
  });

  it('puts the keyboard away when it opens, so the wheels are not covered', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    await setup();
    expect(dismiss).not.toHaveBeenCalled();
    await fireEvent.press(field());
    expect(dismiss).toHaveBeenCalledTimes(1);
    dismiss.mockRestore();
  });

  it('closes the wheels when its field is tapped again', async () => {
    await setup({ initial: '16:45' });
    await fireEvent.press(field());
    expect(screen.getByRole('button', { name: /^time picker/ })).toBeTruthy();
    await fireEvent.press(field());
    expect(screen.queryByRole('button', { name: /^time picker/ })).toBeNull();
  });

  it('takes the time away again, closing the wheels', async () => {
    const { onChange } = await setup({ initial: '16:45' });
    await fireEvent.press(field());
    await fireEvent.press(screen.getByRole('button', { name: 'Clear time' }));

    expect(onChange).toHaveBeenLastCalledWith('');
    expect(screen.getByRole('button', { name: 'Time: not set' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear time' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^time picker/ })).toBeNull();
  });

  it('can be called something else', async () => {
    await setup({ label: 'Eaten at', initial: '08:00' });
    expect(screen.getByText('Eaten at')).toBeTruthy();
    expect(screen.getByRole('button', { name: `Eaten at: ${clock('08:00')}` })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear eaten at' })).toBeTruthy();
  });
});

describe('TimeField on Android', () => {
  let platform: { restore: () => void };
  beforeEach(() => {
    platform = jest.replaceProperty(Platform, 'OS', 'android');
  });
  afterEach(() => platform.restore());

  it('leaves the time unset until OK is pressed, then closes the dialog', async () => {
    const { onChange } = await setup();
    await fireEvent.press(field());

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Time: not set' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: /^time picker \(default\)/ }));
    expect(onChange).toHaveBeenCalledWith('14:30');
    expect(screen.getByRole('button', { name: `Time: ${clock('14:30')}` })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^time picker/ })).toBeNull();
  });

  it('leaves everything as it was when the dialog is dismissed', async () => {
    const { onChange } = await setup();
    await fireEvent.press(field());
    await fireEvent.press(screen.getByRole('button', { name: 'dismiss picker' }));

    expect(screen.queryByRole('button', { name: /^time picker/ })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Time: not set' })).toBeTruthy();
  });
});
