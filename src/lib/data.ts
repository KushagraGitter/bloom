import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { localTime, toAppointment, type Appointment, type AppointmentRow } from '@/lib/appointments';
import { REMINDERS, toPregnancyDetails, type Answers, type ReminderKind } from '@/lib/onboarding';
import { dueDateFromLmp, localToday } from '@/lib/pregnancy';
import type { PregnancyRow } from '@/lib/profile';
import { CHECKINS, startOfLocalDay, type CheckinType, type Reading } from '@/lib/readings';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { resolveHouseholdKey } from '@/lib/vault/householdKey';
import { loadHouseholdKey, saveHouseholdKey } from '@/lib/vault/keys';
import { writeRecord } from '@/lib/vault/localStore';
import { listItems, newId, readyStore, removeItems, saveItem, stableId, useVaultQuery, vaultQueryKey, type VaultItem } from '@/lib/vault/records';
import { countVaultRecords } from '@/lib/vault/remote';
import { openLocalStore, useVault } from '@/lib/vault/VaultProvider';
import type { Dose, Medication, MedicationRow } from '@/lib/vitamins';

export type Pregnancy = PregnancyRow;

export type Membership = { role: 'owner' | 'partner'; pregnancy: Pregnancy };

export type Profile = { id: string; name: string | null; avatar_url: string | null };

/** Health data (everything under `vaultQueryKey`) is read from this phone's encrypted store. */
export const keys = {
  membership: (userId: string) => ['membership', userId] as const,
  profile: (userId: string) => ['profile', userId] as const,
  pregnancy: (pregnancyId: string) => vaultQueryKey(pregnancyId, 'pregnancy'),
  readings: (pregnancyId: string) => vaultQueryKey(pregnancyId, 'readings'),
  today: (pregnancyId: string, day: string) => vaultQueryKey(pregnancyId, 'readings', 'today', day),
  latest: (pregnancyId: string) => vaultQueryKey(pregnancyId, 'readings', 'latest'),
  members: (pregnancyId: string) => ['members', pregnancyId] as const,
  invite: (pregnancyId: string) => ['invite', pregnancyId] as const,
  reminders: (pregnancyId: string, userId: string) => ['reminders', pregnancyId, userId] as const,
  meds: (pregnancyId: string) => vaultQueryKey(pregnancyId, 'meds'),
  doses: (pregnancyId: string) => vaultQueryKey(pregnancyId, 'doses'),
  appointments: (pregnancyId: string) => vaultQueryKey(pregnancyId, 'appointments'),
};

/** The pregnancy's details live in one vault record of this kind. */
export const PREGNANCY_KIND = 'pregnancy';
export const pregnancyDetailsId = (pregnancyId: string) => stableId('pregnancy', pregnancyId);

/** Columns of `pregnancies` that are health details, so belong in the vault. */
export const PREGNANCY_DETAILS = [
  'lmp_date',
  'due_date',
  'method',
  'ivf_transfer_date',
  'ivf_embryo_day',
  'babies',
  'first_pregnancy',
  'sex',
  'nickname',
  'height_cm',
  'pre_weight_kg',
  'blood_group',
  'conditions',
  'allergies',
  'doctor',
  'hospital',
  'hospital_phone',
  'emergency_contact',
  'emergency_phone',
  'units',
] as const;

export function pregnancyDetails(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(PREGNANCY_DETAILS.filter((k) => k in row).map((k) => [k, row[k]]));
}

/**
 * The pregnancy the signed-in user belongs to, or null if they haven't set one
 * up or joined one. Once this phone has the household key, the details kept in
 * the vault are laid over the server's row.
 */
export function useMembership() {
  const { session } = useSession();
  const userId = session?.user.id;
  const server = useQuery({
    queryKey: keys.membership(userId ?? 'signed-out'),
    enabled: !!userId,
    queryFn: async (): Promise<Membership | null> => {
      const { data, error } = await supabase
        .from('members')
        .select('role, pregnancy:pregnancies(*)')
        .eq('user_id', userId!)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Membership | null) ?? null;
    },
  });
  const details = useVaultQuery(server.data?.pregnancy.id, ['pregnancy'], async (store, pid) => {
    const record = await store.get(pregnancyDetailsId(pid));
    return record && !record.deleted ? (record.data as Partial<Pregnancy>) : null;
  });
  const data = useMemo(
    () => (server.data && details.data ? { ...server.data, pregnancy: { ...server.data.pregnancy, ...details.data } } : server.data),
    [server.data, details.data],
  );
  return data === server.data ? server : { ...server, data };
}

