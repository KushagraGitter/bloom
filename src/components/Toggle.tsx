import { Pressable, View } from 'react-native';

import { makeStyles, useTheme } from '@/theme/theme';

export type ToggleProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  /** Spoken label; the toggle has no visible text of its own. */
  label: string;
  disabled?: boolean;
};

const TRACK_W = 56;
const KNOB = 24;
const PAD = 2;

export function Toggle({ value, onValueChange, label, disabled }: ToggleProps) {
  const styles = useStyles();
  const { colors, border } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={() => onValueChange(!value)}
      style={[styles.track, { backgroundColor: value ? colors.mint : colors.line }, disabled && styles.disabled]}>
      <View style={[styles.knob, { marginLeft: value ? TRACK_W - 2 * border.width - 2 * PAD - KNOB : 0 }]} />
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, border }) => ({
  track: {
    width: TRACK_W,
    height: 32,
    padding: PAD,
    borderRadius: 999,
    borderWidth: border.width,
    borderColor: border.color,
    flexDirection: 'row',
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.ink,
  },
  disabled: {
    opacity: 0.5,
  },
}));
