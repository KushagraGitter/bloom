import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import { makeStyles, useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';

export type DateFieldProps = {
  label: string;
  /** YYYY-MM-DD, or '' when nothing is picked yet. */
  value: string;
  onChange: (value: string) => void;
};

function toDate(value: string): Date {
  if (!value) return new Date();
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function display(value: string): string {
  return toDate(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** A field that opens the platform date picker (dialog on Android, inline calendar on iOS). */
export function DateField({ label, value, onChange }: DateFieldProps) {
  const styles = useStyles();
  const { colors, scheme } = useTheme();
  const [open, setOpen] = useState(false);

  const handle = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'set' && date) onChange(toValue(date));
  };

  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? display(value) : 'not set'}`}
        onPress={() => setOpen((o) => !o)}
        style={styles.field}>
        <Text style={[styles.value, !value && styles.placeholder]}>{value ? display(value) : 'Pick a date'}</Text>
      </Pressable>
      {open && (
        <DateTimePicker
          value={toDate(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handle}
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
    borderRadius: radius.field + 2,
    borderWidth: border.width,
    borderColor: border.color,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  value: { fontFamily: fonts.body, fontSize: 17, color: colors.ink },
  placeholder: { color: colors.inkMuted },
}));
