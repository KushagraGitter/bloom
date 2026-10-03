import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Platform } from 'react-native';

import { WhenFields } from '@/components';
import { clock, dayLong } from '@/lib/appointments';

// The pickers are native, so a button stands in for each: pressing it picks
// the value below, and a second button dismisses it.
let mockPick = { date: new Date(2026, 11, 5), time: new Date(2026, 11, 5, 14, 30) };

jest.mock('@react-native-community/datetimepicker', () => {
  const { createElement } = jest.requireActual('react');
  const { Pressable, Text } = jest.requireActual('react-native');
  function Picker(props: { mode: 'date' | 'time'; display: string; onValueChange: (e: unknown, d: Date) => void; onDismiss: () => void }) {
    return [
      createElement(
        Pressable,
        {
          key: 'pick',
          accessibilityRole: 'button',
          accessibilityLabel: `${props.mode} picker (${props.display})`,
          onPress: () => props.onValueChange({ nativeEvent: {} }, mockPick[props.mode]),
        },
        createElement(Text, null, `${props.mode} picker`),
      ),
      createElement(
        Pressable,
        { key: 'dismiss', accessibilityRole: 'button', accessibilityLabel: `dismiss ${props.mode} picker`, onPress: () => props.onDismiss() },
        createElement(Text, null, 'dismiss'),
      ),
    ];
  }
  return { __esModule: true, default: Picker };
});

function Harness({ onDate, onTime, initialTime = '' }: { onDate: (d: string) => void; onTime: (t: string) => void; initialTime?: string }) {
  const [date, setDate] = useState('2026-10-03');
  const [time, setTime] = useState(initialTime);
  return (
    <WhenFields
      date={date}
      time={time}
      onDateChange={(d) => {
        setDate(d);
        onDate(d);
      }}
      onTimeChange={(t) => {
        setTime(t);
        onTime(t);
      }}
    />
  );
}

async function setup(initialTime?: string) {
  const onDate = jest.fn();
  const onTime = jest.fn();
  await render(<Harness onDate={onDate} onTime={onTime} initialTime={initialTime} />);
  return { onDate, onTime };
}

const dateField = () => screen.getByRole('button', { name: /^Date:/ });
const timeField = () => screen.getByRole('button', { name: /^Time:/ });

describe('WhenFields on iOS', () => {
  it('shows the date, and a time that is optional', async () => {
    await setup();
    expect(screen.getByRole('button', { name: `Date: ${dayLong('2026-10-03')}` })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Time: not set' })).toBeTruthy();
    expect(screen.getByText('Optional')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear time' })).toBeNull();
  });

  it('opens a calendar for the date and keeps it open while a day is chosen', async () => {
    const { onDate } = await setup();
    await fireEvent.press(dateField());
    await fireEvent.press(screen.getByRole('button', { name: 'date picker (inline)' }));

    expect(onDate).toHaveBeenCalledWith('2026-12-05');
    expect(screen.getByRole('button', { name: `Date: ${dayLong('2026-12-05')}` })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'date picker (inline)' })).toBeTruthy();
  });

  it('starts the time at 9:00 so the wheels show something chosen, then follows them', async () => {
    const { onTime } = await setup();
    await fireEvent.press(timeField());

    expect(onTime).toHaveBeenCalledWith('09:00');
    expect(screen.getByRole('button', { name: `Time: ${clock('09:00')}` })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'time picker (spinner)' }));
    expect(onTime).toHaveBeenLastCalledWith('14:30');
    expect(screen.getByRole('button', { name: `Time: ${clock('14:30')}` })).toBeTruthy();
  });

  it('closes a picker when its field is tapped again', async () => {
    await setup();
    await fireEvent.press(dateField());
    expect(screen.getByRole('button', { name: 'date picker (inline)' })).toBeTruthy();
    await fireEvent.press(dateField());
    expect(screen.queryByRole('button', { name: 'date picker (inline)' })).toBeNull();
  });

  it('shows one picker at a time', async () => {
    await setup();
    await fireEvent.press(dateField());
    await fireEvent.press(timeField());

    expect(screen.queryByRole('button', { name: 'date picker (inline)' })).toBeNull();
    expect(screen.getByRole('button', { name: 'time picker (spinner)' })).toBeTruthy();
  });

  it('keeps the time it already has when the field is opened', async () => {
    const { onTime } = await setup('16:45');
    await fireEvent.press(timeField());

    expect(onTime).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: `Time: ${clock('16:45')}` })).toBeTruthy();
  });

  it('takes the time away again, closing its wheels', async () => {
    const { onTime } = await setup('16:45');
    await fireEvent.press(timeField());
    await fireEvent.press(screen.getByRole('button', { name: 'Clear time' }));

    expect(onTime).toHaveBeenLastCalledWith('');
    expect(screen.getByRole('button', { name: 'Time: not set' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear time' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'time picker (spinner)' })).toBeNull();
  });
});

describe('WhenFields on Android', () => {
  let platform: { restore: () => void };
  beforeEach(() => {
    platform = jest.replaceProperty(Platform, 'OS', 'android');
  });
  afterEach(() => platform.restore());

  it('opens the date dialog and closes it once a day is chosen', async () => {
    const { onDate } = await setup();
    await fireEvent.press(dateField());
    await fireEvent.press(screen.getByRole('button', { name: 'date picker (default)' }));

    expect(onDate).toHaveBeenCalledWith('2026-12-05');
    expect(screen.queryByRole('button', { name: 'date picker (default)' })).toBeNull();
  });

  it('leaves the time unset until OK is pressed', async () => {
    const { onTime } = await setup();
    await fireEvent.press(timeField());

    expect(onTime).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Time: not set' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'time picker (default)' }));
    expect(onTime).toHaveBeenCalledWith('14:30');
    expect(screen.getByRole('button', { name: `Time: ${clock('14:30')}` })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'time picker (default)' })).toBeNull();
  });

  it('leaves everything as it was when the dialog is dismissed', async () => {
    const { onDate, onTime } = await setup();
    await fireEvent.press(timeField());
    await fireEvent.press(screen.getByRole('button', { name: 'dismiss time picker' }));

    expect(screen.queryByRole('button', { name: 'time picker (default)' })).toBeNull();
    expect(onTime).not.toHaveBeenCalled();
    expect(onDate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Time: not set' })).toBeTruthy();
  });
});
