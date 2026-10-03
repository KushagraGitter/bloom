import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components';
import { signOut } from '@/lib/auth';
import { useMembership, useProfile } from '@/lib/data';
import { gestationalAge, localToday } from '@/lib/pregnancy';
import { border, colors, fonts } from '@/theme/tokens';

function formatDate(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TodayScreen() {
  const membership = useMembership();
  const profile = useProfile();
  const pregnancy = membership.data?.pregnancy;
  // The root layout only shows the tabs once a pregnancy exists.
  if (!pregnancy) return null;

  const ga = gestationalAge(pregnancy.lmp_date, localToday());
  const firstName = profile.data?.name?.trim().split(' ')[0];

  return (
    <Screen>
      <View style={styles.header}>
        <Text muted style={styles.date}>
          {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
        </Text>
        <Text variant="screenTitle" accessibilityRole="header">
          Hi{firstName ? `, ${firstName}` : ''}
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
            Due {formatDate(pregnancy.due_date)}
          </Text>
        </View>
      </Card>

      {__DEV__ && (
        <Link href="/dev/components" style={styles.devLink}>
          Component gallery
        </Link>
      )}

      <Button label="Sign out" onPress={() => signOut().catch(() => {})} />
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
