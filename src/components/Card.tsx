import { StyleSheet, View, type ViewProps } from 'react-native';

import { border, colors, radius, shadow, space } from '@/theme/tokens';

export type CardProps = ViewProps & {
  /** Fill colour; defaults to white. */
  tone?: string;
  /** Hard offset shadow size. */
  elevation?: 'none' | 'md' | 'lg';
  /** Dashed outline, used for empty "+ Log" states. */
  dashed?: boolean;
  size?: 'card' | 'panel' | 'hero';
};

export function Card({
  tone = colors.surface,
  elevation = 'none',
  dashed,
  size = 'card',
  style,
  ...rest
}: CardProps) {
  return (
    <View
      {...rest}
      style={[
        styles.base,
        { backgroundColor: tone, borderRadius: radius[size] },
        dashed && styles.dashed,
        elevation !== 'none' && { boxShadow: shadow[elevation] },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: border.width,
    borderColor: border.color,
    padding: space.md + 2,
    gap: space.sm,
    overflow: 'hidden',
  },
  dashed: {
    borderStyle: 'dashed',
  },
});
