import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';

import { colors, fonts, fontSize } from '@/theme/tokens';

type Variant = 'screenTitle' | 'title' | 'stat' | 'body' | 'label' | 'caption';

export type TextProps = RNTextProps & {
  variant?: Variant;
  muted?: boolean;
  color?: string;
};

export function Text({ variant = 'body', muted, color, style, ...rest }: TextProps) {
  return (
    <RNText
      {...rest}
      style={[
        styles[variant],
        muted && styles.muted,
        color !== undefined && { color },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.screenTitle,
    letterSpacing: -0.64,
    color: colors.ink,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.title,
    color: colors.ink,
  },
  stat: {
    fontFamily: fonts.display,
    fontSize: fontSize.stat,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: colors.ink,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.small,
    color: colors.ink,
  },
  caption: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.caption,
    color: colors.inkMuted,
  },
  muted: {
    color: colors.inkMuted,
  },
});
