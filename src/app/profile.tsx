import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Pressable, Share, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BackButton, BottomSheet, Button, Card, Chip, DateField, Screen, Text, TextField, Toggle } from '@/components';
import { authenticate, lockAvailability, useAppLock } from '@/lib/appLock';
import { signOut } from '@/lib/auth';
import { CONFIRM_WORD, DELETE_FAILURE_TEXT, DeleteFailure, useDeleteAccount } from '@/lib/deleteAccount';
import {
  useCreateInvite,
  useMembers,
  useMembership,
  useOpenInvite,
  useProfile,
  useReminderPrefs,
  useRemovePartner,
  useSetReminder,
  useUpdateName,
  useUpdatePregnancy,
  type Pregnancy,
} from '@/lib/data';
import { openSystemSettings, sendTestReminder } from '@/lib/notifications';
import { REMINDERS, toggleCondition } from '@/lib/onboarding';
import { useHealthSettings } from '@/lib/health/settings';
import { gestationalAge, localToday } from '@/lib/pregnancy';
import {
  GROUPS,
  displayFor,
  draftFor,
  expiresIn,
  fieldsFor,
  formatDate,
  initialOf,
  patchFor,
  spacedCode,
  type Field,
  type FieldKey,
} from '@/lib/profile';
import { useSession } from '@/lib/session';
import { NoShareSheetError, useExportData, type ExportFormat } from '@/lib/useExport';
import { useNotificationPermission } from '@/lib/useReminders';
import { useSavedThoughts } from '@/lib/useWeeklyCards';
import { useWeekNudge } from '@/lib/weekNudge';
import { useVault, type VaultState } from '@/lib/vault/VaultProvider';
import { makeStyles, useAppearance, useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';

type Editing = { key: FieldKey | 'name'; draft: string | string[] } | null;

const NAME_FIELD: Omit<Field, 'key'> = { label: 'Name', kind: 'text' };

const KEY_STATUS: Record<VaultState, string> = {
  idle: '',
  loading: 'Checking…',
  ready: 'On this phone',
  'needs-key': 'Needed on this phone',
  error: "Couldn't check",
  unsupported: 'Phone app only',
};

export default function ProfileScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { session } = useSession();
  const membership = useMembership();
  const profile = useProfile();
  const pregnancy = membership.data?.pregnancy;
  const isOwner = membership.data?.role === 'owner';
  const [editing, setEditing] = useState<Editing>(null);
  const vault = useVault();

  if (!pregnancy) return null;

  const fields = fieldsFor(pregnancy.units);
  const today = localToday();
  const ga = gestationalAge(pregnancy.lmp_date, today);
  const name = profile.data?.name?.trim() ?? '';

  const openName = () => setEditing({ key: 'name', draft: name });

  return (
    <Screen>
      <View style={styles.top}>
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Text style={styles.screenTitle} accessibilityRole="header">
          Profile
        </Text>
        <View style={styles.topSpacer} />
      </View>

      <Card tone={colors.pink} size="hero" elevation="lg" style={styles.hero}>
        <View style={styles.sun} />
        <Pressable accessibilityRole="button" accessibilityLabel="Edit name" onPress={openName} style={styles.avatar}>
          <Text style={styles.avatarText}>{initialOf(name)}</Text>
        </Pressable>
        <View style={styles.heroText}>
          <Text style={styles.heroName} numberOfLines={2}>
            {name || 'Add your name'}
          </Text>
          {session?.user.email ? <Text variant="label">{session.user.email}</Text> : null}
          <Text style={styles.badge}>
            Week {ga.weeks} · due {formatDate(pregnancy.due_date)}
          </Text>
        </View>
      </Card>

      <Group title="PERSONAL">
        <Row label="Name" value={name} onPress={openName} first />
        <Row label="Google account" value={session?.user.email ?? ''} />
      </Group>

      <PartnerSection pregnancyId={pregnancy.id} ownerId={pregnancy.owner_id} isOwner={isOwner} />

      <Group title="PRIVACY">
        <Row label="Household key" value={KEY_STATUS[vault.state]} onPress={() => router.push('/household-key')} first />
        <AppLockRow />
        <HealthRow />
        <Row label="Privacy policy" value="Read" onPress={() => router.push('/privacy')} />
      </Group>

      {GROUPS.map((g) => (
        <Group key={g.title} title={g.title}>
          {g.title === 'PREGNANCY' && (
            <>
              <Row label="Today" value={`${ga.weeks}w ${ga.days}d`} first />
              <Row label="Due date" value={formatDate(pregnancy.due_date)} />
            </>
          )}
          {g.keys.map((key, i) => (
            <Row
              key={key}
              first={i === 0 && g.title !== 'PREGNANCY'}
              label={fields[key].label}
              value={displayFor(pregnancy, key)}
              onPress={isOwner ? () => setEditing({ key, draft: draftFor(pregnancy, key) }) : undefined}
            />
          ))}
        </Group>
      ))}
      {!isOwner && (
        <Text variant="caption" style={styles.note}>
          Only the person who set up Bloom can change pregnancy and health details.
        </Text>
      )}

      <Group title="WEEKLY CARDS">
        <WeeklyCardsRow pregnancyId={pregnancy.id} />
      </Group>

      <Reminders pregnancyId={pregnancy.id} />

      <UnitsSetting pregnancyId={pregnancy.id} units={pregnancy.units} canEdit={isOwner} />

      <YourData pregnancy={pregnancy} name={name} isOwner={isOwner} />

      <Button label="Sign out" onPress={() => signOut().catch(() => {})} style={styles.signOut} />
      {__DEV__ && <Button label="Component gallery" onPress={() => router.push('/dev/components')} />}
      <Text variant="caption" style={styles.footer}>
        Bloom {Constants.expoConfig?.version ?? ''} · Doesn&apos;t replace advice from your doctor
      </Text>

      <EditSheet
        editing={editing}
        field={editing ? (editing.key === 'name' ? NAME_FIELD : fields[editing.key]) : null}
        pregnancy={pregnancy}
        today={today}
        onChange={(draft) => setEditing((e) => (e ? { ...e, draft } : e))}
        onClose={() => setEditing(null)}
      />
    </Screen>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.groupBox}>{children}</View>
    </View>
  );
}