export function useProfile() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: keys.profile(userId ?? 'signed-out'),
    enabled: !!userId,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.from('profiles').select('id, name, avatar_url').eq('id', userId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Every detail key with its empty value, so a details record has the same shape as the old server row. */
function emptyDetails(): Record<string, unknown> {
  return Object.fromEntries(PREGNANCY_DETAILS.map((k) => [k, k === 'conditions' ? [] : k === 'units' ? 'metric' : null]));
}

/**
 * Saves the pregnancy details on this phone, encrypted with the household key
 * (made here for a new household), before the vault provider is mounted. The
 * provider then finds the key in the keychain and syncs the record.
 */
async function keepDetailsOnPhone(pregnancyId: string, details: Record<string, unknown>): Promise<void> {
  if (Platform.OS === 'web') return; // The web build has no vault; health details stay on phones.
  const resolved = await resolveHouseholdKey({
    role: 'owner',
    loadKey: () => loadHouseholdKey(pregnancyId),
    saveKey: (key) => saveHouseholdKey(pregnancyId, key),
    countRecords: () => countVaultRecords(pregnancyId),
  });
  // Only happens when this household already has records and this phone lacks the key; the app asks for it next.
  if (resolved.status !== 'ready') return;
  const store = await openLocalStore();
  await writeRecord(store, { id: pregnancyDetailsId(pregnancyId), pregnancyId, kind: PREGNANCY_KIND, data: details });
}

/**
 * Saves onboarding: the profile name, the pregnancy (its owner membership is
 * added by a database trigger) and the reminder choices. The pregnancy row on
 * the server holds no health details: the dates, health questions and
 * contacts are kept on this phone in the vault. Does not refresh the
 * membership query, so the "You're all set" screen can show before the app
 * switches to the tabs; call `finishOnboarding` for that.
 */
export function useCreatePregnancy() {
  const { session } = useSession();
  return useMutation({
    mutationFn: async (answers: Answers) => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Not signed in.');
      const answered = toPregnancyDetails(answers, localToday());
      const details = { ...emptyDetails(), ...answered, due_date: dueDateFromLmp(answered.lmp_date) };

      const { error: profileError } = await supabase.from('profiles').update({ name: answers.name.trim() }).eq('id', userId);
      if (profileError) throw profileError;

      // If an earlier attempt got as far as creating the pregnancy, reuse it
      // rather than creating a second one.
      const { data: existing, error: findError } = await supabase
        .from('pregnancies')
        .select('id')
        .eq('owner_id', userId)
        .limit(1)
        .maybeSingle();
      if (findError) throw findError;

      const { data: pregnancy, error } = existing
        ? { data: existing, error: null }
        : await supabase.from('pregnancies').insert({}).select('id').single();
      if (error) throw error;
      const pregnancyId = pregnancy.id as string;

      await keepDetailsOnPhone(pregnancyId, details);

      const { error: prefsError } = await supabase.from('reminder_prefs').upsert(
        REMINDERS.map((r) => ({
          pregnancy_id: pregnancyId,
          user_id: userId,
          kind: r.kind,
          enabled: answers.reminders[r.kind],
        })),
        { onConflict: 'pregnancy_id,user_id,kind' },
      );
      if (prefsError) throw prefsError;
      return pregnancyId;
    },
  });
}

/** Partner path: redeem a 6-digit code. Resolves to false when the code is wrong, used or expired. */
export function useJoinWithCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('accept_invite', { p_code: code.trim() });
      if (error) throw error;
      return data !== null;
    },
    onSuccess: (joined) => {
      if (joined) queryClient.invalidateQueries({ queryKey: ['membership'] });
    },
  });
}

export function useFinishOnboarding() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['membership'] });
}

// ---------------------------------------------------------------------------
// Today: readings
// ---------------------------------------------------------------------------

