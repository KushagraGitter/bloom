import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { BackButton, BottomSheet, Button, Card, Screen, Text, TextField, TrashIcon } from '@/components';
import { VaultNotice } from '@/components/VaultNotice';
import { confirmRemove } from '@/lib/confirm';
import {
  PLAN_ADVICE_MAX,
  PLAN_PHONE_MAX,
  PLAN_PLACE_MAX,
  clock,
  sessionLabel,
  splitSessions,
  spoken,
  startTime,
  telLink,
  type CallPlan,
  type Session,
} from '@/lib/contractions';
import { useMembership } from '@/lib/data';
import {
  useCallPlan,
  useContractions,
  useEndSession,
  useRemoveContractions,
  useSaveCallPlan,
  useStartContraction,
  useStopContraction,
} from '@/lib/useContractions';
import { useVault } from '@/lib/vault/VaultProvider';
import { makeStyles, useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';

/** How many earlier sessions are listed. */
const EARLIER_SHOWN = 10;

/** The time now, refreshed often enough for a clock that shows seconds. */
function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export default function ContractionsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const membership = useMembership();
  const pregnancyId = membership.data?.pregnancy.id;
  const vault = useVault();
  const now = useNow();
  const data = useContractions(pregnancyId);
  const plan = useCallPlan(pregnancyId);
  const start = useStartContraction(pregnancyId);
  const stop = useStopContraction(pregnancyId);
  const remove = useRemoveContractions(pregnancyId);
  const endSession = useEndSession(pregnancyId);
  const [editingPlan, setEditingPlan] = useState(false);

  // The root layout only shows this screen once a pregnancy exists.
  if (!pregnancyId) return null;

  const ready = vault.state === 'ready' && data.isSuccess;
  const { current, earlier } = splitSessions(data.data?.sessions ?? [], data.data?.endedIds ?? [], now);
  const running = current?.running ?? null;
  const rows = [...(current?.rows ?? [])].reverse();
  const last = current?.rows[current.rows.length - 1];
  const busy = start.isPending || stop.isPending;

  const elapsed = running ? now - Date.parse(running.start) : last ? now - (Date.parse(last.start) + last.length) : 0;
  const state = running ? 'CONTRACTION' : last ? 'RESTING' : 'READY';

  const toggle = () => {
    const at = new Date();
    if (running) stop.mutate({ running, at });
    else start.mutate({ at, sessionId: current?.id ?? null });
  };

  const removeSession = (session: Session) => {
    const ids = (data.data?.contractions ?? []).filter((c) => c.session === session.id).map((c) => c.id);
    confirmRemove('Remove this session?', 'Its contractions will be deleted from both phones.', () =>
      remove.mutate([...ids, session.id]),
    );
  };

  return (
    <Screen>
      <BackButton label="Today" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />

      <View style={styles.header}>
        <Text muted style={styles.kicker}>
          For the third trimester
        </Text>
        <Text variant="screenTitle" accessibilityRole="header">
          Contraction timer
        </Text>
      </View>

      <VaultNotice />

      <View style={styles.timer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={running ? 'Stop contraction' : 'Start contraction'}
          accessibilityValue={{ text: state === 'READY' ? 'Ready' : `${running ? 'Going for' : 'Resting for'} ${spoken(elapsed)}` }}
          accessibilityState={{ disabled: !ready || busy }}
          disabled={!ready || busy}
          onPress={toggle}
          style={[styles.big, { backgroundColor: running ? colors.orange : colors.mint }, !ready && styles.idle]}>
          <Text style={styles.state}>{state}</Text>
          <Text style={styles.clock}>{clock(elapsed)}</Text>
          <Text style={styles.action}>{running ? 'Tap to stop' : 'Tap to start'}</Text>
        </Pressable>
        <Text muted style={styles.hint}>
          Tap when a contraction starts, tap again when it ends.
        </Text>
        {running && (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => remove.mutate([running.id])} style={styles.link}>
            <Text style={styles.linkText}>Started by mistake? Cancel it</Text>
          </Pressable>
        )}
        {(start.isError || stop.isError || remove.isError || endSession.isError) && (
          <Text accessibilityRole="alert" style={styles.error}>
            Couldn&apos;t save that. Try again.
          </Text>
        )}
      </View>

      <View style={styles.stats}>
        <Stat label="Avg length" ms={current?.avgLength ?? null} />
        <Stat label="Avg apart" ms={current?.avgApart ?? null} />
        <View style={styles.stat} accessible accessibilityLabel={`Count, ${rows.length}`}>
          <Text style={styles.statLabel}>Count</Text>
          <Text style={styles.statValue}>{rows.length}</Text>
        </View>
      </View>

      <CallCard plan={plan.data ?? null} canEdit={ready} onEdit={() => setEditingPlan(true)} />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="title" accessibilityRole="header">
            This session
          </Text>
          {current && !running && rows.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Keeps these times under earlier sessions and starts a fresh one"
              disabled={endSession.isPending}
              onPress={() => endSession.mutate(current.id)}
              style={styles.link}>
              <Text style={styles.linkText}>End session</Text>
            </Pressable>
          )}
        </View>
        {rows.length === 0 ? (
          <Card dashed style={styles.empty}>
            <Text style={styles.emptyText}>No contractions timed yet.</Text>
          </Card>
        ) : (
          <View style={styles.table}>
            <View style={[styles.row, styles.headRow]}>
              <Text style={[styles.cell, styles.headCell]}>STARTED</Text>
              <Text style={[styles.cell, styles.headCell]}>LENGTH</Text>
              <Text style={[styles.cell, styles.headCell]}>APART</Text>
              <View style={styles.removeCell} />
            </View>
            {rows.map((r) => (
              <View key={r.id} style={[styles.row, styles.bodyRow]}>
                <Text style={styles.cell}>{startTime(r.start)}</Text>
                <Text style={styles.cell} accessibilityLabel={`Lasted ${spoken(r.length)}`}>
                  {clock(r.length)}
                </Text>
                <Text style={styles.cell} accessibilityLabel={r.apart === null ? 'First' : `${spoken(r.apart)} apart`}>
                  {r.apart === null ? '—' : clock(r.apart)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove the contraction at ${startTime(r.start)}`}
                  hitSlop={8}
                  onPress={() => confirmRemove('Remove this contraction?', 'It will be deleted from both phones.', () => remove.mutate([r.id]))}
                  style={styles.removeCell}>
                  <TrashIcon />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>

      {earlier.length > 0 && (
        <View style={styles.section}>
          <Text variant="title" accessibilityRole="header">
            Earlier sessions
          </Text>
          {earlier.slice(0, EARLIER_SHOWN).map((s) => (
            <View key={s.id} style={styles.earlier}>
              <View style={styles.earlierText}>
                <Text style={styles.earlierWhen}>{sessionLabel(s)}</Text>
                <Text style={styles.earlierStats}>
                  {s.rows.length} {s.rows.length === 1 ? 'contraction' : 'contractions'}
                  {s.avgLength !== null && ` · avg ${clock(s.avgLength)} long`}
                  {s.avgApart !== null && ` · ${clock(s.avgApart)} apart`}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove the session from ${sessionLabel(s)}`}
                hitSlop={8}
                onPress={() => removeSession(s)}
                style={styles.removeCell}>
                <TrashIcon />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <PlanSheet
        key={editingPlan ? 'open' : 'closed'}
        visible={editingPlan}
        plan={plan.data ?? null}
        pregnancyId={pregnancyId}
        onClose={() => setEditingPlan(false)}
      />
    </Screen>
  );
}

function Stat({ label, ms }: { label: string; ms: number | null }) {
  const styles = useStyles();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}, ${ms === null ? 'none yet' : spoken(ms)}`}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{ms === null ? '—' : clock(ms)}</Text>
    </View>
  );
}

/**
 * The design's yellow "When to call" card. It holds only what her own doctor
 * or midwife told her, in her words: the app has no rule of its own.
 */
function CallCard({ plan, canEdit, onEdit }: { plan: CallPlan | null; canEdit: boolean; onEdit: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const has = !!plan && !!(plan.advice || plan.place || plan.phone);
  const tel = plan ? telLink(plan.phone) : null;
  const place = [plan?.place, plan?.phone].filter(Boolean).join(' · ');
  return (
    <Card tone={colors.yellow} style={styles.call}>
      <View style={styles.sectionHeader}>
        <Text style={styles.overline} accessibilityRole="header">
          WHEN TO CALL
        </Text>
        {canEdit && (
          <Pressable accessibilityRole="button" accessibilityLabel={has ? 'Edit when to call' : 'Add when to call'} onPress={onEdit} style={styles.link}>
            <Text style={styles.callEdit}>{has ? 'Edit' : 'Add'}</Text>
          </Pressable>
        )}
      </View>
      {has ? (
        <>
          {!!plan!.advice && <Text style={styles.callText}>{plan!.advice}</Text>}
          {!!place &&
            (tel ? (
              <Pressable accessibilityRole="link" accessibilityLabel={`Call ${place}`} onPress={() => Linking.openURL(tel)}>
                <Text style={[styles.callText, styles.callPhone]}>{place}</Text>
              </Pressable>
            ) : (
              <Text style={styles.callText}>{place}</Text>
            ))}
        </>
      ) : (
        <Text style={styles.callText}>Add what your doctor or midwife told you about when to call, and the number to ring.</Text>
      )}
      <Text style={styles.callNote}>Always follow your own doctor&apos;s or midwife&apos;s advice. This timer only keeps the times.</Text>
    </Card>
  );
}

function PlanSheet({
  visible,
  plan,
  pregnancyId,
  onClose,
}: {
  visible: boolean;
  plan: CallPlan | null;
  pregnancyId: string;
  onClose: () => void;
}) {
  const styles = useStyles();
  const save = useSaveCallPlan(pregnancyId);
  const [advice, setAdvice] = useState(plan?.advice ?? '');
  const [place, setPlace] = useState(plan?.place ?? '');
  const [phone, setPhone] = useState(plan?.phone ?? '');

  return (
    <BottomSheet visible={visible} onClose={onClose} title="When to call">
      <View style={styles.fieldRow}>
        <TextField
          label="What your doctor or midwife said"
          value={advice}
          onChangeText={setAdvice}
          placeholder="In their words"
          maxLength={PLAN_ADVICE_MAX}
          multiline
          textAlignVertical="top"
          style={styles.adviceField}
        />
      </View>
      <View style={styles.fieldRow}>
        <TextField
          label="Hospital or birth centre"
          value={place}
          onChangeText={setPlace}
          placeholder="Optional"
          maxLength={PLAN_PLACE_MAX}
          returnKeyType="next"
        />
      </View>
      <View style={styles.fieldRow}>
        <TextField
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="Optional"
          maxLength={PLAN_PHONE_MAX}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
        />
      </View>
      {save.isError && (
        <Text accessibilityRole="alert" style={styles.error}>
          Couldn&apos;t save. Try again.
        </Text>
      )}
      <View style={styles.buttons}>
        <Button label="Cancel" onPress={onClose} style={styles.half} />
        <Button
          label={save.isPending ? 'Saving…' : 'Save'}
          variant="dark"
          disabled={save.isPending}
          onPress={() => save.mutate({ advice, place, phone }, { onSuccess: onClose })}
          style={styles.half}
        />
      </View>
    </BottomSheet>
  );
}

const useStyles = makeStyles(({ colors, border }) => ({
  header: { gap: 2 },
  kicker: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  timer: { alignItems: 'center', gap: 14, paddingVertical: 8 },
  big: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 3,
    borderColor: border.color,
    boxShadow: `6px 6px 0px ${colors.ink}`,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  idle: { opacity: 0.5 },
  state: { fontFamily: fonts.bodyHeavy, fontSize: 13, letterSpacing: 1.3, color: colors.ink },
  clock: { fontFamily: fonts.display, fontSize: 56, lineHeight: 60, color: colors.ink, fontVariant: ['tabular-nums'] },
  action: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.ink },
  hint: { fontFamily: fonts.bodyMedium, fontSize: 14, textAlign: 'center' },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  linkText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.link },
  error: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.purpleDark, textAlign: 'center' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    padding: 12,
    borderRadius: 20,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
  },
  statLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted },
  statValue: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, fontVariant: ['tabular-nums'] },
  call: { gap: 4, paddingVertical: 14, paddingHorizontal: 16 },
  overline: { fontFamily: fonts.bodyHeavy, fontSize: 12, letterSpacing: 1, color: colors.onAccent },
  callEdit: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.onAccent, textDecorationLine: 'underline' },
  callText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.onAccent },
  callPhone: { textDecorationLine: 'underline' },
  callNote: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.onAccent, marginTop: 6 },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  empty: { padding: 18 },
  emptyText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  table: {
    borderRadius: radius.card,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  headRow: { paddingVertical: 10, backgroundColor: colors.ink },
  bodyRow: { paddingVertical: 4, borderTopWidth: border.width, borderTopColor: colors.line },
  cell: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
  headCell: { fontFamily: fonts.bodyHeavy, fontSize: 12, letterSpacing: 0.7, color: colors.surface },
  removeCell: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  earlier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: 20,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
  },
  earlierText: { flex: 1, minWidth: 0, gap: 3 },
  earlierWhen: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.ink },
  earlierStats: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  fieldRow: { flexDirection: 'row' },
  adviceField: { height: 96, paddingTop: 12, paddingBottom: 12 },
  buttons: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
}));