function WeeklyCardsRow({ pregnancyId }: { pregnancyId: string }) {
  const saved = useSavedThoughts(pregnancyId);
  const count = saved.data?.length;
  const value = count === undefined ? '' : count === 0 ? 'None saved' : `${count} saved`;
  return <Row label="All weeks and saved thoughts" value={value} onPress={() => router.push('/weeks')} first />;
}

function Row({ label, value, onPress, first }: { label: string; value: string; onPress?: () => void; first?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const empty = !value;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label}: ${empty ? 'not set' : value}${onPress ? '. Edit' : ''}`}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.row, !first && styles.rowDivider]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValueWrap}>
        <Text style={[styles.rowValue, empty && onPress && styles.rowAdd]} numberOfLines={1}>
          {empty ? (onPress ? 'Add' : '—') : value}
        </Text>
        {onPress && (
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.inkMuted} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M9 6l6 6-6 6" />
          </Svg>
        )}
      </View>
    </Pressable>
  );
}

function PartnerSection({ pregnancyId, ownerId, isOwner }: { pregnancyId: string; ownerId: string; isOwner: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const members = useMembers(pregnancyId);
  const partner = members.data?.find((m) => m.role === 'partner');
  const owner = members.data?.find((m) => m.user_id === ownerId);
  const invite = useOpenInvite(pregnancyId, isOwner && !!members.data && !partner);
  const create = useCreateInvite(pregnancyId);
  const remove = useRemovePartner(pregnancyId);

  if (!isOwner) {
    return (
      <Group title="PARTNER">
        <Row label="Shared with you by" value={owner?.name?.trim() ?? ''} first />
      </Group>
    );
  }

  if (members.isPending) return null;

  if (partner) {
    const confirmRemove = () =>
      Alert.alert('Remove partner?', `${partner.name ?? 'Your partner'} will no longer see or log anything. You can invite them again later.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(partner.user_id) },
      ]);
    return (
      <Group title="PARTNER">
        <Row label="Partner" value={partner.name?.trim() || 'Joined'} first />
        <Pressable accessibilityRole="button" onPress={confirmRemove} style={[styles.row, styles.rowDivider]}>
          <Text style={[styles.rowLabel, styles.danger]}>Remove partner</Text>
        </Pressable>
      </Group>
    );
  }

  const code = create.data ?? invite.data;
  const share = () =>
    code &&
    Share.share({
      message: `Join me on Bloom: sign in, tap "I have an invite code" and enter ${code.code}. It works once and expires in 48 hours.`,
    }).catch(() => {});

  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle} accessibilityRole="header">
        PARTNER
      </Text>
      <Card tone={colors.surface} size="card" style={styles.invite}>
        {code ? (
          <>
            <Text variant="label">Your partner enters this code after signing in</Text>
            <Text style={styles.code} accessibilityLabel={`Invite code ${code.code.split('').join(' ')}`} selectable>
              {spacedCode(code.code)}
            </Text>
            <Text variant="caption">{expiresIn(code.expires_at)} · works once</Text>
            <View style={styles.inviteButtons}>
              <Button label="Share code" variant="dark" onPress={share} style={styles.flex} />
              <Button label="New code" onPress={() => create.mutate()} disabled={create.isPending} style={styles.flex} />
            </View>
          </>
        ) : (
          <>
            <Text variant="label">Invite your partner</Text>
            <Text variant="caption">They can follow along and log kicks, water and check-ins for you.</Text>
            <Button
              label={create.isPending || invite.isPending ? 'Getting a code…' : 'Create invite code'}
              variant="dark"
              disabled={create.isPending || invite.isPending}
              onPress={() => create.mutate()}
            />
          </>
        )}
        {(create.isError || remove.isError) && (
          <Text accessibilityRole="alert" style={styles.error}>
            Something went wrong. Check your connection and try again.
          </Text>
        )}
      </Card>
    </View>
  );
}