function dayStart(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Today's local date as YYYY-MM-DD. Updates at midnight and when the app comes
 * back to the foreground, so a screen left open overnight moves to the new day.
 */
export function useLocalToday(): string {
  const [day, setDay] = useState(localToday);
  useEffect(() => {
    const refresh = () => setDay(localToday());
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 1000);
    const sub = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [day]);
  return day;
}

/**
 * The local time as HH:mm. Updates as each minute starts and when the app comes
 * back to the foreground, so a screen left open moves on once a time has passed.
 */
export function useLocalTime(): string {
  const [time, setTime] = useState(() => localTime());
  useEffect(() => {
    const refresh = () => setTime(localTime());
    let timer: ReturnType<typeof setTimeout>;
    // Each wake-up works out the next one from the clock, so it never drifts.
    const schedule = () => {
      const now = new Date();
      const untilNextMinute = 60 * 1000 - (now.getSeconds() * 1000 + now.getMilliseconds());
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, untilNextMinute + 50);
    };
    schedule();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);
  return time;
}

/** A reading as it is kept in the vault: everything but the id and pregnancy. */
type ReadingData = Omit<Reading, 'id' | 'pregnancy_id'>;
type Tally = 'kicks' | 'water';
const TALLIES: Tally[] = ['kicks', 'water'];

/** Weight, BP, sugar and sleep each have their own kind, so "latest" reads only its own type. */
export const readingKind = (type: CheckinType) => `reading.${type}`;
/** Kicks and water are kept per local day, so today's count never reads the whole pregnancy. */
export const tallyKind = (type: Tally, day: string) => `tally.${type}.${day}`;

const toReading = (pregnancyId: string) => (item: VaultItem<ReadingData>): Reading => ({
  id: item.id,
  pregnancy_id: pregnancyId,
  ...item.data,
});
const byTakenAt = (a: Reading, b: Reading) => Date.parse(a.taken_at) - Date.parse(b.taken_at);

/** Everything logged since local midnight (kicks and water are counted from this). */
export function useTodayReadings(pregnancyId: string | undefined, day: string) {
  return useVaultQuery(pregnancyId, ['readings', 'today', day], async (store, pid): Promise<Reading[]> => {
    const since = Date.parse(startOfLocalDay(dayStart(day)));
    const lists = await Promise.all([
      ...CHECKINS.map((type) => listItems<ReadingData>(store, pid, readingKind(type))),
      ...TALLIES.map((type) => listItems<ReadingData>(store, pid, tallyKind(type, day))),
    ]);
    return lists
      .flat()
      .map(toReading(pid))
      .filter((r) => Date.parse(r.taken_at) >= since)
      .sort(byTakenAt);
  });
}

/** The newest weight, BP, sugar and sleep reading, whenever they were logged. */
export function useLatestCheckins(pregnancyId: string | undefined) {
  return useVaultQuery(pregnancyId, ['readings', 'latest'], async (store, pid) => {
    const latest: Partial<Record<CheckinType, Reading>> = {};
    for (const type of CHECKINS) {
      const rows = (await listItems<ReadingData>(store, pid, readingKind(type))).map(toReading(pid)).sort(byTakenAt);
      if (rows.length) latest[type] = rows[rows.length - 1];
    }
    return latest;
  });
}

export function useLogCheckin(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  const { session } = useSession();
  return useMutation({
    mutationFn: async (input: { type: CheckinType; value_num: number; value_num2: number | null; value_text?: string | null }) => {
      const data: ReadingData = {
        type: input.type,
        value_num: input.value_num,
        value_num2: input.value_num2,
        value_text: input.value_text ?? null,
        taken_at: new Date().toISOString(),
        logged_by: session?.user.id ?? '',
      };
      await saveItem(vault, { id: newId(), pregnancyId: pregnancyId!, kind: readingKind(input.type), data });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.readings(pregnancyId ?? 'none') }),
  });
}

/**
 * Kicks and glasses of water: one record per tap, so taps from both phones
 * never overwrite each other. Removing takes away the tap with that id
 * (Today passes the newest one).
 */
export function useTally(pregnancyId: string | undefined, type: Tally, day: string) {
  const queryClient = useQueryClient();
  const vault = useVault();
  const { session } = useSession();
  const settle = () => queryClient.invalidateQueries({ queryKey: keys.readings(pregnancyId ?? 'none') });

  const add = useMutation({
    mutationFn: async () => {
      const data: ReadingData = {
        type,
        value_num: 1,
        value_num2: null,
        value_text: null,
        taken_at: new Date().toISOString(),
        logged_by: session?.user.id ?? '',
      };
      await saveItem(vault, { id: newId(), pregnancyId: pregnancyId!, kind: tallyKind(type, day), data });
    },
    onSettled: settle,
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeItems(vault, [id]),
    onSettled: settle,
  });

  return { add, remove };
}

// ---------------------------------------------------------------------------
// Profile: pregnancy details, name, reminders, partner
// ---------------------------------------------------------------------------

/**
 * Saves edits to the pregnancy details. They go into the vault, never to the
 * readable `pregnancies` row; the whole set is kept as one record.
 */
