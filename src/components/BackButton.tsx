import { Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/Text';
import { makeStyles, useTheme } from '@/theme/theme';
import { fonts, radius, touchTarget } from '@/theme/tokens';

export type BackButtonProps = {
  onPress: () => void;
  /** Where it goes ("Today"). Without it the button is just the arrow. */
  label?: string;
};

export function BackButton({ onPress, label }: BackButtonProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ? `Back to ${label}` : 'Back'}
      onPress={onPress}
      style={[styles.btn, label ? styles.withLabel : styles.arrowOnly]}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M15 6l-6 6 6 6" />
      </Svg>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, border }) => ({
  btn: {
    height: touchTarget,
    borderRadius: radius.button,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowOnly: { width: touchTarget },
  withLabel: { alignSelf: 'flex-start', flexDirection: 'row', gap: 4, paddingLeft: 8, paddingRight: 14 },
  label: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.ink },
}));
