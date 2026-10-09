import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, View } from 'react-native';

import { Produce } from '@/components/Produce';
import { Text } from '@/components/Text';
import { growthFor } from '@/lib/growth';
import { postcardFor, signOff } from '@/lib/postcards';
import { makeStyles } from '@/theme/theme';
import { produceParts } from '@/theme/produce';
import { accents, fonts, radius } from '@/theme/tokens';

const TURN_MS = 140;

type Side = 'front' | 'back';

export type PostcardProps = {
  week: number;
  babies?: number;
  /** "6 OCT", printed on the postmark. */
  postmark: string;
  /** Shows a "New" sticker on the front. */
  fresh?: boolean;
  /** Called the first time it is turned to the note. */
  onRead?: () => void;
};

/**
 * This week's postcard on Today. The front is a holiday-style "Greetings from
 * week 24" with the week's fruit; tapping turns it over to the baby's note.
 * Only one face is drawn at a time, so nothing from the other side shows at
 * the corners while it turns.
 */
export function Postcard({ week, babies = 1, postmark, fresh, onRead }: PostcardProps) {
  const styles = useStyles();
  const [side, setSide] = useState<Side>('front');
  const [turn] = useState(() => new Animated.Value(1));
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => (reduceMotion.current = on))
      .catch(() => {});
  }, []);

  const flip = () => {
    const next: Side = side === 'front' ? 'back' : 'front';
    if (next === 'back') onRead?.();
    if (reduceMotion.current) return setSide(next);
    Animated.timing(turn, { toValue: 0, duration: TURN_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      setSide(next);
      Animated.timing(turn, { toValue: 1, duration: TURN_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    });
  };

  const note = postcardFor(week);
  if (!note) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={side === 'front' ? `Postcard from your baby, week ${week}${fresh ? ', new' : ''}` : `Postcard, week ${week}: ${note}`}
      accessibilityHint={side === 'front' ? 'Turns it over to read the note' : 'Turns it back to the front'}
      onPress={flip}>
      <Animated.View style={[styles.card, { transform: [{ rotate: '-1.5deg' }, { scaleX: turn }] }]}>
        {side === 'front' ? <PostcardFront week={week} /> : <PostcardBack week={week} babies={babies} postmark={postmark} />}
      </Animated.View>
      {fresh && side === 'front' && (
        <View style={styles.new}>
          <Text style={styles.newText}>NEW</Text>
        </View>
      )}
    </Pressable>
  );
}

export function PostcardFront({ week }: { week: number }) {
  const styles = useStyles();
  return (
    <View style={styles.front}>
      <View style={styles.frontText}>
        <Text style={styles.greet}>GREETINGS FROM</Text>
        <Text style={styles.big}>Week {week}</Text>
        <Text style={styles.hint}>From your baby · tap to turn over</Text>
      </View>
      <View style={styles.sun}>
        <Produce week={week} length={growthFor(week)?.shape === 'seed' ? 16 : 70} />
      </View>
    </View>
  );
}

/** The note side: the baby's words, a stamp and postmark for the week, and the address. */
export function PostcardBack({ week, babies = 1, postmark, large }: { week: number; babies?: number; postmark: string; large?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.back, large && styles.backLarge]}>
      <Text style={[styles.note, large ? styles.noteLarge : styles.noteSmall]}>{postcardFor(week)}</Text>
      <View style={large ? styles.sideLarge : styles.sideSmall}>
        <View style={styles.stampWrap}>
          <View style={styles.stamp}>
            <Produce week={week} length={growthFor(week)?.shape === 'seed' ? 10 : 36} />
            <Text style={styles.stampText}>WK {week}</Text>
          </View>
          <View style={styles.postmark}>
            <Text style={styles.postmarkText}>
              WEEK {week}
              {'\n'}
              {postmark}
            </Text>
          </View>
        </View>
        <View style={[styles.address, large && styles.addressLarge]}>
          <Text style={styles.addressLine}>To: both of you</Text>
          <Text style={styles.addressLine}>{signOff(babies)}</Text>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ border, shadow }) => ({
  card: {
    borderWidth: border.width,
    borderColor: border.color,
    borderRadius: 18,
    backgroundColor: produceParts.postcard,
    boxShadow: shadow.md,
    overflow: 'hidden',
  },
  new: {
    position: 'absolute',
    top: -10,
    right: 16,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: border.width,
    borderColor: accents.onAccent,
    backgroundColor: accents.pink,
    transform: [{ rotate: '4deg' }],
  },
  newText: { fontFamily: fonts.bodyHeavy, fontSize: 10, letterSpacing: 1, color: accents.onAccent },
  front: { flexDirection: 'row', alignItems: 'center', minHeight: 150, paddingVertical: 14, paddingLeft: 16 },
  frontText: { flex: 1, gap: 4 },
  greet: { fontFamily: fonts.bodyHeavy, fontSize: 12, letterSpacing: 2, color: accents.onAccent },
  big: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 42,
    color: accents.purple,
    textShadowColor: accents.onAccent,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  hint: { fontFamily: fonts.bodyBold, fontSize: 11, color: accents.onAccentMuted, marginTop: 6 },
  sun: {
    width: 116,
    height: 116,
    marginRight: -18,
    borderRadius: 58,
    backgroundColor: accents.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { flexDirection: 'row', gap: 12, padding: 14, minHeight: 150 },
  backLarge: { flexDirection: 'column', gap: 16, minHeight: 230, padding: 18 },
  note: {
    fontFamily: fonts.hand,
    color: accents.onAccent,
    borderStyle: 'dashed',
    borderColor: produceParts.postcardRule,
  },
  noteSmall: { flex: 1.25, fontSize: 21, lineHeight: 23, paddingRight: 12, borderRightWidth: 2 },
  noteLarge: { fontSize: 28, lineHeight: 31, paddingBottom: 14, borderBottomWidth: 2 },
  sideSmall: { flex: 1, justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 },
  sideLarge: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  stampWrap: { paddingLeft: 26 },
  stamp: {
    width: 58,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: accents.yellow,
    borderWidth: border.width,
    borderColor: accents.onAccent,
    borderRadius: 3,
  },
  stampText: { position: 'absolute', bottom: 3, fontFamily: fonts.bodyHeavy, fontSize: 8, color: accents.onAccent },
  postmark: {
    position: 'absolute',
    left: 0,
    top: 14,
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: produceParts.postmark,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-14deg' }],
  },
  postmarkText: { fontFamily: fonts.bodyHeavy, fontSize: 7, lineHeight: 9, textAlign: 'center', color: produceParts.postmark },
  address: { alignSelf: 'stretch', gap: 6 },
  addressLarge: { flex: 1, alignSelf: 'auto', marginLeft: 8 },
  addressLine: {
    fontFamily: fonts.hand,
    fontSize: 18,
    lineHeight: 20,
    color: accents.onAccent,
    borderBottomWidth: 1.5,
    borderColor: produceParts.postcardRule,
    paddingBottom: 2,
  },
}));
