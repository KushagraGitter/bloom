import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet, Button, Card, Chip, Screen, Text, TextField } from '@/components';
import {
  useLatestCheckins,
  useLogCheckin,
  useMembers,
  useMembership,
  useProfile,
  useReadingsRealtime,
  useTally,
  useTodayReadings,
} from '@/lib/data';
import { gestationalAge, localToday } from '@/lib/pregnancy';
import { formatDate, initialOf } from '@/lib/profile';
import {
  CHECKINS,
  SUGAR_CONTEXTS,
  WATER_GOAL,
  babySizeLine,
  checkinMeta,
  countOf,
  formatCheckin,
  isSameLocalDay,
  latestOf,
  parseCheckin,
  type CheckinType,
  type Reading,
  type Units,
} from '@/lib/readings';
import { useSession } from '@/lib/session';
import { border, colors, fonts, radius, touchTarget } from '@/theme/tokens';

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function TodayScreen() {
  const { session } = useSession();
  const membership = useMembership();
  const profile = useProfile();
  const pregnancy = membership.data?.pregnancy;
  const pregnancyId = pregnancy?.id;

  const today = useTodayReadings(pregnancyId);
  const latest = useLatestCheckins(pregnancyId);
  const members = useMembers(pregnancyId);
  useReadingsRealtime(pregnancyId);

  const [sheet, setSheet] = useState<CheckinType | null>(null);

  // The root layout only shows the tabs once a pregnancy exists.
  if (!pregnancy) return null;

  const units: Units = pregnancy.units;
  const ga = gestationalAge(pregnancy.lmp_date, localToday());
  const name = profile.data?.name?.trim();
  const firstName = name?.split(' ')[0];
  const sizeLine = babySizeLine(ga.weeks, pregnancy.babies);
  const rows = today.data ?? [];

  const whoLogged = (r: Reading) => {
    if (r.logged_by === session?.user.id) return null;
    const who = members.data?.find((m) => m.user_id === r.logged_by)?.name?.trim().split(' ')[0];
    return who ?? 'Partner';
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text muted style={styles.date}>
            {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
          </Text>
          <Text variant="screenTitle" accessibilityRole="header">
            Hi{firstName ? `, ${firstName}` : ''}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile"
          onPress={() => router.push('/profile')}
          style={styles.avatar}>
          <Text style={styles.avatarText}>{initialOf(name)}</Text>
        </Pressable>
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
        {sizeLine && <Text style={styles.size}>{sizeLine}</Text>}
        <View style={[styles.track, !sizeLine && styles.trackLow]}>
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

      <View style={styles.section}>
        <Text variant="title" accessibilityRole="header">
          Today&apos;s check-in
        </Text>
        <View style={styles.grid}>
          {CHECKINS.map((type) => {
            const meta = checkinMeta(type, units);
            const last = latest.data?.[type];
            const loggedToday = last && isSameLocalDay(last.taken_at);
            let sub = 'Not logged yet';
            if (last && loggedToday) {
              const who = whoLogged(last);
              const context = type === 'sugar' && last.value_text ? `${last.value_text} · ` : '';
              sub = `${context}${who ? `${who} · ` : 'Logged '}${timeOf(last.taken_at)}`;
            } else if (last) {
              const f = formatCheckin(last, units);
              sub = `Last: ${f.value}${f.unit ? ` ${f.unit}` : ''}, ${shortDay(last.taken_at)}`;
            }
            const shown = last && loggedToday ? formatCheckin(last, units) : null;
            return (
              <Pressable
                key={type}
                accessibilityRole="button"
                accessibilityLabel={`${meta.label}: ${shown ? `${shown.value} ${shown.unit}` : 'not logged today'}. ${meta.title}`}
                onPress={() => setSheet(type)}
                style={[styles.checkin, !shown && styles.dashed]}>
                <Text muted style={styles.checkinLabel}>
                  {meta.label}
                </Text>
                <Text style={styles.checkinValue}>
                  {shown ? shown.value : '+ Log'}
                  {shown?.unit ? <Text style={styles.checkinUnit}> {shown.unit}</Text> : null}
                </Text>
                <Text variant="caption" numberOfLines={1}>
                  {sub}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Tallies pregnancyId={pregnancy.id} rows={rows} />

      <CheckinSheet type={sheet} units={units} pregnancyId={pregnancy.id} onClose={() => setSheet(null)} />
    </Screen>
  );
}

function Tallies({ pregnancyId, rows }: { pregnancyId: string; rows: Reading[] }) {
  const kicks = useTally(pregnancyId, 'kicks');
  const water = useTally(pregnancyId, 'water');
  const kickCount = countOf(rows, 'kicks');
  const glasses = countOf(rows, 'water');
  const lastGlass = latestOf(rows, 'water');
  const failed = kicks.add.isError || water.add.isError || water.remove.isError;

  return (
    <View style={styles.section}>
      <View style={styles.grid}>
        <Card tone={colors.mint} style={styles.tally}>
          <Text variant="label">Baby kicks</Text>
          <Text style={styles.tallyNum} accessibilityLabel={`${kickCount} kicks today`}>
            {kickCount}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => kicks.add.mutate()} style={styles.tallyBtn}>
            <Text style={styles.tallyBtnText}>Tap a kick</Text>
          </Pressable>
        </Card>
        <Card tone={colors.yellow} style={styles.tally}>
          <Text variant="label">Water</Text>
          <Text style={styles.tallyNum} accessibilityLabel={`${glasses} of ${WATER_GOAL} glasses`}>
            {glasses}
            <Text style={styles.tallyOf}>/{WATER_GOAL}</Text>
          </Text>
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove a glass"
              disabled={!lastGlass || lastGlass.id.startsWith('pending-') || water.remove.isPending}
              onPress={() => lastGlass && water.remove.mutate(lastGlass.id)}
              style={[styles.tallyBtn, styles.half, !lastGlass && styles.disabled]}>
              <Text style={styles.plusMinus}>−</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add a glass"
              disabled={glasses >= WATER_GOAL}
              onPress={() => water.add.mutate()}
              style={[styles.tallyBtn, styles.half, styles.dark, glasses >= WATER_GOAL && styles.disabled]}>
              <Text style={[styles.plusMinus, { color: colors.surface }]}>+</Text>
            </Pressable>
          </View>
        </Card>
      </View>
      {failed && (
        <Text muted accessibilityRole="alert">
          Couldn&apos;t save that tap. Check your connection and try again.
        </Text>
      )}
    </View>
  );
}

function CheckinSheet({
  type,
  units,
  pregnancyId,
  onClose,
}: {
  type: CheckinType | null;
  units: Units;
  pregnancyId: string;
  onClose: () => void;
}) {
  const log = useLogCheckin(pregnancyId);
  const [draft, setDraft] = useState('');
  const [context, setContext] = useState<string>(SUGAR_CONTEXTS[0]);
  const [error, setError] = useState<string | null>(null);
  const meta = type ? checkinMeta(type, units) : null;

  const close = () => {
    setDraft('');
    setError(null);
    log.reset();
    onClose();
  };

  const save = () => {
    if (!type) return;
    const parsed = parseCheckin(type, draft, units);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    log.mutate(
      { type, value_num: parsed.value_num, value_num2: parsed.value_num2, value_text: type === 'sugar' ? context : null },
      { onSuccess: close },
    );
  };

  return (
    <BottomSheet visible={!!type} onClose={close} title={meta?.title ?? ''}>
      {type === 'sugar' && (
        <View style={styles.chips} accessibilityRole="radiogroup">
          {SUGAR_CONTEXTS.map((c) => (
            <Chip key={c} label={c} selected={context === c} onPress={() => setContext(c)} />
          ))}
        </View>
      )}
      <View style={styles.fieldRow}>
        <TextField
          label={meta?.field ?? ''}
          value={draft}
          onChangeText={setDraft}
          placeholder={meta?.placeholder}
          keyboardType={meta?.keyboard}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={save}
        />
      </View>
      {(error || log.isError) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error ?? 'Couldn’t save. Check your connection and try again.'}
        </Text>
      )}
      <View style={styles.row}>
        <Button label="Cancel" onPress={close} style={styles.half} />
        <Button label={log.isPending ? 'Saving…' : 'Save'} variant="dark" disabled={log.isPending} onPress={save} style={styles.half} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerText: { gap: 2, flexShrink: 1 },
  date: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
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
  size: { fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 25, color: colors.surface, maxWidth: 200 },
  track: {
    height: 12,
    borderRadius: 99,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  // Clears the week badge when there is no size line above the bar.
  trackLow: { marginTop: 40 },
  fill: { height: '100%', backgroundColor: colors.mint },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  section: { gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  checkin: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: border.width,
    borderColor: border.color,
    borderRadius: radius.card,
    padding: 14,
    gap: 4,
  },
  dashed: { borderStyle: 'dashed' },
  checkinLabel: { fontFamily: fonts.bodyBold, fontSize: 13 },
  checkinValue: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  checkinUnit: { fontFamily: fonts.display, fontSize: 14, color: colors.ink },
  tally: { flexBasis: '47%', flexGrow: 1, borderRadius: radius.card, gap: 8 },
  tallyNum: { fontFamily: fonts.display, fontSize: 36, lineHeight: 38, color: colors.ink },
  tallyOf: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  tallyBtn: {
    minHeight: touchTarget,
    borderRadius: radius.button,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tallyBtnText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.ink },
  half: { flex: 1 },
  dark: { backgroundColor: colors.ink },
  plusMinus: { fontFamily: fonts.bodyHeavy, fontSize: 20, color: colors.ink },
  disabled: { opacity: 0.5 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  fieldRow: { flexDirection: 'row' },
  error: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.purpleDark },
});
