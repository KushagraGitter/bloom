import { useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Produce } from '@/components/Produce';
import { Text } from '@/components/Text';
import { GROWTH_WEEKS, growthFor, lengthText, produceBox, weightText } from '@/lib/growth';
import { makeStyles, useTheme } from '@/theme/theme';
import { accents, fonts, radius } from '@/theme/tokens';

/** Points drawn per centimetre of baby, so the row is to scale from a poppy seed to a watermelon. */
export const PARADE_SCALE = 2.2;
/** Even a poppy seed gets a dot you can see and tap. */
const MIN_LENGTH = 4;
/** Space either side of the row, so the first and last weeks can scroll to the middle. */
const EDGE = 24;

export type FruitParadeProps = {
  /** Completed weeks today. */
  weeks: number;
  babies?: number;
  /** Opens the life-size sheet for a week. */
  onLifeSize: (week: number) => void;
};

/** "This week", "3 weeks ago" or "In 1 week". */
export function weeksAway(week: number, current: number): string {
  const n = Math.abs(week - current);
  if (n === 0) return 'This week';
  const span = `${n} week${n === 1 ? '' : 's'}`;
  return week < current ? `${span} ago` : `In ${span}`;
}

/** The sentence under the fruit's name, in the right tense for the week picked. */
export function sizeSentence(week: number, current: number, babies = 1): string {
  const g = growthFor(week);
  if (!g) return '';
  const who = babies > 1 ? 'Each baby' : 'Baby';
  const verb = week < current ? 'was' : week === current ? 'is' : 'will be';
  return `${who} ${verb} about ${lengthText(g.lengthCm)} long and ${g.weightG < 1 ? 'weighs under 1 g' : weightText(g.weightG)}`;
}

/**
 * The inside of Today's purple week card: every week's fruit in a row, drawn to
 * scale against each other. Weeks behind her are in colour, the ones ahead are
 * pale shapes, and tapping one shows its size at the top.
 */
export function FruitParade({ weeks, babies = 1, onLifeSize }: FruitParadeProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const current = Math.max(weeks, 0);
  const startWeek = growthFor(current)?.week ?? GROWTH_WEEKS[0];
  const [picked, setPicked] = useState(startWeek);
  const scroller = useRef<ScrollView>(null);
  const width = useRef(0);
  const centres = useRef(new Map<number, number>());
  const centred = useRef(false);

  const growth = growthFor(picked);
  const before = growthFor(current) === null;

  // Once the row and this week's fruit have been measured, open centred on this week.
  const centre = () => {
    const x = centres.current.get(startWeek);
    if (centred.current || x === undefined || width.current === 0) return;
    centred.current = true;
    scroller.current?.scrollTo({ x: Math.max(0, x - width.current / 2), animated: false });
  };

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Text style={styles.kicker} color={colors.onPurple}>
          {before ? 'COMING SOON' : `WEEK ${picked} · ${weeksAway(picked, current).toUpperCase()}`}
        </Text>
        {growth && (
          <>
            <Text style={styles.name} color={colors.onPurple} accessibilityRole="header">
              {before ? `Week ${growth.week}: ${growth.name}` : capitalise(growth.name)}
            </Text>
            <Text style={styles.line} color={colors.onPurple}>
              {before ? 'Your fruit parade starts in week 4.' : sizeSentence(picked, current, babies)}
            </Text>
            {!before && (
              <View style={styles.pills}>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{lengthText(growth.lengthCm)}</Text>
                </View>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{weightText(growth.weightG)}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`See ${growth.name} at life size`}
                  onPress={() => onLifeSize(picked)}
                  style={({ pressed }) => [styles.pill, styles.lifeSize, pressed && styles.pressed]}>
                  <Text style={styles.pillText}>Life size</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroller}
        contentContainerStyle={styles.row}
        onLayout={(e) => {
          width.current = e.nativeEvent.layout.width;
          centre();
        }}
        accessibilityLabel="Your weeks as fruit">
        <View style={styles.ground} />
        {GROWTH_WEEKS.map((week) => {
          const g = growthFor(week)!;
          const length = Math.max(g.lengthCm * PARADE_SCALE, MIN_LENGTH);
          const now = week === startWeek && !before;
          const ahead = before || week > current;
          const selected = week === picked && !before;
          return (
            <Pressable
              key={week}
              accessibilityRole="button"
              accessibilityLabel={`Week ${week}, ${g.name}${now ? ', this week' : ''}`}
              accessibilityState={{ selected }}
              onPress={() => setPicked(week)}
              onLayout={(e) => {
                centres.current.set(week, e.nativeEvent.layout.x + e.nativeEvent.layout.width / 2);
                if (week === startWeek) centre();
              }}
              hitSlop={{ top: 12, bottom: 8 }}
              style={[styles.item, { minWidth: Math.max(produceBox(g.shape, length).width, 18) }]}>
              {now && <Text style={styles.now}>NOW</Text>}
              <View style={[selected && styles.lifted, ahead && styles.ahead]}>
                <Produce week={week} length={length} silhouette={ahead ? colors.lilac : undefined} />
              </View>
              <View style={[styles.num, now && styles.numNow]}>
                <Text style={[styles.numText, now && styles.numTextNow]} color={now ? accents.onAccent : colors.onPurple}>
                  {week}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const useStyles = makeStyles(({ colors, border }) => ({
  root: { gap: 4 },
  top: { gap: 6 },
  kicker: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1 },
  name: { fontFamily: fonts.display, fontSize: 26, lineHeight: 29 },
  line: { fontFamily: fonts.body, fontSize: 13, opacity: 0.9 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  pill: {
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: border.width,
    borderColor: colors.onAccent,
    backgroundColor: colors.paper,
  },
  lifeSize: { backgroundColor: colors.yellow, boxShadow: `2px 2px 0px ${colors.onAccent}` },
  pressed: { opacity: 0.8 },
  pillText: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.onAccent },
  // The card has 22pt of padding; the row runs to its edges.
  scroller: { marginHorizontal: -22, marginTop: 4 },
  row: { alignItems: 'flex-end', gap: 12, paddingHorizontal: EDGE, paddingTop: 30 },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 26,
    height: 2,
    backgroundColor: colors.onAccent,
    opacity: 0.5,
  },
  item: { alignItems: 'center', gap: 6 },
  ahead: { opacity: 0.55 },
  lifted: { transform: [{ translateY: -6 }, { rotate: '-6deg' }] },
  now: {
    position: 'absolute',
    top: -24,
    fontFamily: fonts.bodyHeavy,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.yellow,
    backgroundColor: colors.onAccent,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  num: { minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: 4 },
  numNow: { backgroundColor: colors.yellow, borderWidth: border.width, borderColor: colors.onAccent },
  numText: { fontFamily: fonts.bodyHeavy, fontSize: 10, opacity: 0.8 },
  numTextNow: { opacity: 1 },
}));