const LOCK_PROBLEM = {
  no_hardware: 'This phone has no Face ID, fingerprint or passcode for Bloom to use.',
  not_enrolled: 'Set up Face ID, a fingerprint or a passcode in your phone’s settings first.',
  failed: 'The lock is still off: that didn’t unlock.',
  save: 'Couldn’t change the lock. Try again.',
} as const;

/** Face ID, fingerprint or passcode before Bloom opens, on this phone only. */
function AppLockRow() {
  const styles = useStyles();
  const { enabled, setEnabled } = useAppLock();
  const [problem, setProblem] = useState<keyof typeof LOCK_PROBLEM | null>(null);
  const [busy, setBusy] = useState(false);

  const change = async (on: boolean) => {
    setProblem(null);
    setBusy(true);
    try {
      if (on) {
        const availability = await lockAvailability();
        if (availability !== 'ok') return setProblem(availability);
        // She proves it works before it can lock her out.
        if (!(await authenticate('Turn on the app lock'))) return setProblem('failed');
      }
      await setEnabled(on);
    } catch {
      setProblem('save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.row, styles.rowDivider]}>
      <View style={styles.flex}>
        <Text style={styles.reminderLabel}>App lock</Text>
        <Text variant="caption">
          {problem ? LOCK_PROBLEM[problem] : 'Face ID, fingerprint or passcode to open Bloom on this phone'}
        </Text>
      </View>
      <Toggle label="App lock" value={!!enabled} disabled={enabled === null || busy} onValueChange={change} />
    </View>
  );
}

/** Apple Health or Health Connect: what this phone may read. */
function HealthRow() {
  const { metrics, load } = useHealthSettings();
  useEffect(() => {
    if (metrics === null) load();
  }, [metrics, load]);
  const value = metrics === null ? '' : metrics.length ? `${metrics.length} on` : 'Off';
  return <Row label="Connected health" value={value} onPress={() => router.push('/connected-health')} />;
}

/** "Download my data": made on this phone, handed to the share sheet. */
function YourData({ pregnancy, name, isOwner }: { pregnancy: Pregnancy; name: string; isOwner: boolean }) {
  const styles = useStyles();
  const exporting = useExportData(pregnancy, name);
  const [format, setFormat] = useState<ExportFormat | null>(null);
  const [deleting, setDeleting] = useState(false);

  const run = (f: ExportFormat) => {
    setFormat(f);
    exporting.mutate(f);
  };
  const busy = exporting.isPending;
  const label = (f: ExportFormat, idle: string) => (busy && format === f ? 'Getting it ready…' : idle);

  return (
    <Group title="YOUR DATA">
      <View style={styles.notice}>
        <Text variant="caption">
          A copy made on this phone from what you&apos;ve recorded. Nothing is sent anywhere unless you choose to share it.
        </Text>
        <Button label={label('pdf', 'Download PDF summary')} variant="dark" disabled={busy} onPress={() => run('pdf')} />
        <Button label={label('json', 'Download all data (JSON)')} disabled={busy} onPress={() => run('json')} />
        {exporting.isError && (
          <Text style={styles.error} accessibilityRole="alert">
            {exporting.error instanceof NoShareSheetError
              ? 'This phone can’t share files from Bloom.'
              : 'Couldn’t make the file. Try again.'}
          </Text>
        )}
      </View>
      <Pressable accessibilityRole="button" onPress={() => setDeleting(true)} style={[styles.row, styles.rowDivider]}>
        <Text style={[styles.rowLabel, styles.danger]}>Delete account</Text>
      </Pressable>
      <DeleteAccountSheet visible={deleting} pregnancy={pregnancy} isOwner={isOwner} onClose={() => setDeleting(false)} />
    </Group>
  );
}

function DeleteAccountSheet({
  visible,
  pregnancy,
  isOwner,
  onClose,
}: {
  visible: boolean;
  pregnancy: Pregnancy;
  isOwner: boolean;
  onClose: () => void;
}) {
  const styles = useStyles();
  const members = useMembers(pregnancy.id);
  const remove = useDeleteAccount(pregnancy.id);
  const [typed, setTyped] = useState('');
  const partner = members.data?.find((m) => m.role === 'partner');
  const owner = members.data?.find((m) => m.user_id === pregnancy.owner_id);
  const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD;

  const close = () => {
    if (remove.isPending) return;
    setTyped('');
    remove.reset();
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={close} title="Delete your account?">
      {isOwner ? (
        <>
          <Text>
            This deletes your Bloom account and everything in it: your pregnancy details, check-ins, medicines, meals,
            reports and photos, from this phone and from Bloom&apos;s servers. It can&apos;t be undone.
          </Text>
          {partner && (
            <Text style={styles.danger}>{partner.name?.trim() || 'Your partner'} will lose access too.</Text>
          )}
          <Text muted>Download your data first if you want to keep a copy.</Text>
        </>
      ) : (
        <Text>
          This deletes your Bloom account and takes Bloom off this phone. {owner?.name?.trim() || 'The person who shared it'}{' '}
          keeps their data; you&apos;ll need a new invite to see it again.
        </Text>
      )}
      <View style={styles.fieldRow}>
        <TextField label={`Type ${CONFIRM_WORD} to confirm`} value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} />
      </View>
      {remove.isError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {DELETE_FAILURE_TEXT[remove.error instanceof DeleteFailure ? remove.error.code : 'failed']}
        </Text>
      )}
      <View style={styles.inviteButtons}>
        <Button label="Cancel" onPress={close} disabled={remove.isPending} style={styles.flex} />
        <Button
          label={remove.isPending ? 'Deleting…' : 'Delete account'}
          variant="dark"
          disabled={!confirmed || remove.isPending}
          onPress={() => remove.mutate()}
          style={styles.flex}
        />
      </View>
    </BottomSheet>
  );
}

