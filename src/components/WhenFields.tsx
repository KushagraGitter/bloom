import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';

import { CrossIcon } from '@/components/icons';
import { Text } from '@/components/Text';
import { clock, dayLong, localTime } from '@/lib/appointments';
import { localToday as dayOf } from '@/lib/pregnancy';
import { border, colors, fonts, radius, touchTarget } from '@/theme/tokens';

export type WhenFieldsProps = {
  /** `YYYY-MM-DD`. */
  date: string;
  /** `HH:mm`, or '' while no time is set. */
  time: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
};

/** What the time starts at when it is first set. */
const DEFAULT_TIME = '09:00';

function dateOf(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function todayAt(time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const at = new Date();
  at.setHours(h, m, 0, 0);
  return at;
}

/**
 * The date and the optional time of an appointment, side by side as in the
 * design. A field opens the platform picker: a dialog on Android, and on iOS a
 * calendar or wheels under the row, which stay open until the field is tapped
 * again.
 */
export function WhenFields({ date, time, onDateChange, onTimeChange }: WhenFieldsProps) {
  const [open, setOpen] = useState<'date' | 'time' | null>(null);
  const android = Platform.OS === 'android';

  const toggle = (field: 'date' | 'time') => {
    Keyboard.dismiss();
    setOpen(open === field ? null : field);
    // Wheels have no "OK" button, so show the starting time as already chosen.
    // On Android the time is only set once OK is pressed.
    if (field === 'time' && open !== 'time' && !time && !android) onTimeChange(DEFAULT_TIME);
  };

  const clear = () => {
    if (open === 'time') setOpen(null);
    onTimeChange('');
  };

  const pickDate = useCallback(
    (_event: unknown, picked: Date) => {
      if (android) setOpen(null);
      onDateChange(dayOf(picked));
    },
    [android, onDateChange],
  );
  const pickTime = useCallback(
    (_event: unknown, picked: Date) => {
      if (android) setOpen(null);
      onTimeChange(localTime(picked));
    },
    [android, onTimeChange],
  );
  const dismiss = useCallback(() => setOpen(null), []);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.column}>
          <Text variant="label">Date</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Date: ${date ? dayLong(date) : 'not set'}`}
            onPress={() => toggle('date')}
            style={[styles.field, styles.dateField]}>
            <Text style={[styles.value, !date && styles.placeholder]} numberOfLines={1}>
              {date ? dayLong(date) : 'Pick a date'}
            </Text>
          </Pressable>
        </View>
        <View style={styles.column}>
          <Text variant="label">Time</Text>
          <View style={styles.field}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Time: ${time ? clock(time) : 'not set'}`}
              onPress={() => toggle('time')}
              style={styles.fieldPress}>
              <Text style={[styles.value, !time && styles.placeholder]} numberOfLines={1}>
                {time ? clock(time) : 'Optional'}
              </Text>
            </Pressable>
            {time ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear time" onPress={clear} style={styles.clear}>
                <CrossIcon size={16} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
      {open === 'date' && (
        <DateTimePicker
          value={dateOf(date || dayOf(new Date()))}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onValueChange={pickDate}
          onDismiss={dismiss}
          accentColor={colors.purple}
          themeVariant="light"
        />
      )}
      {open === 'time' && (
        <DateTimePicker
          value={todayAt(time || DEFAULT_TIME)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onValueChange={pickTime}
          onDismiss={dismiss}
          accentColor={colors.purple}
          themeVariant="light"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', gap: 10 },
  column: { flex: 1, gap: 6 },
  field: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.field + 2,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
  },
  dateField: { paddingHorizontal: 16 },
  fieldPress: { flex: 1, height: '100%', justifyContent: 'center', paddingLeft: 16 },
  value: { fontFamily: fonts.body, fontSize: 17, color: colors.ink },
  placeholder: { color: colors.inkMuted },
  // Reaches the field's full height and the 44pt minimum, though the cross itself is small.
  clear: { width: touchTarget, height: '100%', alignItems: 'center', justifyContent: 'center' },
});
