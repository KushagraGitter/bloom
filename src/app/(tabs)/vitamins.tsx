import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet, Button, Card, Chip, PillIcon, PlusIcon, Screen, Text, TextField, TrashIcon } from '@/components';
import { VaultNotice } from '@/components/VaultNotice';
import { confirmRemove } from '@/lib/confirm';
import {
  useAddMedication,
  useDoses,
  useLocalToday,
  useMedications,
  useMembers,
  useMembership,
  useRemoveMedication,
  useToggleDose,
} from '@/lib/data';
import { timeOf } from '@/lib/format';
import { useSession } from '@/lib/session';
import {
  DOSE_MAX,
  NAME_MAX,
  TIMES,
  doseKey,
  doseLine,
  dueOn,
  groupByTime,
  indexDoses,
  newMedicationRow,
  streakOf,
  tickedBy,
  tintIndex,
  weekDots,
  type Dose,
  type Medication,
  type TimeOfDay,
  type WeekDot,
} from '@/lib/vitamins';
import { border, colors, fonts, radius, shadow } from '@/theme/tokens';

/** Pill colours from the design, picked per medicine so both phones agree. */
const TINTS = [colors.pink, colors.mint, colors.orange, colors.yellow, colors.lilac];

export default function VitaminsScreen() {
  const { session } = useSession();
  const membership = useMembership();
  const pregnancyId = membership.data?.pregnancy.id;
  const day = useLocalToday();
  const meds = useMedications(pregnancyId);
  const doses = useDoses(pregnancyId);
  const members = useMembers(pregnancyId);
  const toggle = useToggleDose(pregnancyId);
  const remove = useRemoveMedication(pregnancyId);
  const [adding, setAdding] = useState(false);
  // A new key each time it opens gives the sheet empty fields, without them visibly clearing as it slides away.
  const [sheetKey, setSheetKey] = useState(0);
  const openAdd = () => {
    setSheetKey((k) => k + 1);
    setAdding(true);
  };

  // The root layout only shows the tabs once a pregnancy exists.
  if (!pregnancyId) return null;

  const all = meds.data ?? [];
  const taken = doses.data ?? [];
  const due = dueOn(all, day);
  const index = indexDoses(taken);
  const done = due.filter((m) => index.has(doseKey(m.id, day))).length;
  const loaded = meds.isSuccess && doses.isSuccess;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text muted style={styles.kicker}>
            Medicines &amp; supplements
          </Text>
          <Text variant="screenTitle" accessibilityRole="header">
            Vitamins
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Add medicine" onPress={openAdd} style={styles.addButton}>
          <PlusIcon />
        </Pressable>
      </View>

      <VaultNotice />

      {(meds.isError || doses.isError) && (
        <Text muted accessibilityRole="alert">
          Couldn&apos;t load your vitamins. Check your connection and try again.
        </Text>
      )}

      {loaded && due.length > 0 && (
        <StreakCard done={done} total={due.length} streak={streakOf(all, taken, day)} week={weekDots(all, taken, day)} />
      )}

      {loaded && due.length === 0 && (
        <Card dashed size="panel">
          <Text variant="label">Nothing here yet.</Text>
          <Text muted>Add the vitamins and medicines you take, then tick them off each day. Your partner sees the same list.</Text>
        </Card>
      )}

      {loaded &&
        due.length > 0 &&
        groupByTime(due).map((group) => (
          <View key={group.key} style={styles.group}>
            <Text style={styles.groupTitle} accessibilityRole="header">
              {group.label}
            </Text>
            {group.items.length === 0 && <Text muted>Nothing scheduled.</Text>}
            {group.items.map((med) => {
              const dose = index.get(doseKey(med.id, day));
              return (
                <MedRow
                  key={med.id}
                  med={med}
                  dose={dose}
                  who={dose ? tickedBy(dose, session?.user.id, members.data) : null}
                  onToggle={() => toggle.mutate({ medicationId: med.id, day, taken: !dose })}
                  onRemove={() =>
                    confirmRemove(
                      `Remove ${med.name}?`,
                      'It disappears for both of you, along with the days it was ticked off.',
                      () => remove.mutate(med.id),
                    )
                  }
                />
              );
            })}
          </View>
        ))}

      {(toggle.isError || remove.isError) && (
        <Text muted accessibilityRole="alert">
          Couldn&apos;t save that. Check your connection and try again.
        </Text>
      )}

      {loaded && (
        <Pressable accessibilityRole="button" onPress={openAdd} style={styles.addByHand}>
          <Text style={styles.addByHandText}>+ Add medicine by hand</Text>
        </Pressable>
      )}

      <AddSheet key={sheetKey} visible={adding} pregnancyId={pregnancyId} today={day} onClose={() => setAdding(false)} />
    </Screen>
  );
}

