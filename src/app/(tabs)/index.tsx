import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet, Button, CalendarIcon, Card, CheckIcon, Chip, Screen, SmileIcon, Text, TextField, TimerIcon } from '@/components';
import { VaultNotice } from '@/components/VaultNotice';
import { cardLine, dayLong, dayNumber, localTime, monthAbbr, nextUp } from '@/lib/appointments';
import {
  useAppointments,
  useDoses,
  useLatestCheckins,
  useLocalTime,
  useLocalToday,
  useLogCheckin,
  useMedications,
  useMembers,
  useMembership,
  useProfile,
  useTally,
  useTodayReadings,
  useToggleDose,
} from '@/lib/data';
import { shortDay, timeOf } from '@/lib/format';
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
import { TIMES, doseKey, doseLine, dueOn, indexDoses, inDisplayOrder, tickedBy } from '@/lib/vitamins';
import { border, colors, fonts, radius, touchTarget } from '@/theme/tokens';

/** Today's list stays short; the Vitamins tab has the rest. */
const VITAMINS_SHOWN = 4;

export default function TodayScreen() {
  const { session } = useSession();
  const membership = useMembership();
  const profile = useProfile();
  const pregnancy = membership.data?.pregnancy;
  const pregnancyId = pregnancy?.id;

  const day = useLocalToday();
  const today = useTodayReadings(pregnancyId, day);
  const latest = useLatestCheckins(pregnancyId);
  const members = useMembers(pregnancyId);

  const [sheet, setSheet] = useState<CheckinType | null>(null);

  // The root layout only shows the tabs once a pregnancy exists.
  if (!pregnancy) return null;

  const units: Units = pregnancy.units;
  const ga = gestationalAge(pregnancy.lmp_date, day);
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

      <VaultNotice />

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

      <Tallies pregnancyId={pregnancy.id} day={day} rows={rows} />

      <Tools />

      <VitaminsCard pregnancyId={pregnancy.id} day={day} />

      <NextAppointment pregnancyId={pregnancy.id} />

      <CheckinSheet type={sheet} units={units} pregnancyId={pregnancy.id} onClose={() => setSheet(null)} />
    </Screen>
  );
}