export function useUpdatePregnancy(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  const membership = useMembership();
  return useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const current = membership.data?.pregnancy;
      if (!current || current.id !== pregnancyId) throw new Error('The pregnancy hasn’t loaded yet.');
      const next = { ...pregnancyDetails(current as unknown as Record<string, unknown>), ...patch };
      if (typeof patch.lmp_date === 'string') next.due_date = dueDateFromLmp(patch.lmp_date);
      await saveItem(vault, { id: pregnancyDetailsId(pregnancyId!), pregnancyId: pregnancyId!, kind: PREGNANCY_KIND, data: next });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.pregnancy(pregnancyId ?? 'none') }),
  });
}

export function useUpdateName() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('profiles').update({ name }).eq('id', session!.user.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });
}

export type Member = { user_id: string; role: 'owner' | 'partner'; name: string | null };

export function useMembers(pregnancyId: string | undefined) {
  return useQuery({
    queryKey: keys.members(pregnancyId ?? 'none'),
    enabled: !!pregnancyId,
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from('members')
        .select('user_id, role, profile:profiles(name)')
        .eq('pregnancy_id', pregnancyId!);
      if (error) throw error;
      return (data as unknown as { user_id: string; role: Member['role']; profile: { name: string | null } | null }[]).map(
        (m) => ({ user_id: m.user_id, role: m.role, name: m.profile?.name ?? null }),
      );
    },
  });
}

export function useRemovePartner(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('members').delete().eq('pregnancy_id', pregnancyId!).eq('user_id', userId).eq('role', 'partner');
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.members(pregnancyId ?? 'none') }),
  });
}

export type Invite = { id: string; code: string; expires_at: string };