function StreakCard({ done, total, streak, week }: { done: number; total: number; streak: number; week: WeekDot[] }) {
  return (
    <Card tone={colors.yellow} size="panel" elevation="lg" style={styles.streakCard}>
      <View style={styles.ring} accessible accessibilityLabel={`${done} of ${total} taken today`}>
        <Text style={styles.ringNum}>
          {done}/{total}
        </Text>
        <Text style={styles.ringLabel}>TODAY</Text>
      </View>
      <View style={styles.streakText}>
        <Text style={styles.streakTitle}>{streak > 0 ? `${streak}-day streak` : 'Start a streak today'}</Text>
        <View style={styles.week}>
          {week.map((d) => (
            <View key={d.day} style={styles.dayCol} accessible accessibilityLabel={`${d.label}${d.isToday ? ' (today)' : ''}: ${d.done ? 'all taken' : 'not complete'}`}>
              <View style={styles.dotSlot}>
                {d.isToday && <View style={styles.todayRing} />}
                <View style={[styles.dot, d.done ? styles.dotDone : d.isToday && styles.dotToday]} />
              </View>
              <Text style={styles.dayLabel}>{d.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}

function MedRow({
  med,
  dose,
  who,
  onToggle,
  onRemove,
}: {
  med: Medication;
  dose: Dose | undefined;
  who: string | null;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const isTaken = !!dose;
  const line = doseLine(med);
  return (
    <View style={styles.medRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isTaken }}
        accessibilityLabel={`${med.name}, ${line}`}
        onPress={onToggle}
        style={[styles.medCard, isTaken ? styles.medCardTaken : { boxShadow: shadow.md }]}>
        <View style={[styles.pill, { backgroundColor: TINTS[tintIndex(med.id, TINTS.length)] }]}>
          <PillIcon />
        </View>
        <View style={styles.medText}>
          <Text style={styles.medName} numberOfLines={2}>
            {med.name}
          </Text>
          <Text muted style={styles.medDose} numberOfLines={2}>
            {line}
          </Text>
          {dose && who && (
            <Text variant="caption">
              {who} marked it taken · {timeOf(dose.taken_at)}
            </Text>
          )}
        </View>
        <View style={[styles.status, isTaken ? styles.statusTaken : styles.statusTake]}>
          <Text style={[styles.statusText, isTaken && { color: colors.surface }]}>{isTaken ? 'Taken' : 'Take'}</Text>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${med.name}`} onPress={onRemove} style={styles.trash}>
        <TrashIcon />
      </Pressable>
    </View>
  );
}

function AddSheet({
  visible,
  pregnancyId,
  today,
  onClose,
}: {
  visible: boolean;
  pregnancyId: string;
  today: string;
  onClose: () => void;
}) {
  const add = useAddMedication(pregnancyId);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [time, setTime] = useState<TimeOfDay>('morning');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const parsed = newMedicationRow({ name, dose, time }, today);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    add.mutate(parsed.row, { onSuccess: onClose });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add medicine">
      <View style={styles.fieldRow}>
        <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Vitamin B12" maxLength={NAME_MAX} returnKeyType="next" />
      </View>
      <View style={styles.fieldRow}>
        <TextField
          label="Dose & how to take"
          value={dose}
          onChangeText={setDose}
          placeholder="e.g. 1 tablet after lunch"
          maxLength={DOSE_MAX}
          returnKeyType="done"
          onSubmitEditing={save}
        />
      </View>
      <View style={styles.whenBlock}>
        <Text variant="label">When</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {TIMES.map((t) => (
            <Chip key={t.key} label={t.label} selected={time === t.key} onPress={() => setTime(t.key)} />
          ))}
        </View>
      </View>
      {(error || add.isError) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error ?? 'Couldn’t save. Check your connection and try again.'}
        </Text>
      )}
      <View style={styles.buttons}>
        <Button label="Cancel" onPress={onClose} style={styles.half} />
        <Button label={add.isPending ? 'Adding…' : 'Add'} variant="dark" disabled={add.isPending} onPress={save} style={styles.half} />
      </View>
    </BottomSheet>
  );
}

const DOT = 20;

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerText: { gap: 2, flexShrink: 1 },
  kicker: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.orange,
    boxShadow: shadow.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakCard: { borderRadius: 26, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 },
  ring: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.surface,
    borderWidth: border.width,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringNum: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32, color: colors.ink },
  ringLabel: { fontFamily: fonts.bodyHeavy, fontSize: 11, color: colors.ink },
  streakText: { flex: 1, gap: 8 },
  streakTitle: { fontFamily: fonts.display, fontSize: 20, lineHeight: 23, color: colors.ink },
  week: { flexDirection: 'row', gap: 6 },
  dayCol: { alignItems: 'center', gap: 4 },
  dotSlot: { width: DOT, height: DOT },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: border.width, borderColor: border.color },
  dotDone: { backgroundColor: colors.ink },
  dotToday: { backgroundColor: colors.surface },
  // The design circles today's dot with a ring that sits in the gaps either side.
  todayRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: DOT + 8,
    height: DOT + 8,
    borderRadius: (DOT + 8) / 2,
    borderWidth: border.width,
    borderColor: border.color,
  },
  dayLabel: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.ink },
  group: { gap: 10 },
  groupTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  medRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  medCard: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.card,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
  },
  medCardTaken: { backgroundColor: colors.line },
  pill: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: border.width,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medText: { flex: 1, gap: 1 },
  medName: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  medDose: { fontSize: 13 },
  status: {
    minWidth: 60,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: border.width,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTake: { backgroundColor: colors.yellow },
  statusTaken: { backgroundColor: colors.ink },
  statusText: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: colors.ink },
  trash: {
    width: 44,
    borderRadius: 14,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addByHand: {
    minHeight: 56,
    borderRadius: radius.card,
    borderWidth: border.width,
    borderStyle: 'dashed',
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addByHandText: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.ink },
  fieldRow: { flexDirection: 'row' },
  whenBlock: { gap: 6 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  error: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.purpleDark },
  buttons: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
});