function Reminders({ pregnancyId }: { pregnancyId: string }) {
  const styles = useStyles();
  const prefs = useReminderPrefs(pregnancyId);
  const set = useSetReminder(pregnancyId);
  const weekNudge = useWeekNudge();
  const { state: permission } = useNotificationPermission();
  const [test, setTest] = useState<'idle' | 'sent' | 'failed'>('idle');

  const sendTest = () => {
    sendTestReminder().then(
      () => setTest('sent'),
      () => setTest('failed'),
    );
  };

  return (
    <Group title="REMINDERS">
      {REMINDERS.map((r, i) => (
        <View key={r.kind} style={[styles.row, i > 0 && styles.rowDivider]}>
          <View style={styles.flex}>
            <Text style={styles.reminderLabel}>{r.label}</Text>
            <Text variant="caption">{r.sub}</Text>
          </View>
          <Toggle
            label={r.label}
            value={prefs.data?.[r.kind] ?? true}
            disabled={!prefs.data}
            onValueChange={(enabled) => set.mutate({ kind: r.kind, enabled })}
          />
        </View>
      ))}
      <View style={[styles.row, styles.rowDivider]}>
        <View style={styles.flex}>
          <Text style={styles.reminderLabel}>New week&apos;s cards</Text>
          <Text variant="caption">9 am on the day a week starts, on this phone</Text>
        </View>
        <Toggle label="New week's cards" value={!!weekNudge.on} disabled={weekNudge.on === null} onValueChange={(on) => weekNudge.set(on)} />
      </View>
      {permission === 'denied' && (
        <View style={[styles.notice, styles.rowDivider]}>
          <Text variant="caption">
            Notifications are off for Bloom, so none of these will arrive. Turn them on in your phone&apos;s settings.
          </Text>
          <Button label="Open Settings" variant="dark" onPress={() => openSystemSettings().catch(() => {})} />
        </View>
      )}
      {__DEV__ && permission === 'granted' && (
        <Pressable accessibilityRole="button" accessibilityLabel="Send a test reminder" onPress={sendTest} style={[styles.row, styles.rowDivider]}>
          <Text style={styles.reminderLabel}>Send a test reminder</Text>
          <Text variant="caption">
            {test === 'sent' ? 'On its way' : test === 'failed' ? 'Couldn’t send it' : 'Arrives in 5 seconds'}
          </Text>
        </Pressable>
      )}
    </Group>
  );
}

