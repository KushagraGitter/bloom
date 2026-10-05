import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
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

const CARD_HEIGHT = 400;
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
  const pageWidth = width - space.xl * 2;
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
        style={{ width: pageWidth }}
        renderItem={({ item }) => (
          <View style={{ width: pageWidth }}>
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

/** One card: the front line, and the back after a tap. With reduced motion it swaps without turning. */
function FlipCard({ label, tone, front, back, lead }: { label: string; tone: string; front: string; back: string; lead: string | null }) {
  const styles = useStyles();
  const [flipped, setFlipped] = useState(false);
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
    setFlipped(next);
    if (reduceMotion) turn.setValue(next ? 1 : 0);
    else Animated.timing(turn, { toValue: next ? 1 : 0, duration: FLIP_MS, useNativeDriver: true }).start();
  };

  const frontTurn = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backTurn = turn.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  const face = (side: 'front' | 'back') => (
    <Card tone={tone} elevation="lg" style={styles.card}>
      <Text style={styles.overline}>{label.toUpperCase()}</Text>
      {side === 'front' ? (
        <>
          <Text style={styles.front}>{front}</Text>
          <Text style={styles.hint}>Tap to turn over</Text>
        </>
      ) : (
        <>
          {lead && <Text style={styles.lead}>{lead}</Text>}
          <Text style={styles.back}>{back}</Text>
        </>
      )}
    </Card>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={flipped ? `${label}. ${lead ? `${lead}. ` : ''}${back}` : `${label}. ${front}`}
      accessibilityHint={flipped ? 'Turns back to the front' : 'Turns the card over'}
      onPress={toggle}
      style={styles.flip}>
      {reduceMotion ? (
        face(flipped ? 'back' : 'front')
      ) : (
        <>
          <Animated.View style={[styles.side, { transform: [{ perspective: 1000 }, { rotateY: frontTurn }] }]}>{face('front')}</Animated.View>
          <Animated.View style={[styles.side, { transform: [{ perspective: 1000 }, { rotateY: backTurn }] }]}>{face('back')}</Animated.View>
        </>
      )}
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
  flip: { height: CARD_HEIGHT },
  side: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backfaceVisibility: 'hidden' },
  card: { flex: 1, padding: 22, gap: 14 },
  overline: { fontFamily: fonts.bodyHeavy, fontSize: 13, letterSpacing: 1, color: accents.onAccent },
  front: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: accents.onAccent, flex: 1 },
  hint: { fontFamily: fonts.bodyBold, fontSize: 13, color: accents.onAccentMuted },
  lead: { fontFamily: fonts.displayBold, fontSize: 19, lineHeight: 23, color: accents.onAccent },
  back: { fontFamily: fonts.body, fontSize: 17, lineHeight: 25, color: accents.onAccent },
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
