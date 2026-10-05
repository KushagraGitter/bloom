import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  FlatList,
  Pressable,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { BackButton, Button, Card, ChevronIcon, Screen, Text } from '@/components';
import { useLocalToday, useMembers, useMembership } from '@/lib/data';
import { gestationalAge } from '@/lib/pregnancy';
import { babySizeLine } from '@/lib/readings';
import { useMarkSeen, useSaveThought, useSavedThoughts } from '@/lib/useWeeklyCards';
import { useVault } from '@/lib/vault/VaultProvider';
import { CARD_META, cardLabel, cardsFor, deckOrder, deckWeek, type CardKind } from '@/lib/weeklyCards';
import { makeStyles, useTheme } from '@/theme/theme';
import { accents, fonts, space } from '@/theme/tokens';

const CARD_HEIGHT = 420;
/** A soft drop under the hard offset shadow, so the card lifts off the page in both themes. */
const SOFT_SHADOW = '0px 10px 24px rgba(0, 0, 0, 0.22)';
const FLIP_MS = 320;

export default function WeekDeckScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ week: string }>();
  const week = Number(params.week);
  const membership = useMembership();
  const pregnancy = membership.data?.pregnancy;
  const pregnancyId = pregnancy?.id;
  const role = membership.data?.role ?? 'owner';
  const members = useMembers(pregnancyId);
  const today = useLocalToday();
  const vault = useVault();
  const markSeen = useMarkSeen(pregnancyId);
  const saved = useSavedThoughts(pregnancyId);
  const saveThought = useSaveThought(pregnancyId);
  const { width } = useWindowDimensions();
  // Pages run the full width so the card's shadow has the gutter to fall into
  // instead of being cut off at the list's edge.
  const pageWidth = width;
  const list = useRef<FlatList<CardKind>>(null);
  const [page, setPage] = useState(0);

  const ready = vault.state === 'ready';
  const order = deckOrder(role);
  const kind = order[page];
  // Each card counts as seen once it is on screen; the store ignores repeats.
  useEffect(() => {
    if (!ready || !pregnancy || !Number.isInteger(week) || !cardsFor(week)) return;
    if (week > (deckWeek(gestationalAge(pregnancy.lmp_date, today).weeks) ?? 0)) return;
    markSeen.mutate({ week, kind });
    // `markSeen` changes identity each render; the card on screen is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pregnancy, today, week, kind]);

  // The root layout only shows this screen once a pregnancy exists.
  if (!pregnancy) return null;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const current = deckWeek(gestationalAge(pregnancy.lmp_date, today).weeks);
  const cards = Number.isInteger(week) ? cardsFor(week) : null;
  const notYet = current === null || week > current;

  if (!cards || notYet) {
    return (
      <Screen>
        <BackButton label="Back" onPress={back} />
        <Text variant="screenTitle" accessibilityRole="header">
          {cards ? `Week ${week}` : 'No cards here'}
        </Text>
        <Text muted>{cards ? `These cards open in week ${week}.` : 'There are cards for weeks 4 to 41.'}</Text>
        <Button label="See all weeks" onPress={() => router.replace('/weeks')} />
      </Screen>
    );
  }

  const partnerName = members.data?.find((m) => m.role === 'partner')?.name;
  const isSaved = (saved.data ?? []).some((t) => t.week === week);
  const sizeLine = babySizeLine(week, pregnancy.babies);

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(order.length - 1, index));
    list.current?.scrollToIndex({ index: next, animated: true });
    setPage(next);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / pageWidth));
  };

  return (
    <Screen>
      <BackButton label="Back" onPress={back} />

      <View style={styles.header}>
        <Text muted style={styles.kicker}>
          {week === current ? 'THIS WEEK' : `WEEK ${week} OF YOUR PREGNANCY`}
        </Text>
        <Text variant="screenTitle" accessibilityRole="header">
          Week {week}
        </Text>
      </View>

      <FlatList
        ref={list}
        data={order}
        keyExtractor={(k) => k}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_d, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
        style={styles.deck}
        renderItem={({ item }) => (
          <View style={[styles.page, { width: pageWidth }]}>
            <FlipCard
              key={`${week}:${item}`}
              label={cardLabel(item, partnerName)}
              tone={CARD_META[item].tone}
              front={cards[item].front}
              back={cards[item].back}
              lead={item === 'baby' ? sizeLine : null}
            />
          </View>
        )}
      />

      <View style={styles.nav}>
        <NavButton label="Previous card" direction="left" disabled={page === 0} onPress={() => goTo(page - 1)} />
        <View style={styles.dots} accessible accessibilityLabel={`Card ${page + 1} of ${order.length}`}>
          {order.map((k, i) => (
            <View key={k} style={[styles.dot, i === page && { backgroundColor: CARD_META[k].tone }]} />
          ))}
        </View>
        <NavButton label="Next card" direction="right" disabled={page === order.length - 1} onPress={() => goTo(page + 1)} />
      </View>

      {kind === 'thought' && (
        <Button
          label={isSaved ? 'Saved to your thoughts' : 'Save this thought'}
          variant={isSaved ? 'light' : 'dark'}
          disabled={!ready || saveThought.isPending}
          onPress={() => saveThought.mutate({ week, saved: !isSaved })}
          accessibilityHint={isSaved ? 'Takes it off your saved thoughts' : undefined}
        />
      )}

      <Pressable accessibilityRole="link" onPress={() => router.push('/weeks')} style={styles.allWeeks}>
        <Text style={[styles.link, { color: colors.link }]}>See all weeks and saved thoughts</Text>
      </Pressable>
    </Screen>
  );
}

