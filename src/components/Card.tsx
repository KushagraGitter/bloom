import { View, type ViewProps } from 'react-native';

import { AccentZone, isAccentFill, makeStyles, useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

export type CardProps = ViewProps & {
  /** Fill colour; defaults to the theme's card surface. Accent fills keep light-theme content. */
  tone?: string;
  /** Hard offset shadow size. */
  elevation?: 'none' | 'md' | 'lg';
  /** Dashed outline, used for empty "+ Log" states. */
  dashed?: boolean;
  size?: 'card' | 'panel' | 'hero';
};

export function Card({ tone, elevation = 'none', dashed, size = 'card', style, children, ...rest }: CardProps) {
  const styles = useStyles();
  const { colors, shadow } = useTheme();
  const fill = tone ?? colors.surface;
  return (
    <View
      {...rest}
      style={[
        styles.base,
        { backgroundColor: fill, borderRadius: radius[size] },
        dashed && styles.dashed,
        elevation !== 'none' && { boxShadow: shadow[elevation] },
        style,
      ]}>
      {isAccentFill(fill) ? <AccentZone>{children}</AccentZone> : children}
    </View>
  );
}

const useStyles = makeStyles(({ border }) => ({
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
}));
