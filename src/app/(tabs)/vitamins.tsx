import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  BottomSheet,
  Button,
  Card,
  CheckIcon,
  Chip,
  PillIcon,
  PlusIcon,
  ScanCard,
  ScanIcon,
  ScanLine,
  Screen,
  Text,
  TextField,
  TrashIcon,
} from '@/components';
import { VaultNotice } from '@/components/VaultNotice';
import { confirmRemove } from '@/lib/confirm';
import {
  useAddMedication,
  useAddMedications,
  useDoses,
  useLocalToday,
  useMedications,
  useMembers,
  useMembership,
  useRemoveMedication,
  useToggleDose,
} from '@/lib/data';
import { timeOf } from '@/lib/format';
import { gestationalAge } from '@/lib/pregnancy';
import { FAILURE_TEXT, PICK_PROBLEM, ScanFailure, pickScanFile, type PickedFile, type ScanSource } from '@/lib/scan';
import { useSession } from '@/lib/session';
import { useScanPrescription } from '@/lib/useReports';
import { useVault } from '@/lib/vault/VaultProvider';
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
  rowsFromRx,
  rxItems,
  streakOf,
  tickedBy,
  tintIndex,
  untilLine,
  weekDots,
  type Dose,
  type Medication,
  type RxItem,
  type TimeOfDay,
  type WeekDot,
} from '@/lib/vitamins';
import { border, colors, fonts, radius, shadow } from '@/theme/tokens';

/** Pill colours from the design, picked per medicine so both phones agree. */
const TINTS = [colors.pink, colors.mint, colors.orange, colors.yellow, colors.lilac];

export default function VitaminsScreen() {
  const { session } = useSession();
  const membership = useMembership();
  const pregnancy = membership.data?.pregnancy;
  const pregnancyId = pregnancy?.id;
  const vault = useVault();
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
    setRx(null);
    setAdding(true);
  };
  // The prescription being read, and what to say once its medicines are in.
  const [rx, setRx] = useState<{ key: number; file: PickedFile } | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [pickProblem, setPickProblem] = useState<keyof typeof PICK_PROBLEM | null>(null);
  const scanRx = async (source: ScanSource) => {
    setPickProblem(null);
    setAdded(null);
    const result = await pickScanFile(source);
    if (result.status === 'picked') setRx((r) => ({ key: (r?.key ?? 0) + 1, file: result.file }));
    else if (result.status !== 'cancelled') setPickProblem(result.status);
  };

  // The root layout only shows the tabs once a pregnancy exists.
  if (!pregnancyId) return null;

  const all = meds.data ?? [];
  const taken = doses.data ?? [];
  const due = dueOn(all, day);
  const index = indexDoses(taken);
  const done = due.filter((m) => index.has(doseKey(m.id, day))).length;
  const loaded = meds.isSuccess && doses.isSuccess;
  const weeks = pregnancy?.lmp_date && pregnancy.lmp_date <= day ? gestationalAge(pregnancy.lmp_date, day).weeks : null;

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
        <ScanCard
          title="Scan a prescription"
          subtitle="AI adds each medicine with its dose and timing"
          icon={<ScanIcon />}
          iconTone={colors.mint}
          disabled={vault.state !== 'ready'}
          sources={[
            { label: 'Take a photo', onPress: () => scanRx('camera') },
            { label: 'Choose a photo', onPress: () => scanRx('library') },
            { label: 'PDF', onPress: () => scanRx('pdf') },
          ]}
        />
      )}
      {pickProblem && (
        <Text accessibilityRole="alert" style={styles.error}>
          {PICK_PROBLEM[pickProblem]}
        </Text>
      )}
      {added && (
        <View accessibilityRole="alert" style={styles.added}>
          <CheckIcon />
          <Text style={styles.addedText}>{added}</Text>
        </View>
      )}

      {loaded && (
        <Pressable accessibilityRole="button" onPress={openAdd} style={styles.addByHand}>
          <Text style={styles.addByHandText}>+ Add medicine by hand</Text>
        </Pressable>
      )}

      <AddSheet key={sheetKey} visible={adding} pregnancyId={pregnancyId} today={day} onClose={() => setAdding(false)} />
      {rx && (
        <RxSheet
          key={rx.key}
          file={rx.file}
          pregnancyId={pregnancyId}
          week={weeks !== null && weeks >= 1 && weeks <= 45 ? weeks : null}
          today={day}
          onClose={() => setRx(null)}
          onByHand={() => {
            setRx(null);
            // iOS won't show a sheet while another is still sliding away.
            setTimeout(openAdd, 400);
          }}
          onAdded={(count) => {
            setRx(null);
            setAdded(`${count === 1 ? '1 medicine' : `${count} medicines`} added from your prescription`);
          }}
        />
      )}
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
          {med.end_date && <Text variant="caption">{untilLine(med.end_date)}</Text>}
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