function UnitsSetting({ pregnancyId, units, canEdit }: { pregnancyId: string; units: 'metric' | 'imperial'; canEdit: boolean }) {
  const styles = useStyles();
  const update = useUpdatePregnancy(pregnancyId);
  const current = update.isPending ? (update.variables?.units as typeof units) : units;
  const { appearance, setAppearance } = useAppearance();
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle} accessibilityRole="header">
        APP
      </Text>
      <View style={styles.groupBox}>
        <View style={styles.unitsBox}>
          <Text style={styles.reminderLabel}>Weight units</Text>
          <Segment
            label="Weight units"
            options={[
              { key: 'metric', label: 'kg' },
              { key: 'imperial', label: 'lb' },
            ]}
            value={current}
            disabled={!canEdit}
            onChange={(u) => update.mutate({ units: u })}
          />
        </View>
        <View style={[styles.unitsBox, styles.rowDivider]}>
          <Text style={styles.reminderLabel}>Appearance</Text>
          <Segment
            label="Appearance"
            options={[
              { key: 'system', label: 'System' },
              { key: 'light', label: 'Light' },
              { key: 'dark', label: 'Dark' },
            ]}
            value={appearance}
            onChange={setAppearance}
          />
        </View>
      </View>
    </View>
  );
}

function Segment<K extends string>({
  label,
  options,
  value,
  disabled,
  onChange,
}: {
  label: string;
  options: { key: K; label: string }[];
  value: K;
  disabled?: boolean;
  onChange: (key: K) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled: !!disabled }}
            disabled={disabled || on}
            onPress={() => onChange(o.key)}
            style={[styles.segmentBtn, on && styles.segmentOn]}>
            <Text style={[styles.segmentText, on && { color: colors.surface }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function EditSheet({
  editing,
  field,
  pregnancy,
  today,
  onChange,
  onClose,
}: {
  editing: Editing;
  field: Omit<Field, 'key'> | null;
  pregnancy: NonNullable<ReturnType<typeof useMembership>['data']>['pregnancy'];
  today: string;
  onChange: (draft: string | string[]) => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const updatePregnancy = useUpdatePregnancy(pregnancy.id);
  const updateName = useUpdateName();
  const [error, setError] = useState<string | null>(null);
  const saving = updatePregnancy.isPending || updateName.isPending;
  const failed = updatePregnancy.isError || updateName.isError;

  const close = () => {
    setError(null);
    updatePregnancy.reset();
    updateName.reset();
    onClose();
  };

  const save = () => {
    if (!editing) return;
    if (editing.key === 'name') {
      const name = typeof editing.draft === 'string' ? editing.draft.trim() : '';
      if (!name) {
        setError('Enter your name.');
        return;
      }
      setError(null);
      updateName.mutate(name, { onSuccess: close });
      return;
    }
    const result = patchFor(pregnancy, editing.key, editing.draft, today);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    updatePregnancy.mutate(result.patch, { onSuccess: close });
  };

  const draft = editing?.draft ?? '';
  const text = typeof draft === 'string' ? draft : '';
  const list = Array.isArray(draft) ? draft : [];

  return (
    <BottomSheet visible={!!editing} onClose={close} title={field ? `Edit ${field.label.toLowerCase()}` : ''}>
      {field?.kind === 'choice' && (
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={field.label}>
          {field.options?.map((o) => <Chip key={o} label={o} selected={text === o} onPress={() => onChange(o)} />)}
        </View>
      )}
      {field?.kind === 'multi' && (
        <View style={styles.chips}>
          {field.options?.map((o) => (
            <Chip key={o} mode="toggle" label={o} selected={list.includes(o)} onPress={() => onChange(toggleCondition(list, o))} />
          ))}
        </View>
      )}
      {field?.kind === 'date' && <DateField label={field.label} value={text} onChange={onChange} />}
      {field && (field.kind === 'text' || field.kind === 'tel' || field.kind === 'number') && (
        <View style={styles.fieldRow}>
          <TextField
            label={field.label}
            value={text}
            onChangeText={onChange}
            placeholder={field.placeholder}
            keyboardType={field.kind === 'tel' ? 'phone-pad' : field.kind === 'number' ? 'decimal-pad' : 'default'}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={save}
          />
        </View>
      )}
      {field?.hint ? <Text muted>{field.hint}</Text> : null}
      {(error || failed) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error ?? 'Couldn’t save. Check your connection and try again.'}
        </Text>
      )}
      <View style={styles.inviteButtons}>
        <Button label="Cancel" onPress={close} style={styles.flex} />
        <Button label={saving ? 'Saving…' : 'Save'} variant="dark" disabled={saving} onPress={save} style={styles.flex} />
      </View>
    </BottomSheet>
  );
}

const useStyles = makeStyles(({ colors, border }) => ({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topSpacer: { width: 44 },
  screenTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20 },
  sun: {
    position: 'absolute',
    right: -30,
    bottom: -40,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: colors.yellow,
    borderWidth: border.width,
    borderColor: colors.onAccent,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: border.width,
    borderColor: colors.onAccent,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.display, fontSize: 30, color: colors.onAccent },
  heroText: { flex: 1, gap: 4 },
  heroName: { fontFamily: fonts.display, fontSize: 24, lineHeight: 27, color: colors.onAccent },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    fontFamily: fonts.bodyHeavy,
    fontSize: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: border.width,
    borderColor: colors.onAccent,
    backgroundColor: colors.paper,
    overflow: 'hidden',
    color: colors.onAccent,
  },
  group: { gap: 8 },
  groupTitle: { marginHorizontal: 4, fontFamily: fonts.bodyHeavy, fontSize: 13, letterSpacing: 1, color: colors.inkMuted },
  groupBox: {
    backgroundColor: colors.surface,
    borderWidth: border.width,
    borderColor: border.color,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  rowDivider: { borderTopWidth: 2, borderTopColor: colors.line },
  notice: { gap: 12, padding: 16 },
  rowLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkMuted, flexShrink: 0 },
  rowValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  rowValue: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.ink, textAlign: 'right', flexShrink: 1 },
  rowAdd: { color: colors.link },
  danger: { color: colors.purpleDark, fontFamily: fonts.bodyHeavy },
  note: { marginTop: -8, marginHorizontal: 4 },
  invite: { padding: 16, gap: 10, borderRadius: radius.card },
  code: { fontFamily: fonts.display, fontSize: 40, letterSpacing: 2, color: colors.ink },
  inviteButtons: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  reminderLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  unitsBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  segment: { flexDirection: 'row', gap: 4, padding: 3, borderWidth: border.width, borderColor: border.color, borderRadius: radius.pill },
  segmentBtn: { height: 36, minWidth: 48, paddingHorizontal: 12, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.ink },
  segmentText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.ink },
  signOut: { minHeight: 52, borderRadius: 18 },
  footer: { textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fieldRow: { flexDirection: 'row' },
  error: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.purpleDark },
}));
