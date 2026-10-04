import { Pressable, type PressableProps } from 'react-native';

import { Text } from '@/components/Text';
import { makeStyles, useTheme } from '@/theme/theme';
import { fonts, radius, touchTarget } from '@/theme/tokens';

export type ChipProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  selected: boolean;
  /**
   * `radio` for one-of-many choices (onboarding), `toggle` for multi-select
   * tags (meals, symptoms).
   */
  mode?: 'radio' | 'toggle';
  /** Accent fill when selected (with dark ink text); defaults to ink with surface text. */
  selectedTone?: string;
};

export function Chip({ label, selected, mode = 'radio', selectedTone, ...rest }: ChipProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const tinted = selected && selectedTone !== undefined;
  const background = selected ? (selectedTone ?? colors.ink) : colors.surface;
  const textColor = tinted ? colors.onAccent : selected ? colors.surface : colors.ink;
  return (
    <Pressable
      accessibilityRole={mode === 'radio' ? 'radio' : 'button'}
      accessibilityState={mode === 'radio' ? { checked: selected } : { selected }}
      {...rest}
      style={[styles.base, { backgroundColor: background }, tinted && styles.tinted]}>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(({ border, shadow }) => ({
  base: {
    minHeight: touchTarget,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: border.width,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tinted: {
    boxShadow: shadow.sm,
  },
  label: {
    fontFamily: fonts.bodyHeavy,
    fontSize: 15,
  },
}));