/**
 * One card: the front line, and the back after a tap. Only one face is drawn at
 * a time, so nothing of the other face (its outline or shadow) can peek past the
 * corners. The card turns edge-on, swaps faces, and turns back; with reduced
 * motion it simply swaps.
 */
function FlipCard({ label, tone, front, back, lead }: { label: string; tone: string; front: string; back: string; lead: string | null }) {
  const styles = useStyles();
  const { shadow } = useTheme();
  const [flipped, setFlipped] = useState(false);
  const [shown, setShown] = useState<'front' | 'back'>('front');
  const [turn] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => active && setReduceMotion(on));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  const toggle = () => {
    const next = !flipped;
    const side = next ? 'back' : 'front';
    setFlipped(next);
    if (reduceMotion) {
      setShown(side);
      return;
    }
    turn.stopAnimation();
    Animated.timing(turn, { toValue: 90, duration: FLIP_MS / 2, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(
      ({ finished }) => {
        if (!finished) return;
        setShown(side);
        turn.setValue(-90);
        Animated.timing(turn, { toValue: 0, duration: FLIP_MS / 2, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      },
    );
  };

  const rotateY = turn.interpolate({ inputRange: [-90, 90], outputRange: ['-90deg', '90deg'] });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={flipped ? `${label}. ${lead ? `${lead}. ` : ''}${back}` : `${label}. ${front}`}
      accessibilityHint={flipped ? 'Turns back to the front' : 'Turns the card over'}
      onPress={toggle}
      style={styles.grow}>
      <Animated.View style={[styles.grow, { transform: [{ perspective: 1200 }, { rotateY }] }]}>
        <Card tone={tone} style={[styles.card, { boxShadow: `${shadow.lg}, ${SOFT_SHADOW}` }]}>
          <Text style={styles.overline}>{label.toUpperCase()}</Text>
          {shown === 'front' ? (
            <>
              <Text style={styles.front}>{front}</Text>
              <Text style={styles.hint}>Tap to read more</Text>
            </>
          ) : (
            <>
              {lead && <Text style={styles.lead}>{lead}</Text>}
              <Text style={styles.back}>{back}</Text>
              <Text style={styles.hint}>Tap to turn back</Text>
            </>
          )}
        </Card>
      </Animated.View>
    </Pressable>
  );
}

function NavButton({ label, direction, disabled, onPress }: { label: string; direction: 'left' | 'right'; disabled: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.navBtn, disabled && styles.navOff]}>
      <ChevronIcon direction={direction} size={20} />
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, border }) => ({
  header: { gap: 2 },
  kicker: { fontFamily: fonts.bodyHeavy, fontSize: 13, letterSpacing: 1 },
  deck: { marginHorizontal: -space.xl, flexGrow: 0 },
  // Room on every side for the offset shadow and the soft drop below it.
  page: { paddingHorizontal: space.xl, paddingTop: 4, paddingBottom: 28 },
  // Every card in the deck grows to the tallest one, so they all match.
  grow: { flexGrow: 1 },
  card: { flexGrow: 1, minHeight: CARD_HEIGHT, padding: 24, gap: 14 },
  overline: { fontFamily: fonts.bodyHeavy, fontSize: 13, letterSpacing: 1, color: accents.onAccent },
  front: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: accents.onAccent },
  hint: { fontFamily: fonts.bodyBold, fontSize: 13, color: accents.onAccentMuted, marginTop: 'auto' },
  lead: { fontFamily: fonts.displayBold, fontSize: 19, lineHeight: 23, color: accents.onAccent },
  back: { fontFamily: fonts.body, fontSize: 17, lineHeight: 26, color: accents.onAccent },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navOff: { opacity: 0.35 },
  dots: { flexDirection: 'row', gap: 8 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
  },
  allWeeks: { alignSelf: 'center', paddingVertical: 10 },
  link: { fontFamily: fonts.bodyBold, fontSize: 15 },
}));
