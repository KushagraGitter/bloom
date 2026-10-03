import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { border, colors, fonts, shadow } from '@/theme/tokens';

export type OptionCardProps = {
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
};

/** Large radio card used for one-of-many questions in onboarding. */
export function OptionCard({ label, sub, selected, onPress }: OptionCardProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.card, selected && styles.on]}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {sub ? <Text variant="caption" style={styles.sub}>{sub}</Text> : null}
      </View>
      <View style={[styles.dot, selected && styles.dotOn]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  on: { backgroundColor: colors.yellow, boxShadow: shadow.md },
  text: { flex: 1, gap: 2 },
  label: { fontFamily: fonts.bodyHeavy, fontSize: 16 },
  sub: { fontSize: 13 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
  },
  dotOn: { backgroundColor: colors.ink, boxShadow: `inset 0px 0px 0px 4px ${colors.yellow}` },
});
