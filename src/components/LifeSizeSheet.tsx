import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Produce } from '@/components/Produce';
import { Text } from '@/components/Text';
import {
  POINTS_PER_CM,
  growthFor,
  lengthText,
  lifeSize,
  measuredText,
  produceBox,
  screenComparison,
  weightComparison,
  weightText,
} from '@/lib/growth';
import { makeStyles, useTheme } from '@/theme/theme';
import { fonts, radius, space } from '@/theme/tokens';

export type LifeSizeSheetProps = {
  /** The week to show, or null when the sheet is closed. */
  week: number | null;
  onClose: () => void;
};

/**
 * A week's fruit at its real size on the phone, with a centimetre ruler under
 * it. Once it is too big for the sheet it is drawn beside the phone's own
 * screen, to scale, and the weight is compared with everyday things.
 */
export function LifeSizeSheet({ week, onClose }: LifeSizeSheetProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [roomWidth, setRoomWidth] = useState(0);
  // Keep showing the last week while the sheet slides away.
  const [last, setLast] = useState<number | null>(week);
  if (week !== null && week !== last) setLast(week);
  const g = growthFor(week ?? last ?? -1);

  const room = { width: roomWidth, height: Math.min(screenHeight * 0.4, 320) };
  const size = g && roomWidth > 0 ? lifeSize(g, room, Math.max(screenWidth, screenHeight)) : null;

  return (
    <BottomSheet visible={week !== null} onClose={onClose} title={g ? `Life size · week ${g.week}` : 'Life size'}>
      {g && (
        <>
          <Text muted>
            {size?.fits === false
              ? `${capitalise(g.name)} is too big to draw at real size here, so here it is to scale against your screen.`
              : `${capitalise(g.name)}, drawn at about its real size on your screen.`}
          </Text>
          <View style={styles.box} onLayout={(e) => setRoomWidth(e.nativeEvent.layout.width - space.lg * 2 - 4)}>
            {size?.fits && (
              <>
                <Produce week={g.week} length={size.points} outline={colors.outline} />
                <Ruler cm={Math.max(1, Math.ceil(g.lengthCm))} />
              </>
            )}
            {size && !size.fits && <NextToScreens week={g.week} screens={size.screens} room={roomWidth} aspect={Math.min(screenWidth, screenHeight) / Math.max(screenWidth, screenHeight)} />}
          </View>
          <View style={styles.facts}>
            <Fact
              tone={colors.yellow}
              title={`${lengthText(g.lengthCm)}, ${measuredText(g.week)}`}
              sub={size && !size.fits ? screenComparison(size.screens) : 'Real size on most phones, give or take a few millimetres'}
            />
            <Fact tone={colors.pink} title={weightText(g.weightG)} sub={weightComparison(g.weightG) ?? 'Lighter than a paperclip'} />
          </View>
          <Text variant="caption">These are typical averages. Every baby grows at their own pace.</Text>
        </>
      )}
    </BottomSheet>
  );
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A centimetre ruler at real size. */
function Ruler({ cm }: { cm: number }) {
  const styles = useStyles();
  return (
    <View style={[styles.ruler, { width: cm * POINTS_PER_CM }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: cm + 1 }, (_, i) => (
        <View key={i} style={[styles.tick, { left: i * POINTS_PER_CM - 1 }]}>
          <Text style={styles.tickText}>{i}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * The fruit beside outlines of the phone's own screen, all at one scale. Up to
 * a screen long it sits on one upright screen; longer, it lies over a row of
 * screens turned on their side, so "two screens long" can be seen.
 */
function NextToScreens({ week, screens, room, aspect }: { week: number; screens: number; room: number; aspect: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const g = growthFor(week)!;

  if (screens < 1) {
    const screenLength = Math.min(room / aspect, 260);
    const drawn = screens * screenLength;
    const box = produceBox(g.shape, drawn);
    return (
      <View style={[styles.screen, styles.upright, { width: screenLength * aspect, height: screenLength }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={{ width: box.width, height: box.height }}>
          <Produce week={week} length={drawn} outline={colors.outline} />
        </View>
      </View>
    );
  }

  const count = Math.ceil(screens - 0.05);
  // Whichever is longer, the fruit or the row of screens, fills the room.
  const screenLength = room / Math.max(count, screens);
  const drawn = screens * screenLength;
  return (
    <View style={styles.screens} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ height: produceBox(g.shape, drawn).height }}>
        <Produce week={week} length={drawn} outline={colors.outline} />
      </View>
      <View style={styles.screenRow}>
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={[styles.screen, { width: screenLength, height: screenLength * aspect }]} />
        ))}
      </View>
    </View>
  );
}

function Fact({ tone, title, sub }: { tone: string; title: string; sub: string }) {
  const styles = useStyles();
  return (
    <View style={styles.fact}>
      <View style={[styles.swatch, { backgroundColor: tone }]} />
      <View style={styles.factText}>
        <Text style={styles.factTitle}>{title}</Text>
        <Text variant="caption">{sub}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, border }) => ({
  box: {
    borderWidth: border.width,
    borderColor: border.color,
    borderStyle: 'dashed',
    borderRadius: radius.card,
    padding: space.lg,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    overflow: 'hidden',
  },
  ruler: { height: 22, borderTopWidth: border.width, borderColor: border.color },
  tick: { position: 'absolute', top: 0, width: 2, height: 8, backgroundColor: colors.outline, alignItems: 'center' },
  tickText: { position: 'absolute', top: 9, width: 20, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 10, color: colors.inkMuted },
  screens: { alignSelf: 'stretch', gap: space.sm },
  screenRow: { flexDirection: 'row' },
  screen: {
    borderWidth: border.width,
    borderColor: border.color,
    borderRadius: 8,
    backgroundColor: colors.line,
    marginRight: -border.width,
  },
  upright: { marginRight: 0, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  facts: { gap: space.md },
  fact: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  swatch: { width: 40, height: 40, borderRadius: 12, borderWidth: border.width, borderColor: border.color },
  factText: { flex: 1, gap: 2 },
  factTitle: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.ink },
}));