function RxSheet({
  file,
  pregnancyId,
  week,
  today,
  onClose,
  onByHand,
  onAdded,
}: {
  file: PickedFile;
  pregnancyId: string;
  week: number | null;
  today: string;
  onClose: () => void;
  onByHand: () => void;
  onAdded: (count: number) => void;
}) {
  const scan = useScanPrescription();
  const add = useAddMedications(pregnancyId);
  const [items, setItems] = useState<RxItem[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  const read = () =>
    scan.mutate({ pregnancyId, file, week }, { onSuccess: (draft) => setItems(rxItems(draft.meds)) });

  // Starts reading as soon as the sheet opens.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    read();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reading = scan.isPending || scan.isIdle;
  const failure = scan.error instanceof ScanFailure ? scan.error.code : 'failed';
  const draft = scan.data;
  const set = (index: number, patch: Partial<RxItem>) => setItems((all) => all.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const count = items.filter((i) => i.on && i.name.trim()).length;

  const submit = () => {
    const parsed = rowsFromRx(items, today);
    if (!parsed.ok) return setProblem(parsed.error);
    setProblem(null);
    add.mutate(parsed.rows, { onSuccess: () => onAdded(parsed.rows.length) });
  };

  const writtenOn = draft?.date
    ? new Date(`${draft.date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <BottomSheet visible onClose={onClose} title={reading ? 'Scanning prescription' : 'Check medicines'}>
      <View style={styles.fileRow}>
        <View style={styles.preview}>
          {file.mediaType === 'image' ? (
            <Image source={{ uri: file.uri }} style={styles.previewImage} accessibilityLabel="Prescription" />
          ) : (
            <Text style={styles.pdf}>PDF</Text>
          )}
          {reading && <ScanLine height={108} />}
        </View>
        <View style={styles.fileText}>
          {reading && (
            <>
              <Text style={styles.readingTitle} accessibilityLiveRegion="polite">
                Reading the handwriting…
              </Text>
              <Text muted style={styles.small}>
                Finding medicines, doses and timing
              </Text>
            </>
          )}
          {draft && (
            <>
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>Filled by AI · check before adding</Text>
              </View>
              {(draft.doctor || writtenOn) && <Text style={styles.medName}>{[draft.doctor, writtenOn].filter(Boolean).join(' · ')}</Text>}
              <Text muted style={styles.small}>
                {draft.meds.length === 1 ? '1 medicine found' : `${draft.meds.length} medicines found`}
              </Text>
            </>
          )}
        </View>
      </View>

      {reading && (
        <Text muted style={styles.small}>
          The file goes to Claude, Anthropic&apos;s AI, to be read. It isn&apos;t kept, and nothing is added until you check it.
        </Text>
      )}

      {scan.isError && (
        <View style={styles.failure}>
          <Text accessibilityRole="alert" style={styles.error}>
            {FAILURE_TEXT[failure]}
          </Text>
          <View style={styles.buttons}>
            {failure !== 'daily_limit' && failure !== 'not_set_up' && failure !== 'too_large' && (
              <Button label="Try again" onPress={read} style={styles.half} />
            )}
            <Button label="Add by hand" variant="dark" onPress={onByHand} style={styles.half} />
          </View>
        </View>
      )}

      {draft && draft.meds.length === 0 && (
        <Text accessibilityRole="alert" style={styles.error}>
          Couldn&apos;t find any medicines on it. Try a clearer photo, or add them by hand.
        </Text>
      )}
      {draft && draft.unreadable_lines.length > 0 && (
        <View style={styles.unreadable}>
          <Text style={styles.unreadableTitle}>Couldn&apos;t read clearly, check the paper:</Text>
          {draft.unreadable_lines.map((line, i) => (
            <Text key={i} style={styles.small}>
              · {line}
            </Text>
          ))}
        </View>
      )}

      {items.map((item, i) => (
        <View key={i} style={[styles.rxCard, !item.on && styles.rxCardOff]}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.on }}
            accessibilityLabel={`Include ${item.name || 'this medicine'}`}
            onPress={() => set(i, { on: !item.on })}
            style={[styles.rxBox, item.on && styles.rxBoxOn]}>
            {item.on && <CheckIcon />}
          </Pressable>
          <View style={styles.rxFields}>
            <TextInput
              accessibilityLabel="Medicine name"
              value={item.name}
              onChangeText={(t) => set(i, { name: t })}
              maxLength={NAME_MAX}
              style={[styles.rxInput, styles.rxName]}
            />
            <TextInput
              accessibilityLabel={`Dose for ${item.name}`}
              value={item.dose}
              onChangeText={(t) => set(i, { dose: t })}
              placeholder="As prescribed"
              placeholderTextColor={colors.inkMuted}
              maxLength={DOSE_MAX}
              style={[styles.rxInput, styles.rxDose]}
            />
            <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={`When to take ${item.name}`}>
              {TIMES.map((t) => (
                <Chip key={t.key} label={t.label} selected={item.time === t.key} onPress={() => set(i, { time: t.key })} />
              ))}
            </View>
            <View style={styles.daysRow}>
              <Text muted style={styles.small}>
                For
              </Text>
              <TextInput
                accessibilityLabel={`Days to take ${item.name}`}
                value={item.days}
                onChangeText={(t) => set(i, { days: t })}
                placeholder="—"
                placeholderTextColor={colors.inkMuted}
                keyboardType="number-pad"
                maxLength={3}
                style={[styles.rxInput, styles.daysInput]}
              />
              <Text muted style={styles.small}>
                {item.days.trim() ? 'days' : 'days (empty: ongoing)'}
              </Text>
            </View>
            {!!item.written && <Text variant="caption">Written as “{item.written}”</Text>}
          </View>
        </View>
      ))}
      {items.length > 0 && <Text variant="caption">AI can misread handwriting. Match each line with the paper before adding.</Text>}

      {(problem || add.isError) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {problem ?? 'Couldn’t add them. Try again.'}
        </Text>
      )}
      <View style={styles.buttons}>
        <Button label="Cancel" onPress={onClose} style={styles.half} />
        {!scan.isError && (
          <Button
            label={reading ? 'Reading…' : add.isPending ? 'Adding…' : count === 1 ? 'Add 1 medicine' : `Add ${count} medicines`}
            variant="dark"
            disabled={reading || add.isPending || count === 0}
            onPress={submit}
            style={styles.half}
          />
        )}
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
  added: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.mint,
  },
  addedText: { flex: 1, fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.ink },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  preview: {
    width: 84,
    height: 108,
    borderRadius: 16,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: { width: '100%', height: '100%' },
  pdf: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: colors.ink },
  fileText: { flex: 1, minWidth: 0, gap: 4 },
  readingTitle: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.ink },
  small: { fontSize: 13 },
  aiBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.yellow,
  },
  aiBadgeText: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.ink },
  failure: { gap: 12 },
  unreadable: { gap: 2, padding: 12, borderRadius: 16, backgroundColor: colors.line },
  unreadableTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  rxCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 20,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
  },
  rxCardOff: { opacity: 0.55 },
  rxBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rxBoxOn: { backgroundColor: colors.mint },
  rxFields: { flex: 1, minWidth: 0, gap: 6 },
  rxInput: {
    borderBottomWidth: border.width,
    borderBottomColor: colors.lilac,
    borderStyle: 'dashed',
    paddingVertical: 4,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  rxName: { fontFamily: fonts.bodyHeavy, fontSize: 16 },
  rxDose: { fontSize: 14 },
  daysRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  daysInput: { width: 52, fontSize: 15, textAlign: 'center' },
});
