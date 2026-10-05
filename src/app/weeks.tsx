import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { BackButton, Card, ChevronIcon, Screen, Text } from '@/components';
import { useLocalToday, useMembership } from '@/lib/data';
import { gestationalAge } from '@/lib/pregnancy';
import { useSavedThoughts, useSeenCards } from '@/lib/useWeeklyCards';
import { CARD_META, CARD_WEEKS, cardsFor, deckWeek, unseenCount } from '@/lib/weeklyCards';
import { makeStyles } from '@/theme/theme';
import { accents, fonts } from '@/theme/tokens';

/** Every week's deck so far, newest first, a peek at next week's baby card, and the saved thoughts. */
export default function WeeksScreen() {
  const styles = useStyles();
  const membership = useMembership();
  const pregnancy = membership.data?.pregnancy;
  const today = useLocalToday();
  const seen = useSeenCards(pregnancy?.id);
  const saved = useSavedThoughts(pregnancy?.id);

  // The root layout only shows this screen once a pregnancy exists.
  if (!pregnancy) return null;

  const current = deckWeek(gestationalAge(pregnancy.lmp_date, today).weeks);
  const open = current === null ? [] : CARD_WEEKS.filter((w) => w <= current).reverse();
  const next = current === null ? CARD_WEEKS[0] : CARD_WEEKS.find((w) => w > current);
  const nextCards = next !== undefined ? cardsFor(next) : null;
  const thoughts = (saved.data ?? []).flatMap((t) => {
    const cards = cardsFor(t.week);
    return cards ? [{ week: t.week, ...cards.thought }] : [];
  });

  return (
    <Screen>
      <BackButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <Text variant="screenTitle" accessibilityRole="header">
        Weekly cards
      </Text>

      {nextCards && next !== undefined && (
        <Card tone={CARD_META.baby.tone} style={styles.peek}>
          <Text style={styles.overline}>NEXT WEEK · WEEK {next}</Text>
          <Text style={styles.peekText}>{nextCards.baby.front}</Text>
          <Text style={styles.peekSub}>The rest of the cards open when the week starts.</Text>
        </Card>
      )}

      {open.length === 0 ? (
        <Text muted>The first cards open in week 4.</Text>
      ) : (
        <View style={styles.list}>
          {open.map((week) => {
            const fresh = seen.data ? unseenCount(seen.data.get(week)) : null;
            const status = fresh === null ? '' : fresh === 0 ? 'All seen' : `${fresh} new`;
            return (
              <Pressable
                key={week}
                accessibilityRole="button"
                accessibilityLabel={`Week ${week}${status ? `, ${status}` : ''}`}
                onPress={() => router.push(`/week/${week}`)}
                style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>
                    Week {week}
                    {week === current ? ' · this week' : ''}
                  </Text>
                  <Text variant="caption" numberOfLines={1}>
                    {cardsFor(week)?.baby.front}
                  </Text>
                </View>
                {status ? <Text variant="caption">{status}</Text> : null}
                <ChevronIcon direction="right" />
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.section}>
        <Text variant="title" accessibilityRole="header">
          Saved thoughts
        </Text>
        {thoughts.length === 0 ? (
          <Text muted>Save a kind thought from any week and it will wait for you here.</Text>
        ) : (
          thoughts.map((t) => (
            <Pressable key={t.week} accessibilityRole="button" onPress={() => router.push(`/week/${t.week}`)}>
              <Card tone={CARD_META.thought.tone} style={styles.thought}>
                <Text style={styles.overline}>WEEK {t.week}</Text>
                <Text style={styles.thoughtFront}>{t.front}</Text>
                <Text style={styles.thoughtBack}>{t.back}</Text>
              </Card>
            </Pressable>
          ))
        )}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, border }) => ({
  peek: { gap: 6 },
  overline: { fontFamily: fonts.bodyHeavy, fontSize: 12, letterSpacing: 1, color: accents.onAccent },
  peekText: { fontFamily: fonts.displayBold, fontSize: 20, lineHeight: 24, color: accents.onAccent },
  peekSub: { fontFamily: fonts.bodyMedium, fontSize: 13, color: accents.onAccentMuted },
  list: {
    borderWidth: border.width,
    borderColor: border.color,
    borderRadius: 22,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.ink },
  section: { gap: 10 },
  thought: { gap: 6 },
  thoughtFront: { fontFamily: fonts.displayBold, fontSize: 18, lineHeight: 22, color: accents.onAccent },
  thoughtBack: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: accents.onAccent },
}));
