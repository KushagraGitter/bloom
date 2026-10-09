import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { BackButton, Screen, Text } from '@/components';
import { PostcardBack } from '@/components/Postcard';
import { Produce } from '@/components/Produce';
import { useLocalToday, useMembership } from '@/lib/data';
import { growthFor } from '@/lib/growth';
import { arrivalText, arrivedWeeks, arrivesOn, nextWeek, postmarkText, postcardWeek, usePostcardSeen } from '@/lib/postcards';
import { gestationalAge } from '@/lib/pregnancy';
import { makeStyles, useTheme } from '@/theme/theme';
import { produceParts } from '@/theme/produce';
import { accents, fonts } from '@/theme/tokens';

/** One postcard turned over to its note, with every postcard so far in a box underneath. */
export default function PostcardsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ week?: string }>();
  const membership = useMembership();
  const pregnancy = membership.data?.pregnancy;
  const today = useLocalToday();
  const markSeen = usePostcardSeen((s) => s.markSeen);
  const weeks = pregnancy ? gestationalAge(pregnancy.lmp_date, today).weeks : 0;
  const current = postcardWeek(weeks);
  const arrived = arrivedWeeks(weeks);
  const [picked, setWeek] = useState<number | null>(Number(params.week) || null);
  const week = picked !== null && arrived.includes(picked) ? picked : current;
  const box = useRef<ScrollView>(null);

  useEffect(() => {
    if (current !== null) markSeen(current);
  }, [current, markSeen]);

  // The root layout only shows this screen once a pregnancy exists.
  if (!pregnancy) return null;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const next = nextWeek(weeks);

  if (week === null) {
    return (
      <Screen>
        <BackButton label="Today" onPress={back} />
        <Text variant="screenTitle" accessibilityRole="header">
          Postcards
        </Text>
        <Text muted>The first postcard from your baby arrives in week 4.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <BackButton label="Today" onPress={back} />
      <View style={styles.header}>
        <Text muted style={styles.kicker}>
          POSTCARD · WEEK {week}
        </Text>
        <Text variant="screenTitle" accessibilityRole="header">
          From your {pregnancy.babies > 1 ? 'babies' : 'baby'}
        </Text>
      </View>

      <View style={styles.card}>
        <PostcardBack week={week} babies={pregnancy.babies} postmark={postmarkText(arrivesOn(pregnancy.lmp_date, week))} large />
      </View>

      <Text variant="title" accessibilityRole="header">
        Your postcard box
      </Text>
      <ScrollView
        ref={box}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.box}
        onContentSizeChange={(w) => box.current?.scrollTo({ x: w, animated: false })}>
        {arrived.map((w) => {
          const g = growthFor(w);
          const selected = w === week;
          return (
            <Pressable
              key={w}
              accessibilityRole="button"
              accessibilityLabel={`Week ${w} postcard`}
              accessibilityState={{ selected }}
              onPress={() => setWeek(w)}
              style={[styles.mini, selected && { borderColor: colors.link, borderWidth: 3 }]}>
              <Text style={styles.miniWeek}>{w}</Text>
              <Produce week={w} length={g?.shape === 'seed' ? 10 : 52} />
            </Pressable>
          );
        })}
        {next !== null && (
          <View style={styles.sealed} accessible accessibilityLabel={`Week ${next} postcard arrives ${arrivalText(arrivesOn(pregnancy.lmp_date, next))}`}>
            <Text style={styles.sealedText}>Week {next}</Text>
            <Text variant="caption">arrives {arrivalText(arrivesOn(pregnancy.lmp_date, next))}</Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, border, shadow }) => ({
  header: { gap: 2 },
  kicker: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1 },
  card: {
    borderWidth: border.width,
    borderColor: border.color,
    borderRadius: 18,
    backgroundColor: produceParts.postcard,
    boxShadow: shadow.md,
    overflow: 'hidden',
  },
  box: { gap: 12, paddingVertical: 6, paddingRight: 6 },
  mini: {
    width: 112,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: produceParts.postcard,
    boxShadow: shadow.sm,
  },
  miniWeek: { position: 'absolute', left: 8, top: 6, fontFamily: fonts.bodyHeavy, fontSize: 11, color: accents.onAccent },
  sealed: {
    width: 120,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 12,
    borderWidth: border.width,
    borderStyle: 'dashed',
    borderColor: border.color,
    backgroundColor: colors.surface,
    padding: 8,
  },
  sealedText: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: colors.ink },
}));
