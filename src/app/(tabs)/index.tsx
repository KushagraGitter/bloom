import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card, Screen, Text } from '@/components';
import { addDays, dueDateFromLmp, gestationalAge, localToday } from '@/lib/pregnancy';
import { isSupabaseConfigured } from '@/lib/supabase';
import { border, colors, fonts } from '@/theme/tokens';

// Until onboarding saves a real pregnancy, show the design's example week.
const DEMO_LMP = addDays(localToday(), -(24 * 7 + 3));

export default function TodayScreen() {
  const ga = gestationalAge(DEMO_LMP, localToday());
  const due = dueDateFromLmp(DEMO_LMP);

  return (
    <Screen>
      <View style={styles.header}>
        <Text muted style={styles.date}>
          {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
        </Text>
        <Text variant="screenTitle" accessibilityRole="header">
          Hi there
        </Text>
      </View>

      <Card tone={colors.purple} size="hero" elevation="lg" style={styles.hero}>
        <View style={styles.sun} />
        <View style={styles.weekBadge}>
          <Text style={styles.weekNum}>{ga.weeks}</Text>
          <Text style={styles.weekLbl}>WEEKS</Text>
        </View>
        <Text style={styles.kicker} color={colors.surface}>
          TRIMESTER {ga.trimester} · DAY {ga.days}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(ga.progress * 100)}%` }]} />
        </View>
        <View style={styles.row}>
          <Text variant="label" color={colors.surface}>
            {Math.ceil(ga.daysToGo / 7)} weeks to go
          </Text>
          <Text variant="label" color={colors.surface}>
            Due {due}
          </Text>
        </View>
      </Card>

      {!isSupabaseConfigured && (
        <Card dashed>
          <Text variant="label">Not connected to Supabase yet. Add the keys to .env.local (see README).</Text>
        </Card>
      )}

      {__DEV__ && (
        <Link href="/dev/components" style={styles.devLink}>
          Component gallery
        </Link>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2 },
  date: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  hero: { padding: 22, gap: 14, minHeight: 170 },
  sun: {
    position: 'absolute',
    right: -36,
    top: -36,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.yellow,
    borderWidth: border.width,
    borderColor: border.color,
  },
  weekBadge: { position: 'absolute', right: 22, top: 26, alignItems: 'center' },
  weekNum: { fontFamily: fonts.display, fontSize: 44, lineHeight: 46, color: colors.ink },
  weekLbl: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1, color: colors.ink },
  kicker: { fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 1, maxWidth: 200 },
  track: {
    height: 12,
    marginTop: 40,
    borderRadius: 99,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.mint },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  devLink: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.purple, paddingVertical: 12 },
});
