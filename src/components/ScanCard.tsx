import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import { AccentZone, makeStyles } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';

export type ScanSourceButton = { label: string; onPress: () => void };

/**
 * The design's purple AI card ("Upload a report", "Snap your plate", "Scan a
 * prescription"): an icon, a title and a line, and a button for each place
 * the file can come from. Each button opens its picker straight away, as a
 * menu first and a picker after it clash on iOS.
 */
export function ScanCard({
  title,
  subtitle,
  icon,
  iconTone,
  sources,
  disabled,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  iconTone: string;
  sources: ScanSourceButton[];
  disabled: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: iconTone }]}>
          <AccentZone>{icon}</AccentZone>
        </View>
        <View style={styles.text}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
      <View style={styles.sources}>
        {sources.map((s) => (
          <Pressable
            key={s.label}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={s.onPress}
            style={({ pressed }) => [styles.source, pressed && styles.pressed]}>
            <Text style={styles.sourceText}>{s.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, border, shadow }) => ({
  card: {
    gap: 14,
    padding: 16,
    borderRadius: radius.panel,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.purple,
    boxShadow: shadow.lg,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: border.width,
    borderColor: colors.onAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.display, fontSize: 18, color: colors.onPurple },
  subtitle: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.onPurple },
  sources: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  source: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: border.width,
    borderColor: colors.onAccent,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.onAccent },
  pressed: { opacity: 0.8 },
}));
