import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BackButton,
  BottomSheet,
  Button,
  Card,
  Chip,
  DateField,
  OptionCard,
  Text,
  TextField,
  Toggle,
} from '@/components';
import { signOut } from '@/lib/auth';
import { useCreatePregnancy, useFinishOnboarding, useJoinWithCode, useProfile } from '@/lib/data';
import {
  BABY_OPTIONS,
  BLOOD_GROUPS,
  CONDITIONS,
  datingFor,
  emptyAnswers,
  FIRST_OPTIONS,
  REMINDERS,
  SEX_OPTIONS,
  toggleCondition,
  type Answers,
  type Method,
} from '@/lib/onboarding';
import { localToday } from '@/lib/pregnancy';
import { useSession } from '@/lib/session';
import { border, colors, fonts, radius, shadow } from '@/theme/tokens';

const STEPS = ['name', 'method', 'date', 'about', 'health', 'team', 'reminders'] as const;
type Step = (typeof STEPS)[number] | 'done';

const METHODS: { id: Method; label: string; sub: string }[] = [
  { id: 'lmp', label: 'First day of my last period', sub: 'Most common' },
  { id: 'due', label: 'I already know my due date', sub: 'From my doctor or a scan' },
  { id: 'ivf', label: 'IVF transfer date', sub: 'Day 3 or day 5 embryo' },
];

const DATE_COPY: Record<Method, { question: string; label: string }> = {
  lmp: { question: 'When did your last period start?', label: 'First day of last period' },
  due: { question: 'What’s your due date?', label: 'Due date' },
  ivf: { question: 'When was your embryo transfer?', label: 'Transfer date' },
};

