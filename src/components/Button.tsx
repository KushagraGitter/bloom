import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/Text';
import { border, colors, fonts, radius, shadow, touchTarget } from '@/theme/tokens';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: 'dark' | 'light' | 'cta';
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, variant = 'light', style, disabled, ...rest }: ButtonProps) {
  const dark = variant !== 'light';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        variant === 'cta' && styles.cta,
        { backgroundColor: dark ? colors.ink : colors.surface },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <Text style={[styles.label, { color: dark ? colors.surface : colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    minWidth: touchTarget,
    paddingHorizontal: 18,
    borderRadius: radius.button,
    borderWidth: border.width,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    minHeight: 56,
    borderRadius: 18,
    boxShadow: shadow.cta,
  },
  label: {
    fontFamily: fonts.bodyHeavy,
    fontSize: 15,
  },
  pressed: {
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