function Tallies({ pregnancyId, day, rows }: { pregnancyId: string; day: string; rows: Reading[] }) {
  const kicks = useTally(pregnancyId, 'kicks', day);
  const water = useTally(pregnancyId, 'water', day);
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

/** The design's three tools. */
function Tools() {
  return (
    <View style={styles.section}>
      <Text variant="title" accessibilityRole="header">
        Tools
      </Text>
      <View style={styles.tools}>
        <ToolTile lines={['Mood &', 'symptoms']} tone={colors.pink} icon={<SmileIcon />} onPress={() => router.push('/mood')} />
        <ToolTile lines={['Appointments']} tone={colors.surface} icon={<CalendarIcon />} onPress={() => router.push('/appointments')} />
        <ToolTile lines={['Contraction', 'timer']} tone={colors.mint} icon={<TimerIcon />} onPress={() => router.push('/contractions')} />
      </View>
    </View>
  );
}

/**
 * Three of these share a row, which on a phone leaves a word like
 * "Appointments" barely room, so the label is given in lines and each one
 * shrinks a little rather than a word breaking in the middle.
 */
function ToolTile({ lines, tone, icon, onPress }: { lines: string[]; tone: string; icon: ReactNode; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={lines.join(' ')} onPress={onPress} style={[styles.tool, { backgroundColor: tone }]}>
      {icon}
      <View>
        {lines.map((line) => (
          <Text key={line} style={styles.toolLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {line}
          </Text>
        ))}
      </View>
    </Pressable>
  );
}

function VitaminsCard({ pregnancyId, day }: { pregnancyId: string; day: string }) {
  const { session } = useSession();
  const meds = useMedications(pregnancyId);
  const doses = useDoses(pregnancyId);
  const members = useMembers(pregnancyId);
  const toggle = useToggleDose(pregnancyId);

  const due = inDisplayOrder(dueOn(meds.data ?? [], day));
  const index = indexDoses(doses.data ?? []);
  const shown = due.slice(0, VITAMINS_SHOWN);

  return (
    <Card size="panel" style={styles.vitCard}>
      <View style={styles.vitHeader}>
        <Text variant="title" accessibilityRole="header">
          Vitamins
        </Text>
        <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.navigate('/vitamins')}>
          <Text style={styles.seeAll}>{meds.data?.length === 0 ? 'Add' : 'See all'}</Text>
        </Pressable>
      </View>
      {meds.isSuccess && due.length === 0 && (
        <Text muted>{meds.data.length === 0 ? 'Add the vitamins you take and tick them off here.' : 'Nothing due today.'}</Text>
      )}
      {shown.map((med) => {
        const dose = index.get(doseKey(med.id, day));
        const who = dose ? tickedBy(dose, session?.user.id, members.data) : null;
        const when = `${TIMES.find((t) => t.key === med.time_of_day)?.label} · ${doseLine(med)}`;
        return (
          <Pressable
            key={med.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!dose }}
            accessibilityLabel={`${med.name}, ${when}`}
            onPress={() => toggle.mutate({ medicationId: med.id, day, taken: !dose })}
            style={styles.vitRow}>
            <View style={[styles.box, !!dose && styles.boxOn]}>{dose && <CheckIcon />}</View>
            <View style={styles.vitText}>
              <Text style={styles.vitName} numberOfLines={1}>
                {med.name}
              </Text>
              <Text muted style={styles.vitWhen} numberOfLines={1}>
                {when}
              </Text>
              {dose && who && (
                <Text variant="caption">
                  {who} marked it taken · {timeOf(dose.taken_at)}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
      {due.length > shown.length && (
        <Text muted style={styles.vitWhen}>
          +{due.length - shown.length} more on the Vitamins tab
        </Text>
      )}
      {toggle.isError && (
        <Text muted accessibilityRole="alert">
          Couldn&apos;t save that tick. Check your connection and try again.
        </Text>
      )}
    </Card>
  );
}

/**
 * The next appointment that hasn't happened yet, linking to the calendar. It moves on by itself
 * once an appointment's time has passed. Nothing shows when none is booked.
 */
function NextAppointment({ pregnancyId }: { pregnancyId: string }) {
  const appointments = useAppointments(pregnancyId);
  // Renders again as each minute starts. The day and the time are then read from the one clock
  // reading, so the new time is never paired with the old day just after midnight.
  useLocalTime();
  const now = new Date();
  const next = nextUp(appointments.data ?? [], localToday(now), localTime(now));
  if (!next) return null;
  const line = cardLine(next);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Next appointment: ${next.title}, ${dayLong(next.appt_date)}, ${line}`}
      onPress={() => router.push('/appointments')}
      style={styles.nextCard}>
      <View style={styles.nextTile}>
        <Text style={styles.nextMonth}>{monthAbbr(next.appt_date)}</Text>
        <Text style={styles.nextDay}>{dayNumber(next.appt_date)}</Text>
      </View>
      <View style={styles.nextText}>
        <Text style={styles.nextKicker}>Next appointment</Text>
        <Text style={styles.nextTitle} numberOfLines={2}>
          {next.title}
        </Text>
        <Text style={styles.nextMeta} numberOfLines={1}>
          {line}
        </Text>
      </View>
    </Pressable>
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
  vitCard: { padding: 16, gap: 10 },
  vitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seeAll: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.purple },
  vitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 4 },
  box: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.mint },
  vitText: { flex: 1 },
  vitName: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  vitWhen: { fontSize: 13 },
  tools: { flexDirection: 'row', gap: 10 },
  tool: {
    flex: 1,
    minHeight: 96,
    padding: 12,
    gap: 8,
    borderRadius: radius.tool,
    borderWidth: border.width,
    borderColor: border.color,
  },
  toolLabel: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: colors.ink },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius.panel,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.pink,
  },
  nextTile: {
    width: 56,
    height: 60,
    borderRadius: 16,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextMonth: { fontFamily: fonts.bodyHeavy, fontSize: 11, color: colors.ink },
  nextDay: { fontFamily: fonts.display, fontSize: 24, lineHeight: 24, color: colors.ink },
  nextText: { flex: 1, minWidth: 0, gap: 2 },
  nextKicker: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  nextTitle: { fontFamily: fonts.display, fontSize: 18, lineHeight: 21, color: colors.ink },
  nextMeta: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
});
