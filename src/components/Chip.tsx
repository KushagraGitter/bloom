import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { Text } from '@/components/Text';
import { border, colors, fonts, radius, shadow, touchTarget } from '@/theme/tokens';

export type ChipProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  selected: boolean;
  /**
   * `radio` for one-of-many choices (onboarding), `toggle` for multi-select
   * tags (meals, symptoms).
   */
  mode?: 'radio' | 'toggle';
  /** Fill when selected; defaults to ink with white text. */
  selectedTone?: string;
};

export function Chip({ label, selected, mode = 'radio', selectedTone, ...rest }: ChipProps) {
  const tinted = selected && selectedTone !== undefined;
  const background = selected ? (selectedTone ?? colors.ink) : colors.surface;
  const textColor = selected && !tinted ? colors.surface : colors.ink;
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

const styles = StyleSheet.create({
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
});