/** The owner's newest code that can still be used, if any. */
export function useOpenInvite(pregnancyId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: keys.invite(pregnancyId ?? 'none'),
    enabled: !!pregnancyId && enabled,
    queryFn: async (): Promise<Invite | null> => {
      const { data, error } = await supabase
        .from('invites')
        .select('id, code, expires_at')
        .eq('pregnancy_id', pregnancyId!)
        .is('accepted_by', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Makes a fresh 6-digit code. The database replaces any unused code in the
 * same transaction, so only one code works at a time.
 */
export function useCreateInvite(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<Invite> => {
      const { data, error } = await supabase.rpc('new_invite', { p_pregnancy_id: pregnancyId! });
      if (error) throw error;
      const row = data as Invite;
      return { id: row.id, code: row.code, expires_at: row.expires_at };
    },
    onSuccess: (invite) => queryClient.setQueryData(keys.invite(pregnancyId ?? 'none'), invite),
  });
}

export type ReminderPrefs = Record<ReminderKind, boolean>;

/** This person's reminder switches. Missing rows count as on, like the table default. */
export function useReminderPrefs(pregnancyId: string | undefined) {
  const { session } = useSession();
  const userId = session?.user.id ?? 'signed-out';
  return useQuery({
    queryKey: keys.reminders(pregnancyId ?? 'none', userId),
    enabled: !!pregnancyId && !!session,
    queryFn: async (): Promise<ReminderPrefs> => {
      const { data, error } = await supabase
        .from('reminder_prefs')
        .select('kind, enabled')
        .eq('pregnancy_id', pregnancyId!)
        .eq('user_id', userId);
      if (error) throw error;
      const prefs = Object.fromEntries(REMINDERS.map((r) => [r.kind, true])) as ReminderPrefs;
      for (const row of data) if (row.kind in prefs) prefs[row.kind as ReminderKind] = row.enabled;
      return prefs;
    },
  });
}

export function useSetReminder(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id ?? 'signed-out';
  const key = keys.reminders(pregnancyId ?? 'none', userId);
  return useMutation({
    mutationFn: async ({ kind, enabled }: { kind: ReminderKind; enabled: boolean }) => {
      const { error } = await supabase
        .from('reminder_prefs')
        .upsert({ pregnancy_id: pregnancyId!, user_id: userId, kind, enabled }, { onConflict: 'pregnancy_id,user_id,kind' });
      if (error) throw error;
    },
    onMutate: async ({ kind, enabled }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ReminderPrefs>(key);
      if (previous) queryClient.setQueryData<ReminderPrefs>(key, { ...previous, [kind]: enabled });
      return { previous };
    },
    onError: (_e, _v, ctx) => queryClient.setQueryData(key, ctx?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

// ---------------------------------------------------------------------------
// Vitamins: medications and the days they were taken
// ---------------------------------------------------------------------------

type MedicationData = Omit<Medication, 'id' | 'pregnancy_id'>;
type DoseData = Omit<Dose, 'pregnancy_id'>;

/**
 * How many recent doses to load. The streak walks back through them, so a
 * perfect run longer than this many doses is shown as a little shorter than
 * it is; at six medicines a day that is still about 160 days.
 */
const DOSE_LIMIT = 1000;

/** One dose record per medicine per day, the same on both phones, so ticking it twice leaves one. */
export const doseId = (medicationId: string, day: string) => stableId('dose', medicationId, day);

export function useMedications(pregnancyId: string | undefined) {
  return useVaultQuery(pregnancyId, ['meds'], async (store, pid): Promise<Medication[]> =>
    (await listItems<MedicationData>(store, pid, 'medication'))
      .map((item) => ({ id: item.id, pregnancy_id: pid, ...item.data }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)),
  );
}

export function useDoses(pregnancyId: string | undefined) {
  return useVaultQuery(pregnancyId, ['doses'], async (store, pid): Promise<Dose[]> =>
    (await listItems<DoseData>(store, pid, 'dose'))
      .map((item) => ({ pregnancy_id: pid, ...item.data }))
      .sort((a, b) => b.day.localeCompare(a.day))
      .slice(0, DOSE_LIMIT),
  );
}

export function useAddMedication(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  return useMutation({
    mutationFn: async (row: MedicationRow) => {
      const data: MedicationData = { end_date: null, ...row, created_at: new Date().toISOString() };
      await saveItem(vault, { id: newId(), pregnancyId: pregnancyId!, kind: 'medication', data });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.meds(pregnancyId ?? 'none') }),
  });
}

/** Adds several medicines at once, such as the ones ticked on a scanned prescription. */
export function useAddMedications(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  return useMutation({
    mutationFn: async (rows: MedicationRow[]) => {
      const now = Date.now();
      // A millisecond apart, so they list in the prescription's order.
      for (const [i, row] of rows.entries()) {
        const data: MedicationData = { end_date: null, ...row, created_at: new Date(now + i).toISOString() };
        await saveItem(vault, { id: newId(), pregnancyId: pregnancyId!, kind: 'medication', data });
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.meds(pregnancyId ?? 'none') }),
  });
}

/** Deletes a medicine and, with it, its history. */
export function useRemoveMedication(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  return useMutation({
    mutationFn: async (id: string) => {
      const doses = await listItems<DoseData>(readyStore(vault), pregnancyId!, 'dose');
      await removeItems(vault, [id, ...doses.filter((d) => d.data.medication_id === id).map((d) => d.id)]);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.meds(pregnancyId ?? 'none') }),
        queryClient.invalidateQueries({ queryKey: keys.doses(pregnancyId ?? 'none') }),
      ]),
  });
}

/**
 * Ticks a dose off for a day, or un-ticks it. Toggles run one after another,
 * so tapping the same medicine twice quickly can't land in the wrong order.
 */
export function useToggleDose(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  const { session } = useSession();
  return useMutation({
    scope: { id: `doses:${pregnancyId ?? 'none'}` },
    mutationFn: async ({ medicationId, day, taken }: { medicationId: string; day: string; taken: boolean }) => {
      const id = doseId(medicationId, day);
      if (!taken) return removeItems(vault, [id]);
      const data: DoseData = { medication_id: medicationId, day, taken_at: new Date().toISOString(), logged_by: session?.user.id ?? null };
      await saveItem(vault, { id, pregnancyId: pregnancyId!, kind: 'dose', data });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.doses(pregnancyId ?? 'none') }),
  });
}

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

type AppointmentData = AppointmentRow;

export function useAppointments(pregnancyId: string | undefined) {
  return useVaultQuery(pregnancyId, ['appointments'], async (store, pid): Promise<Appointment[]> =>
    (await listItems<AppointmentData>(store, pid, 'appointment'))
      .map((item) => toAppointment({ id: item.id, pregnancy_id: pid, ...item.data }))
      .sort((a, b) => a.appt_date.localeCompare(b.appt_date)),
  );
}

/** Books an appointment for both of them. */
export function useAddAppointment(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  return useMutation({
    mutationFn: async (row: AppointmentRow): Promise<Appointment> => {
      const id = newId();
      await saveItem(vault, { id, pregnancyId: pregnancyId!, kind: 'appointment', data: row });
      return toAppointment({ id, pregnancy_id: pregnancyId!, ...row });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.appointments(pregnancyId ?? 'none') }),
  });
}

/** Cancels an appointment for both of them. */
export function useRemoveAppointment(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  return useMutation({
    mutationFn: (id: string) => removeItems(vault, [id]),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.appointments(pregnancyId ?? 'none') }),
  });
}
