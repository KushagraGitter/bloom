import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback, useState } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';

import { CrossIcon } from '@/components/icons';
import { Text } from '@/components/Text';
import { clock, localTime } from '@/lib/appointments';
import { makeStyles, useTheme } from '@/theme/theme';
import { fonts, radius, touchTarget } from '@/theme/tokens';

export type TimeFieldProps = {
  label?: string;
  /** `HH:mm`, or '' while no time is set. */
  value: string;
  onChange: (time: string) => void;
  /** What the time starts at when it is first set, as `HH:mm`. */
  startAt?: string;
};

function todayAt(time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const at = new Date();
  at.setHours(h, m, 0, 0);
  return at;
}

/**
 * An optional time, as beside an appointment's date. The field opens the
 * platform's picker: a dialog on Android, and on iOS wheels under the field,
 * which stay open until the field is tapped again.
 */
export function TimeField({ label = 'Time', value, onChange, startAt = '09:00' }: TimeFieldProps) {
  const styles = useStyles();
  const { colors, scheme } = useTheme();
  const [open, setOpen] = useState(false);
  const android = Platform.OS === 'android';

  const toggle = () => {
    Keyboard.dismiss();
    setOpen(!open);
    // Wheels have no "OK" button, so show the starting time as already chosen.
    // On Android the time is only set once OK is pressed.
    if (!open && !value && !android) onChange(startAt);
  };

  const clear = () => {
    setOpen(false);
    onChange('');
  };

  const pick = useCallback(
    (_event: unknown, picked: Date) => {
      if (android) setOpen(false);
      onChange(localTime(picked));
    },
    [android, onChange],
  );
  const dismiss = useCallback(() => setOpen(false), []);

  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <View style={styles.field}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value ? clock(value) : 'not set'}`}
          onPress={toggle}
          style={styles.press}>
          <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
            {value ? clock(value) : 'Optional'}
          </Text>
        </Pressable>
        {value ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${label.toLowerCase()}`} onPress={clear} style={styles.clear}>
            <CrossIcon size={16} />
          </Pressable>
        ) : null}
      </View>
      {open && (
        <DateTimePicker
          value={todayAt(value || startAt)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onValueChange={pick}
          onDismiss={dismiss}
          accentColor={colors.link}
          themeVariant={scheme}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors, border }) => ({
  wrap: { gap: 6 },
  field: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.field + 2,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
  },
  press: { flex: 1, height: '100%', justifyContent: 'center', paddingLeft: 16 },
  value: { fontFamily: fonts.body, fontSize: 17, color: colors.ink },
  placeholder: { color: colors.inkMuted },
  // Reaches the field's full height and the 44pt minimum, though the cross itself is small.
  clear: { width: touchTarget, height: '100%', alignItems: 'center', justifyContent: 'center' },
}));
