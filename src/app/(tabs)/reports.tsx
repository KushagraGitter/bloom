import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet, Button, Card, Chip, CrossIcon, ReportIcon, Screen, Text, TextField, TrashIcon, UploadIcon } from '@/components';
import { VaultGate } from '@/components/VaultGate';
import { confirmRemove } from '@/lib/confirm';
import { useLocalToday, useMembers, useMembership } from '@/lib/data';
import { loggedBy } from '@/lib/meals';
import { gestationalAge } from '@/lib/pregnancy';
import {
  FILTERS,
  NAME_MAX,
  PLACE_MAX,
  QUESTION_MAX,
  REPORT_KINDS,
  RESULT_MAX,
  TITLE_MAX,
  blankForm,
  cleanQuestion,
  formFromDraft,
  kindOf,
  metaLine,
  newValue,
  reportFromForm,
  type ReportForm,
  type ReportKind,
} from '@/lib/reports';
import { FAILURE_TEXT, ScanFailure, pickReportFile, type PickedFile, type ScanSource } from '@/lib/scan';
import { useSession } from '@/lib/session';
import {
  useAddQuestion,
  useQuestions,
  useRemoveReportItem,
  useReports,
  useSaveReport,
  useScanReport,
  type SavedQuestion,
  type SavedReport,
} from '@/lib/useReports';
import { useVault } from '@/lib/vault/VaultProvider';
import { border, colors, fonts, radius, shadow } from '@/theme/tokens';

const PICK_PROBLEM = {
  denied: 'Bloom needs permission to use the camera or photos. You can allow it in your phone’s Settings.',
  too_large: 'That PDF is over 10 MB. Try a photo of each page instead.',
} as const;

export default function ReportsScreen() {
  const { session } = useSession();
  const membership = useMembership();
  const pregnancy = membership.data?.pregnancy;
  const pregnancyId = pregnancy?.id;
  const members = useMembers(pregnancyId);
  const vault = useVault();
  const today = useLocalToday();
  const reports = useReports(pregnancyId);
  const questions = useQuestions(pregnancyId);
  const remove = useRemoveReportItem(pregnancyId);
  const [filter, setFilter] = useState<ReportKind | null>(null);
  // A new key each time the sheet opens gives it fresh fields and a fresh scan.
  const [sheet, setSheet] = useState<{ key: number; file: PickedFile | null } | null>(null);
  const [pickProblem, setPickProblem] = useState<keyof typeof PICK_PROBLEM | null>(null);

  // The root layout only shows the tabs once a pregnancy exists.
  if (!pregnancyId || !pregnancy) return null;

  const ready = vault.state === 'ready';
  const week = gestationalAge(pregnancy.lmp_date, today).weeks;
  const open = (file: PickedFile | null) => setSheet((s) => ({ key: (s?.key ?? 0) + 1, file }));

  const pick = async (source: ScanSource) => {
    setPickProblem(null);
    const result = await pickReportFile(source);
    if (result.status === 'picked') open(result.file);
    else if (result.status !== 'cancelled') setPickProblem(result.status);
  };

  const shown = (reports.data ?? []).filter((r) => !filter || r.data.kind === filter);

  return (
    <Screen keyboardAware>
      <View style={styles.header}>
        <Text muted style={styles.kicker}>
          Scans, tests and doctor notes
        </Text>
        <Text variant="screenTitle" accessibilityRole="header">
          Health reports
        </Text>
      </View>

      <VaultGate what="reports">
        <View style={styles.upload}>
          <View style={styles.uploadTop}>
            <View style={styles.uploadIcon}>
              <UploadIcon />
            </View>
            <View style={styles.uploadText}>
              <Text style={styles.uploadTitle} accessibilityRole="header">
                Upload a report
              </Text>
              <Text style={styles.uploadSub}>Photo or PDF · AI reads the values for you</Text>
            </View>
          </View>
          <View style={styles.sources}>
            <SourceButton label="Take a photo" onPress={() => pick('camera')} disabled={!ready} />
            <SourceButton label="Choose a photo" onPress={() => pick('library')} disabled={!ready} />
            <SourceButton label="PDF" onPress={() => pick('pdf')} disabled={!ready} />
          </View>
        </View>
        {pickProblem && (
          <Text accessibilityRole="alert" style={styles.problem}>
            {PICK_PROBLEM[pickProblem]}
          </Text>
        )}
        <Pressable accessibilityRole="button" onPress={() => open(null)} style={styles.byHand}>
          <Text style={styles.byHandText}>or add one by hand</Text>
        </Pressable>

        <View style={styles.filters} accessibilityRole="tablist" accessibilityLabel="Filter">
          {FILTERS.map((f) => (
            <Chip key={f.label} label={f.label} selected={filter === f.kind} onPress={() => setFilter(f.kind)} />
          ))}
        </View>

        {(reports.isError || questions.isError) && (
          <Text muted accessibilityRole="alert">
            Couldn&apos;t load your reports. Close Bloom and open it again.
          </Text>
        )}
        {remove.isError && (
          <Text muted accessibilityRole="alert">
            Couldn&apos;t remove that. Try again.
          </Text>
        )}

        {reports.isSuccess && (
          <View style={styles.list}>
            {shown.length === 0 && (
              <Text muted>
                {reports.data.length === 0
                  ? 'Reports you add show here, with their results and the lab’s ranges.'
                  : 'No reports of this kind yet.'}
              </Text>
            )}
            {shown.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                who={loggedBy(r.data, session?.user.id, members.data)}
                onRemove={() =>
                  confirmRemove(`Remove “${r.data.title}”?`, 'It disappears for both of you.', () => remove.mutate(r.id))
                }
              />
            ))}
          </View>
        )}

        {questions.isSuccess && (
          <QuestionsCard pregnancyId={pregnancyId} questions={questions.data} onRemove={(id) => remove.mutate(id)} />
        )}
      </VaultGate>

      {sheet && (
        <ReportSheet
          key={sheet.key}
          file={sheet.file}
          pregnancyId={pregnancyId}
          lmpDate={pregnancy.lmp_date}
          today={today}
          week={week}
          by={session?.user.id ?? ''}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            setFilter(null);
          }}
        />
      )}
    </Screen>
  );
}

function SourceButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.source, pressed && styles.pressed]}>
      <Text style={styles.sourceText}>{label}</Text>
    </Pressable>
  );
}

function ReportCard({ report, who, onRemove }: { report: SavedReport; who: string | null; onRemove: () => void }) {
  const r = report.data;
  const kind = kindOf(r.kind);
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: kind.tone }]}>
          <ReportIcon />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{r.title}</Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {metaLine(r)}
          </Text>
        </View>
        <Text style={styles.badge}>{kind.badge}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${r.title}`} hitSlop={8} onPress={onRemove} style={styles.remove}>
          <TrashIcon />
        </Pressable>
      </View>
      {!!r.summary && (
        <View style={styles.summary}>
          <Text style={styles.aiPill}>AI</Text>
          <View style={styles.summaryText}>
            <Text style={styles.summaryBody}>{r.summary}</Text>
            <Text style={styles.disclaimer}>Not a diagnosis. Go over results with your doctor.</Text>
          </View>
        </View>
      )}
      {r.values.length > 0 && (
        <View style={styles.values}>
          {r.values.map((v, i) => (
            <View key={`${v.name}-${i}`} style={styles.value}>
              <Text style={styles.valueName}>{v.name}</Text>
              <Text style={styles.valueResult}>{v.value}</Text>
              {!!v.range && <Text style={styles.valueRange}>Lab range {v.range}</Text>}
              {v.flagged && <Text style={styles.flag}>Marked on the report</Text>}
            </View>
          ))}
        </View>
      )}
      {who && <Text variant="caption">Added by {who}</Text>}
    </View>
  );
}

function QuestionsCard({
  pregnancyId,
  questions,
  onRemove,
}: {
  pregnancyId: string;
  questions: SavedQuestion[];
  onRemove: (id: string) => void;
}) {
  const add = useAddQuestion(pregnancyId);
  const [draft, setDraft] = useState('');
  const submit = () => {
    const text = cleanQuestion(draft);
    if (!text) return;
    add.mutate(text, { onSuccess: () => setDraft('') });
  };
  return (
    <Card size="card" tone={colors.pink} style={styles.questions}>
      <Text style={styles.questionsTitle} accessibilityRole="header">
        Questions for next visit
      </Text>
      {questions.length === 0 && <Text style={styles.questionText}>Jot down anything to ask the doctor.</Text>}
      {questions.map((q) => (
        <View key={q.id} style={styles.question}>
          <Text style={styles.questionText}>· {q.text}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove question: ${q.text}`} onPress={() => onRemove(q.id)} style={styles.questionRemove}>
            <CrossIcon color={colors.ink} size={16} />
          </Pressable>
        </View>
      ))}
      <View style={styles.addRow}>
        <TextInput
          accessibilityLabel="New question"
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a question"
          placeholderTextColor={colors.inkMuted}
          maxLength={QUESTION_MAX}
          returnKeyType="done"
          onSubmitEditing={submit}
          style={[styles.field, styles.grow]}
        />
        <Button label="Add" variant="dark" disabled={add.isPending || !cleanQuestion(draft)} onPress={submit} />
      </View>
      {add.isError && (
        <Text accessibilityRole="alert" style={styles.error}>
          Couldn&apos;t add that. Try again.
        </Text>
      )}
    </Card>
  );
}

