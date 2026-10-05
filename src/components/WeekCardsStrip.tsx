import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ChevronIcon } from '@/components/icons';
import { Text } from '@/components/Text';
import { useSeenCards } from '@/lib/useWeeklyCards';
import { useVault } from '@/lib/vault/VaultProvider';
import { CARD_KINDS, CARD_META, deckWeek, unseenCount } from '@/lib/weeklyCards';
import { makeStyles } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';

/**
 * The slim “This week” row under the week card on Today. Its dots fill in as
 * this person looks at each card, and it says how many are new.
 */
export function WeekCardsStrip({ pregnancyId, weeks }: { pregnancyId: string; weeks: number }) {
  const styles = useStyles();
  const vault = useVault();
  const seen = useSeenCards(pregnancyId);
  const week = deckWeek(weeks);
  if (week === null) return null;

  const seenKinds = seen.data?.get(week) ?? [];
  const fresh = unseenCount(seenKinds);
  // Before the household key is here nothing can be marked, so it doesn't count cards as new.
  const status = vault.state !== 'ready' || !seen.data ? 'Five cards' : fresh === 0 ? 'All seen' : `${fresh} new`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Week ${week} cards, ${status}`}
      onPress={() => router.push(`/week/${week}`)}
      style={({ pressed }) => [styles.strip, pressed && styles.pressed]}>
      <View style={styles.text}>
        <Text style={styles.title}>Week {week} cards</Text>
        <Text variant="caption">{status}</Text>
      </View>
      <View style={styles.dots}>
        {CARD_KINDS.map((kind) => (
          <View key={kind} style={[styles.dot, seenKinds.includes(kind) && { backgroundColor: CARD_META[kind].tone }]} />
        ))}
      </View>
      <ChevronIcon direction="right" />
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, border, shadow }) => ({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.card,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
    boxShadow: shadow.md,
  },
  pressed: { opacity: 0.85 },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.ink },
  dots: { flexDirection: 'row', gap: 5 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
  },
}));