function formatDate(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function OnboardingScreen() {
  const { session } = useSession();
  const profile = useProfile();
  const [step, setStep] = useState<Step>('name');
  const [draft, setDraft] = useState<Answers>(emptyAnswers);
  const [nameEdited, setNameEdited] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const create = useCreatePregnancy();
  const finish = useFinishOnboarding();

  // Start from the name Google gave us until the user types their own.
  const a: Answers = nameEdited ? draft : { ...draft, name: profile.data?.name ?? '' };

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

  const today = localToday();
  const dating = datingFor(a, today);
  const firstName = (a.name.trim() || 'there').split(' ')[0];

  if (step === 'done') {
    return <Done answers={a} firstName={firstName} weeks={dating.ok ? dating.age.weeks : 0} onFinish={finish} />;
  }

  const index = STEPS.indexOf(step);
  const canContinue =
    step === 'name' ? !!a.name.trim() : step === 'date' ? dating.ok : step === 'about' ? a.first !== '' : true;
  const canSkip = step === 'health' || step === 'team';
  const isLast = step === 'reminders';

  const next = async () => {
    if (!canContinue || create.isPending) return;
    if (!isLast) {
      setStep(STEPS[index + 1]);
      return;
    }
    try {
      await create.mutateAsync(a);
      setStep('done');
    } catch {
      // The error is shown from create.error below.
    }
  };

  const back = () => {
    if (index === 0) {
      signOut().catch(() => {});
    } else {
      setStep(STEPS[index - 1]);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.top}>
        <BackButton onPress={back} />
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Setup progress"
          accessibilityValue={{ min: 0, max: STEPS.length, now: index + 1 }}
          style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(((index + 1) / STEPS.length) * 100)}%` }]} />
        </View>
        <Text style={styles.count}>
          {index + 1}/{STEPS.length}
        </Text>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {step === 'name' && (
            <>
              {session?.user.email ? (
                <View style={styles.badge}>
                  <Text variant="label">Signed in as {session.user.email}</Text>
                </View>
              ) : null}
              <Question>First things first, what should we call you?</Question>
              <TextField
                label="Your name"
                value={a.name}
                onChangeText={(v) => {
                  setNameEdited(true);
                  set('name', v);
                }}
                placeholder="e.g. Ananya"
                autoComplete="given-name"
                textContentType="givenName"
                returnKeyType="next"
                onSubmitEditing={next}
              />
              <Card tone={colors.surface} style={styles.joinCard}>
                <Text variant="label">Joining your partner&apos;s Bloom?</Text>
                <Text variant="caption">If they&apos;ve already set it up, use the 6-digit code from their Profile.</Text>
                <Button label="I have an invite code" onPress={() => setJoinOpen(true)} />
              </Card>
            </>
          )}

          {step === 'method' && (
            <>
              <Question>Hi {firstName}! How should we work out your due date?</Question>
              <View accessibilityRole="radiogroup" style={styles.stack}>
                {METHODS.map((m) => (
                  <OptionCard
                    key={m.id}
                    label={m.label}
                    sub={m.sub}
                    selected={a.method === m.id}
                    onPress={() => setDraft((prev) => ({ ...prev, method: m.id, date: prev.method === m.id ? prev.date : '' }))}
                  />
                ))}
              </View>
            </>
          )}

          {step === 'date' && (
            <>
              <Question>{DATE_COPY[a.method].question}</Question>
              <DateField label={DATE_COPY[a.method].label} value={a.date} onChange={(v) => set('date', v)} />
              {a.method === 'ivf' && (
                <Group label="Embryo age at transfer">
                  {([3, 5] as const).map((n) => (
                    <Chip key={n} label={`Day ${n}`} selected={a.embryoDay === n} onPress={() => set('embryoDay', n)} />
                  ))}
                </Group>
              )}
              {dating.ok && (
                <Card tone={colors.purple} size="panel" elevation="lg" style={styles.result}>
                  <View style={styles.resultBadge}>
                    <Text style={styles.resultNum}>{dating.age.weeks}</Text>
                    <Text style={styles.resultLbl}>WEEKS</Text>
                  </View>
                  <View style={styles.resultText}>
                    <Text style={styles.resultTitle} color={colors.surface}>
                      {dating.age.weeks} weeks, {dating.age.days} days
                    </Text>
                    <Text variant="label" color={colors.surface}>
                      Due {formatDate(dating.dueDate)}
                    </Text>
                    <Text variant="label" color={colors.surface}>
                      {['First', 'Second', 'Third'][dating.age.trimester - 1]} trimester
                    </Text>
                  </View>
                </Card>
              )}
              {!!a.date && !dating.ok && (
                <Card tone={colors.pink} accessibilityLiveRegion="polite">
                  <Text variant="label">That date doesn&apos;t look right. Check the year and try again.</Text>
                </Card>
              )}
              <Hint>Your doctor may adjust this after a scan. You can change it any time in Profile.</Hint>
            </>
          )}

          {step === 'about' && (
            <>
              <Question>A little about this pregnancy</Question>
              <Group label="Is this your first pregnancy?">
                {FIRST_OPTIONS.map((o) => (
                  <Chip key={o} label={o} selected={a.first === o} onPress={() => set('first', o)} />
                ))}
              </Group>
              <Group label="How many babies?">
                {BABY_OPTIONS.map((o) => (
                  <Chip key={o} label={o} selected={a.babies === o} onPress={() => set('babies', o)} />
                ))}
              </Group>
              <Group label="Baby's sex">
                {SEX_OPTIONS.map((o) => (
                  <Chip key={o} label={o} selected={a.sex === o} onPress={() => set('sex', o)} />
                ))}
              </Group>
              <TextField
                label="Baby's nickname (optional)"
                value={a.nickname}
                onChangeText={(v) => set('nickname', v)}
                placeholder="e.g. Peanut"
              />
            </>
          )}

          {step === 'health' && (
            <>
              <Question>Your health basics</Question>
              <Hint>Used for weight-gain tracking and to share with your doctor. All optional.</Hint>
              <View style={styles.row}>
                <TextField
                  label="Height (cm)"
                  value={a.heightCm}
                  onChangeText={(v) => set('heightCm', v)}
                  placeholder="162"
                  keyboardType="decimal-pad"
                />
                <TextField
                  label="Weight before (kg)"
                  value={a.preWeightKg}
                  onChangeText={(v) => set('preWeightKg', v)}
                  placeholder="59"
                  keyboardType="decimal-pad"
                />
              </View>
              <Group label="Blood group">
                {BLOOD_GROUPS.map((o) => (
                  <Chip key={o} label={o} selected={a.bloodGroup === o} onPress={() => set('bloodGroup', o)} />
                ))}
              </Group>
              <Group label="Anything your doctor is keeping an eye on?" multi>
                {CONDITIONS.map((o) => (
                  <Chip
                    key={o}
                    label={o}
                    mode="toggle"
                    selected={a.conditions.includes(o)}
                    onPress={() => set('conditions', toggleCondition(a.conditions, o))}
                  />
                ))}
              </Group>
            </>
          )}

          {step === 'team' && (
            <>
              <Question>Who&apos;s on your care team?</Question>
              <Hint>Handy for one-tap calls and sharing summaries. Optional.</Hint>
              <TextField label="Doctor / midwife" value={a.doctor} onChangeText={(v) => set('doctor', v)} placeholder="Dr. …" />
              <TextField
                label="Hospital or clinic"
                value={a.hospital}
                onChangeText={(v) => set('hospital', v)}
                placeholder="Where you'll deliver"
              />
              <View style={styles.row}>
                <TextField
                  label="Emergency contact"
                  value={a.emergencyContact}
                  onChangeText={(v) => set('emergencyContact', v)}
                  placeholder="Name"
                  autoComplete="name"
                />
                <TextField
                  label="Their phone"
                  value={a.emergencyPhone}
                  onChangeText={(v) => set('emergencyPhone', v)}
                  placeholder="+91 …"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                />
              </View>
            </>
          )}

          {step === 'reminders' && (
            <>
              <Question>Which reminders would help?</Question>
              <Card style={styles.reminders}>
                {REMINDERS.map((r, i) => (
                  <View key={r.kind} style={[styles.reminder, i < REMINDERS.length - 1 && styles.reminderLine]}>
                    <View style={styles.flex}>
                      <Text style={styles.reminderLabel}>{r.label}</Text>
                      <Text variant="caption">{r.sub}</Text>
                    </View>
                    <Toggle
                      label={r.label}
                      value={a.reminders[r.kind]}
                      onValueChange={(v) => set('reminders', { ...a.reminders, [r.kind]: v })}
                    />
                  </View>
                ))}
              </Card>
              <Hint>
                {Object.values(a.reminders).some(Boolean)
                  ? "We'll ask your phone for permission to send notifications next. You can change these any time."
                  : 'No reminders for now. You can switch them on any time in Profile.'}
              </Hint>
              {create.error && (
                <Card tone={colors.pink} accessibilityLiveRegion="polite">
                  <Text variant="label">Couldn&apos;t save: {create.error.message}</Text>
                </Card>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Button
          label={isLast ? (create.isPending ? 'Saving…' : 'Finish setup') : 'Continue'}
          variant="cta"
          disabled={!canContinue || create.isPending}
          onPress={next}
        />
        {canSkip && <Button label="Skip for now" onPress={() => setStep(STEPS[index + 1])} style={styles.skip} />}
      </View>

      <JoinSheet visible={joinOpen} onClose={() => setJoinOpen(false)} />
    </SafeAreaView>
  );
}

function Question({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.q}>
      {children}
    </Text>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <Text muted style={styles.hint}>{children}</Text>;
}

function Group({ label, children, multi }: { label: string; children: React.ReactNode; multi?: boolean }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View accessibilityRole={multi ? undefined : 'radiogroup'} accessibilityLabel={label} style={styles.chips}>
        {children}
      </View>
    </View>
  );
}

function JoinSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [code, setCode] = useState('');
  const join = useJoinWithCode();
  const [notFound, setNotFound] = useState(false);
  const valid = /^\d{6}$/.test(code);

  const submit = async () => {
    if (!valid || join.isPending) return;
    setNotFound(false);
    try {
      const joined = await join.mutateAsync(code);
      // On success the membership refreshes and the app switches to the tabs.
      if (!joined) setNotFound(true);
    } catch {
      // Shown from join.error below.
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Enter invite code">
      <Text muted>Ask your partner for the code on their Profile screen. It works once and expires after 48 hours.</Text>
      <TextInput
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        placeholder="123456"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        accessibilityLabel="Invite code"
        maxLength={6}
        style={styles.code}
        placeholderTextColor={colors.inkMuted}
      />
      {notFound && (
        <Text variant="label" accessibilityLiveRegion="polite">
          That code didn&apos;t work. It may be wrong, already used or expired.
        </Text>
      )}
      {join.error && <Text variant="label">{join.error.message}</Text>}
      <View style={styles.sheetActions}>
        <Button label="Cancel" onPress={onClose} style={styles.flex} />
        <Button
          label={join.isPending ? 'Joining…' : 'Join'}
          variant="dark"
          disabled={!valid || join.isPending}
          onPress={submit}
          style={styles.flex}
        />
      </View>
    </BottomSheet>
  );
}

function Done({
  answers,
  firstName,
  weeks,
  onFinish,
}: {
  answers: Answers;
  firstName: string;
  weeks: number;
  onFinish: () => void;
}) {
  const dating = datingFor(answers, localToday());
  const rows = [
    { k: 'Due date', v: dating.ok ? formatDate(dating.dueDate) : '—' },
    { k: 'Babies', v: answers.babies + (answers.nickname.trim() ? ` · “${answers.nickname.trim()}”` : '') },
    { k: 'Doctor', v: answers.doctor.trim() || 'Add later' },
    { k: 'Reminders', v: `${REMINDERS.filter((r) => answers.reminders[r.kind]).length} on` },
  ];
  return (
    <SafeAreaView style={[styles.root, styles.done]}>
      <View style={styles.doneArt}>
        <View style={styles.doneSun}>
          <Text style={styles.doneNum}>{weeks}</Text>
          <Text style={styles.resultLbl}>WEEKS</Text>
        </View>
      </View>
      <View style={styles.doneCopy}>
        <Text style={[styles.q, styles.center]} accessibilityRole="header">
          You&apos;re all set, {firstName}!
        </Text>
        <Text muted style={[styles.hint, styles.center]}>
          Your dashboard is ready. Log a check-in whenever you like.
        </Text>
      </View>
      <Card style={styles.summary}>
        {rows.map((r, i) => (
          <View key={r.k} style={[styles.summaryRow, i < rows.length - 1 && styles.reminderLine]}>
            <Text muted style={styles.summaryKey}>
              {r.k}
            </Text>
            <Text style={styles.summaryVal}>{r.v}</Text>
          </View>
        ))}
      </Card>
      <View style={styles.footerDone}>
        <Button label="Go to my dashboard" variant="cta" onPress={onFinish} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 },
  track: {
    flex: 1,
    height: 14,
    borderRadius: 99,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.purple, borderRightWidth: border.width, borderColor: border.color },
  count: { width: 34, textAlign: 'right', fontFamily: fonts.bodyHeavy, fontSize: 13 },
  body: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24, gap: 18 },
  q: { fontFamily: fonts.display, fontSize: 30, lineHeight: 33, letterSpacing: -0.6 },
  hint: { fontSize: 15, lineHeight: 21 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.mint,
  },
  joinCard: { marginTop: 12, gap: 8 },
  stack: { gap: 10 },
  row: { flexDirection: 'row', gap: 12 },
  group: { gap: 8 },
  groupLabel: { fontFamily: fonts.bodyBold, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20 },
  resultBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.yellow,
    borderWidth: border.width,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultNum: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36 },
  resultLbl: { fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 1 },
  resultText: { flex: 1, gap: 4 },
  resultTitle: { fontFamily: fonts.display, fontSize: 20 },
  reminders: { paddingVertical: 4, paddingHorizontal: 16, gap: 0 },
  reminder: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  reminderLine: { borderBottomWidth: border.width, borderBottomColor: colors.line },
  reminderLabel: { fontFamily: fonts.bodyBold, fontSize: 16 },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, gap: 6 },
  skip: { borderWidth: 0, backgroundColor: 'transparent', minHeight: 44 },
  code: {
    height: 64,
    borderRadius: radius.field + 2,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: 32,
    letterSpacing: 8,
    color: colors.ink,
  },
  sheetActions: { flexDirection: 'row', gap: 10 },
  done: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 16, gap: 22 },
  doneArt: { alignItems: 'center' },
  doneSun: {
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: colors.yellow,
    borderWidth: border.width,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadow.lg,
  },
  doneNum: { fontFamily: fonts.display, fontSize: 72, lineHeight: 76 },
  doneCopy: { gap: 8 },
  center: { textAlign: 'center' },
  summary: { paddingVertical: 6, paddingHorizontal: 16, gap: 0 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 46, gap: 12 },
  summaryKey: { fontFamily: fonts.bodyMedium, fontSize: 15 },
  summaryVal: { fontFamily: fonts.bodyHeavy, fontSize: 15, textAlign: 'right', flexShrink: 1 },
  footerDone: { marginTop: 'auto' },
});