function ReportSheet({
  file,
  pregnancyId,
  lmpDate,
  today,
  week,
  by,
  onClose,
  onSaved,
}: {
  file: PickedFile | null;
  pregnancyId: string;
  lmpDate: string;
  today: string;
  week: number;
  by: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const scan = useScanReport();
  const save = useSaveReport(pregnancyId);
  const [form, setForm] = useState<ReportForm>(() => blankForm(file?.name ?? ''));
  const [byHand, setByHand] = useState(!file);
  const [problem, setProblem] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newResult, setNewResult] = useState('');

  const read = () => {
    if (!file) return;
    scan.mutate(
      { pregnancyId, file, week: week >= 1 && week <= 45 ? week : null },
      {
        onSuccess: (draft) => {
          setForm(formFromDraft(draft, file.name, lmpDate, today));
        },
      },
    );
  };

  // Starts reading as soon as the sheet opens with a file.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    read();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reading = !byHand && (scan.isPending || scan.isIdle);
  const failed = !byHand && scan.isError;
  const failure = scan.error instanceof ScanFailure ? scan.error.code : 'failed';
  const fromAi = form.source === 'ai';
  const title = reading ? 'Scanning report' : fromAi ? 'Check your report' : 'Add a report';
  const set = (patch: Partial<ReportForm>) => setForm((f) => ({ ...f, ...patch }));

  const addValue = () => {
    const v = newValue(newName, newResult);
    if (!v) return;
    set({ values: [...form.values, v] });
    setNewName('');
    setNewResult('');
  };

  const submit = () => {
    // A value typed but not yet added with + is saved too.
    const pending = newValue(newName, newResult);
    const report = reportFromForm(pending ? { ...form, values: [...form.values, pending] } : form, by);
    if (report === 'title') return setProblem('Give the report a name.');
    if (report === 'week') return setProblem('The week should be a number from 1 to 42.');
    setProblem(null);
    save.mutate(report, { onSuccess: onSaved });
  };

  return (
    <BottomSheet visible onClose={onClose} title={title}>
      {file && (
        <View style={styles.fileRow}>
          <View style={styles.preview}>
            {file.mediaType === 'image' ? (
              <Image source={{ uri: file.uri }} style={styles.previewImage} accessibilityLabel="Report preview" />
            ) : (
              <Text style={styles.pdf}>PDF</Text>
            )}
            {reading && <ScanLine />}
          </View>
          <View style={styles.fileText}>
            <Text style={styles.fileName} numberOfLines={1}>
              {file.name}
            </Text>
            {reading && (
              <>
                <Text style={styles.readingTitle} accessibilityLiveRegion="polite">
                  Reading your report…
                </Text>
                <Text muted style={styles.small}>
                  Finding test names, results and ranges
                </Text>
              </>
            )}
            {!reading && fromAi && (
              <>
                <Text style={styles.aiDone}>Filled by AI · check &amp; edit</Text>
                <Text muted style={styles.small}>
                  {form.values.length === 1 ? '1 value found' : `${form.values.length} values found`}
                </Text>
              </>
            )}
          </View>
        </View>
      )}

      {reading && (
        <Text muted style={styles.small}>
          The file goes to Claude, Anthropic&apos;s AI, to be read. It isn&apos;t kept, and nothing is saved until you check it.
        </Text>
      )}

      {failed && (
        <View style={styles.failure}>
          <Text accessibilityRole="alert" style={styles.failureText}>
            {FAILURE_TEXT[failure]}
          </Text>
          <View style={styles.buttons}>
            {failure !== 'daily_limit' && failure !== 'not_set_up' && failure !== 'too_large' && (
              <Button label="Try again" onPress={read} style={styles.half} />
            )}
            <Button label="Fill it in by hand" variant="dark" onPress={() => setByHand(true)} style={styles.half} />
          </View>
        </View>
      )}

      {!reading && !failed && (
        <>
          {form.unreadable.length > 0 && (
            <View style={styles.unreadable}>
              <Text style={styles.unreadableTitle}>Couldn&apos;t read clearly, check the report:</Text>
              {form.unreadable.map((line, i) => (
                <Text key={i} style={styles.small}>
                  · {line}
                </Text>
              ))}
            </View>
          )}
          <View style={styles.fieldRow}>
            <TextField
              label="Report name"
              value={form.title}
              onChangeText={(t) => set({ title: t })}
              placeholder="e.g. Growth scan"
              maxLength={TITLE_MAX}
            />
          </View>
          <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Type">
            {REPORT_KINDS.map((k) => (
              <Chip key={k.key} label={k.label} selected={form.kind === k.key} onPress={() => set({ kind: k.key })} />
            ))}
          </View>
          <View style={styles.fieldRow}>
            <TextField
              label="Week"
              value={form.week}
              onChangeText={(t) => set({ week: t })}
              placeholder={String(Math.min(Math.max(week, 1), 42))}
              keyboardType="number-pad"
              maxLength={2}
            />
            <TextField label="Lab / clinic" value={form.place} onChangeText={(t) => set({ place: t })} placeholder="Optional" maxLength={PLACE_MAX} />
          </View>

          {!!form.summary && (
            <View style={styles.sheetSummary}>
              <Text style={styles.overline}>PLAIN-LANGUAGE SUMMARY</Text>
              <Text style={styles.summaryBody}>{form.summary}</Text>
              <Text style={styles.disclaimer}>Not a diagnosis. Go over results with your doctor.</Text>
            </View>
          )}

          <View style={styles.valuesEdit}>
            <Text variant="label">Values</Text>
            {form.values.map((v, i) => (
              <View key={`${v.name}-${i}`} style={styles.valueEdit}>
                <View style={styles.grow}>
                  <Text style={styles.valueEditName}>
                    {v.name}
                    {v.range ? ` · range ${v.range}` : ''}
                    {v.flagged ? ' · marked' : ''}
                  </Text>
                  <TextInput
                    accessibilityLabel={`${v.name} result`}
                    value={v.value}
                    onChangeText={(t) => set({ values: form.values.map((x, j) => (j === i ? { ...x, value: t } : x)) })}
                    maxLength={RESULT_MAX}
                    style={styles.valueEditInput}
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${v.name}`}
                  onPress={() => set({ values: form.values.filter((_, j) => j !== i) })}
                  style={styles.questionRemove}>
                  <CrossIcon color={colors.ink} size={16} />
                </Pressable>
              </View>
            ))}
            <View style={styles.addRow}>
              <TextInput
                accessibilityLabel="Test name"
                value={newName}
                onChangeText={setNewName}
                placeholder="Test"
                placeholderTextColor={colors.inkMuted}
                maxLength={NAME_MAX}
                style={[styles.field, styles.grow]}
              />
              <TextInput
                accessibilityLabel="Result"
                value={newResult}
                onChangeText={setNewResult}
                placeholder="Result"
                placeholderTextColor={colors.inkMuted}
                maxLength={RESULT_MAX}
                onSubmitEditing={addValue}
                style={[styles.field, styles.grow]}
              />
              <Button label="+" accessibilityLabel="Add value" onPress={addValue} />
            </View>
          </View>
        </>
      )}

      {(problem || save.isError) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {problem ?? 'Couldn’t save. Try again.'}
        </Text>
      )}
      <View style={styles.buttons}>
        <Button label="Cancel" onPress={onClose} style={styles.half} />
        {!failed && (
          <Button
            label={save.isPending ? 'Saving…' : 'Save report'}
            variant="dark"
            disabled={reading || save.isPending}
            onPress={submit}
            style={styles.half}
          />
        )}
      </View>
    </BottomSheet>
  );
}

/** The design's yellow line sweeping over the file while it is read. */
function ScanLine() {
  const [y] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: 100, duration: 700, useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [y]);
  return <Animated.View style={[styles.scanLine, { transform: [{ translateY: y }] }]} />;
}

const styles = StyleSheet.create({
  header: { gap: 2 },
  kicker: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  upload: {
    gap: 14,
    padding: 16,
    borderRadius: radius.panel,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.purple,
    boxShadow: shadow.lg,
  },
  uploadTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  uploadIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: { flex: 1, gap: 2 },
  uploadTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.surface },
  uploadSub: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.surface },
  sources: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  source: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.ink },
  pressed: { opacity: 0.8 },
  problem: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.purpleDark },
  byHand: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: -8, paddingHorizontal: 4 },
  byHandText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.purple },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { gap: 12 },
  card: {
    gap: 10,
    padding: 14,
    borderRadius: radius.card,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: border.width,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, minWidth: 0, gap: 1 },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  cardMeta: { fontSize: 13, color: colors.inkMuted },
  badge: {
    fontFamily: fonts.bodyHeavy,
    fontSize: 11,
    color: colors.ink,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.ground,
    overflow: 'hidden',
  },
  remove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  summary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: '#FFF4C7',
  },
  aiPill: {
    fontFamily: fonts.bodyHeavy,
    fontSize: 10,
    color: colors.ink,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: border.color,
    backgroundColor: colors.yellow,
    overflow: 'hidden',
  },
  summaryText: { flex: 1, gap: 4 },
  summaryBody: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.ink },
  disclaimer: { fontSize: 12, color: colors.inkMuted },
  values: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  value: { flexBasis: '47%', flexGrow: 1, gap: 2, padding: 10, borderRadius: 14, backgroundColor: colors.ground },
  valueName: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted },
  valueResult: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  valueRange: { fontSize: 11, color: colors.inkMuted },
  flag: { fontFamily: fonts.bodyHeavy, fontSize: 11, color: colors.purpleDark },
  questions: { gap: 10 },
  questionsTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  question: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  questionText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  questionRemove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  field: {
    minHeight: 48,
    borderRadius: radius.field,
    borderWidth: border.width,
    borderColor: border.color,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  grow: { flex: 1, minWidth: 0 },
  error: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.purpleDark },
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
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.yellow,
  },
  fileText: { flex: 1, minWidth: 0, gap: 4 },
  fileName: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkMuted },
  readingTitle: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.ink },
  small: { fontSize: 13 },
  aiDone: {
    alignSelf: 'flex-start',
    fontFamily: fonts.bodyHeavy,
    fontSize: 12,
    color: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.yellow,
    overflow: 'hidden',
  },
  failure: { gap: 12 },
  failureText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  unreadable: {
    gap: 4,
    padding: 12,
    borderRadius: 16,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
  },
  unreadableTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  fieldRow: { flexDirection: 'row', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sheetSummary: {
    gap: 6,
    padding: 12,
    borderRadius: 16,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: '#FFF4C7',
  },
  overline: { fontFamily: fonts.bodyHeavy, fontSize: 12, letterSpacing: 1, color: colors.ink },
  valuesEdit: { gap: 8 },
  valueEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 4,
    borderRadius: 14,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
  },
  valueEditName: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted },
  valueEditInput: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: colors.ink, paddingVertical: 4, minHeight: 36 },
  buttons: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
});
