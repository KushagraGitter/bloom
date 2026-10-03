import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { REMINDERS, toPregnancyInsert, type Answers, type ReminderKind } from '@/lib/onboarding';
import { localToday } from '@/lib/pregnancy';
import type { PregnancyRow } from '@/lib/profile';
import { CHECKINS, startOfLocalDay, type CheckinType, type Reading } from '@/lib/readings';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { Dose, Medication, MedicationRow } from '@/lib/vitamins';

export type Pregnancy = PregnancyRow;

export type Membership = { role: 'owner' | 'partner'; pregnancy: Pregnancy };

export type Profile = { id: string; name: string | null; avatar_url: string | null };

export const keys = {
  membership: (userId: string) => ['membership', userId] as const,
  profile: (userId: string) => ['profile', userId] as const,
  readings: (pregnancyId: string) => ['readings', pregnancyId] as const,
  today: (pregnancyId: string, day: string) => ['readings', pregnancyId, 'today', day] as const,
  latest: (pregnancyId: string) => ['readings', pregnancyId, 'latest'] as const,
  members: (pregnancyId: string) => ['members', pregnancyId] as const,
  invite: (pregnancyId: string) => ['invite', pregnancyId] as const,
  reminders: (pregnancyId: string, userId: string) => ['reminders', pregnancyId, userId] as const,
  meds: (pregnancyId: string) => ['meds', pregnancyId] as const,
  doses: (pregnancyId: string) => ['doses', pregnancyId] as const,
};

/** The pregnancy the signed-in user belongs to, or null if they haven't set one up or joined one. */
export function useMembership() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
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

/**
 * Saves onboarding: the profile name, the pregnancy (its owner membership is
 * added by a database trigger) and the reminder choices. Does not refresh the
 * membership query, so the "You're all set" screen can show before the app
 * switches to the tabs; call `finishOnboarding` for that.
 */
export function useCreatePregnancy() {
  const { session } = useSession();
  return useMutation({
    mutationFn: async (answers: Answers) => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Not signed in.');
      const row = toPregnancyInsert(answers, localToday());

      const { error: profileError } = await supabase.from('profiles').update({ name: answers.name.trim() }).eq('id', userId);
      if (profileError) throw profileError;

      // If an earlier attempt got as far as creating the pregnancy, update it
      // rather than creating a second one.
      const { data: existing, error: findError } = await supabase
        .from('pregnancies')
        .select('id')
        .eq('owner_id', userId)
        .limit(1)
        .maybeSingle();
      if (findError) throw findError;

      const { data: pregnancy, error } = existing
        ? await supabase.from('pregnancies').update(row).eq('id', existing.id).select('id').single()
        : await supabase.from('pregnancies').insert(row).select('id').single();
      if (error) throw error;

      const { error: prefsError } = await supabase.from('reminder_prefs').upsert(
        REMINDERS.map((r) => ({
          pregnancy_id: pregnancy.id,
          user_id: userId,
          kind: r.kind,
          enabled: answers.reminders[r.kind],
        })),
        { onConflict: 'pregnancy_id,user_id,kind' },
      );
      if (prefsError) throw prefsError;
      return pregnancy.id as string;
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

const READING_COLUMNS = 'id, pregnancy_id, type, value_num, value_num2, value_text, taken_at, logged_by';

/** Everything logged since local midnight (kicks and water are counted from this). */
export function useTodayReadings(pregnancyId: string | undefined, day: string) {
  return useQuery({
    queryKey: keys.today(pregnancyId ?? 'none', day),
    enabled: !!pregnancyId,
    queryFn: async (): Promise<Reading[]> => {
      const { data, error } = await supabase
        .from('readings')
        .select(READING_COLUMNS)
        .eq('pregnancy_id', pregnancyId!)
        .gte('taken_at', startOfLocalDay(dayStart(day)))
        .order('taken_at', { ascending: true });
      if (error) throw error;
      return data as Reading[];
    },
  });
}

/** The newest weight, BP, sugar and sleep reading, whenever they were logged. */
export function useLatestCheckins(pregnancyId: string | undefined) {
  return useQuery({
    queryKey: keys.latest(pregnancyId ?? 'none'),
    enabled: !!pregnancyId,
    queryFn: async (): Promise<Partial<Record<CheckinType, Reading>>> => {
      const rows = await Promise.all(
        CHECKINS.map(async (type) => {
          const { data, error } = await supabase
            .from('readings')
            .select(READING_COLUMNS)
            .eq('pregnancy_id', pregnancyId!)
            .eq('type', type)
            .order('taken_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (error) throw error;
          return [type, data] as const;
        }),
      );
      return Object.fromEntries(rows.filter(([, r]) => r)) as Partial<Record<CheckinType, Reading>>;
    },
  });
}

export function useLogCheckin(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { type: CheckinType; value_num: number; value_num2: number | null; value_text?: string | null }) => {
      const { error } = await supabase.from('readings').insert({
        pregnancy_id: pregnancyId!,
        type: input.type,
        value_num: input.value_num,
        value_num2: input.value_num2,
        value_text: input.value_text ?? null,
      });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.readings(pregnancyId ?? 'none') }),
  });
}

/**
 * Kicks and glasses of water: one row per tap, so taps from both phones never
 * overwrite each other. Removing takes away today's newest row of that type.
 * Today's list updates straight away and is put right if the write fails.
 */
export function useTally(pregnancyId: string | undefined, type: 'kicks' | 'water', day: string) {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const todayKey = keys.today(pregnancyId ?? 'none', day);

  const optimistic = async (change: (rows: Reading[]) => Reading[]) => {
    await queryClient.cancelQueries({ queryKey: todayKey });
    const previous = queryClient.getQueryData<Reading[]>(todayKey);
    queryClient.setQueryData<Reading[]>(todayKey, (rows) => change(rows ?? []));
    return { previous };
  };
  const rollback = (_e: unknown, _v: unknown, ctx: { previous?: Reading[] } | undefined) =>
    queryClient.setQueryData(todayKey, ctx?.previous);
  const settle = () => queryClient.invalidateQueries({ queryKey: keys.readings(pregnancyId ?? 'none') });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('readings').insert({ pregnancy_id: pregnancyId!, type, value_num: 1 });
      if (error) throw error;
    },
    onMutate: () =>
      optimistic((rows) => [
        ...rows,
        {
          id: `pending-${Date.now()}`,
          pregnancy_id: pregnancyId!,
          type,
          value_num: 1,
          value_num2: null,
          value_text: null,
          taken_at: new Date().toISOString(),
          logged_by: session?.user.id ?? '',
        },
      ]),
    onError: rollback,
    onSettled: settle,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('readings').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: (id: string) => optimistic((rows) => rows.filter((r) => r.id !== id)),
    onError: rollback,
    onSettled: settle,
  });

  return { add, remove };
}

/**
 * Live sync: when either phone logs, ticks, adds, edits or removes something,
 * refetch it. One channel covers everything, so call this once, from the tabs
 * layout, rather than from each screen (a second subscription to the same
 * channel name would throw).
 *
 * Inserts and updates are filtered to this pregnancy. Deletes can't be (only
 * the id is sent), so any delete triggers a refetch; RLS still decides what
 * the refetch returns.
 */
export function useRealtimeSync(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!pregnancyId) return;
    const filter = `pregnancy_id=eq.${pregnancyId}`;
    const tables = [
      ['readings', keys.readings(pregnancyId)],
      ['medications', keys.meds(pregnancyId)],
      ['med_doses', keys.doses(pregnancyId)],
    ] as const;
    const channel = supabase.channel(`pregnancy:${pregnancyId}`);
    for (const [table, key] of tables) {
      const refresh = () => queryClient.invalidateQueries({ queryKey: key });
      channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, refresh)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter }, refresh)
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, refresh);
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [pregnancyId, queryClient]);
}

// ---------------------------------------------------------------------------
// Profile: pregnancy details, name, reminders, partner
// ---------------------------------------------------------------------------

export function useUpdatePregnancy(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase.from('pregnancies').update(patch).eq('id', pregnancyId!);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['membership'] }),
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

const MED_COLUMNS = 'id, pregnancy_id, name, dose, time_of_day, start_date, end_date, created_at';
const DOSE_COLUMNS = 'medication_id, pregnancy_id, day, taken_at, logged_by';

/**
 * How many recent doses to load. The streak walks back through them, so a
 * perfect run longer than this many doses is shown as a little shorter than
 * it is; at six medicines a day that is still about 160 days.
 */
const DOSE_LIMIT = 1000;

export function useMedications(pregnancyId: string | undefined) {
  return useQuery({
    queryKey: keys.meds(pregnancyId ?? 'none'),
    enabled: !!pregnancyId,
    queryFn: async (): Promise<Medication[]> => {
      const { data, error } = await supabase
        .from('medications')
        .select(MED_COLUMNS)
        .eq('pregnancy_id', pregnancyId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Medication[];
    },
  });
}

export function useDoses(pregnancyId: string | undefined) {
  return useQuery({
    queryKey: keys.doses(pregnancyId ?? 'none'),
    enabled: !!pregnancyId,
    queryFn: async (): Promise<Dose[]> => {
      const { data, error } = await supabase
        .from('med_doses')
        .select(DOSE_COLUMNS)
        .eq('pregnancy_id', pregnancyId!)
        .order('day', { ascending: false })
        .limit(DOSE_LIMIT);
      if (error) throw error;
      return (data ?? []) as Dose[];
    },
  });
}

export function useAddMedication(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (row: MedicationRow) => {
      const { error } = await supabase.from('medications').insert({ pregnancy_id: pregnancyId!, ...row });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.meds(pregnancyId ?? 'none') }),
  });
}

/** Deletes a medicine and, with it, its history. The list updates straight away. */
export function useRemoveMedication(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const medsKey = keys.meds(pregnancyId ?? 'none');
  const dosesKey = keys.doses(pregnancyId ?? 'none');
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('medications').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id: string) => {
      await Promise.all([queryClient.cancelQueries({ queryKey: medsKey }), queryClient.cancelQueries({ queryKey: dosesKey })]);
      const meds = queryClient.getQueryData<Medication[]>(medsKey);
      const doses = queryClient.getQueryData<Dose[]>(dosesKey);
      queryClient.setQueryData<Medication[]>(medsKey, (rows) => rows?.filter((m) => m.id !== id));
      queryClient.setQueryData<Dose[]>(dosesKey, (rows) => rows?.filter((d) => d.medication_id !== id));
      return { meds, doses };
    },
    onError: (_e, _id, ctx) => {
      queryClient.setQueryData(medsKey, ctx?.meds);
      queryClient.setQueryData(dosesKey, ctx?.doses);
    },
    onSettled: () => Promise.all([queryClient.invalidateQueries({ queryKey: medsKey }), queryClient.invalidateQueries({ queryKey: dosesKey })]),
  });
}

/**
 * Ticks a dose off for a day, or un-ticks it. The list updates straight away
 * and is put right if the write fails. Toggles run one after another, so
 * tapping the same medicine twice quickly can't have its insert and delete
 * land in the wrong order.
 */
export function useToggleDose(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const key = keys.doses(pregnancyId ?? 'none');
  const mutationKey = ['dose', pregnancyId ?? 'none'];
  return useMutation({
    mutationKey,
    scope: { id: `doses:${pregnancyId ?? 'none'}` },
    mutationFn: async ({ medicationId, day, taken }: { medicationId: string; day: string; taken: boolean }) => {
      if (taken) {
        // "Ignore duplicates" so two phones ticking at once leave one row.
        const { error } = await supabase
          .from('med_doses')
          .upsert({ pregnancy_id: pregnancyId!, medication_id: medicationId, day }, { onConflict: 'medication_id,day', ignoreDuplicates: true });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('med_doses').delete().eq('medication_id', medicationId).eq('day', day);
        if (error) throw error;
      }
    },
    onMutate: async ({ medicationId, day, taken }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Dose[]>(key);
      const without = (rows: Dose[]) => rows.filter((d) => !(d.medication_id === medicationId && d.day === day));
      queryClient.setQueryData<Dose[]>(key, (rows = []) =>
        taken
          ? [
              {
                medication_id: medicationId,
                pregnancy_id: pregnancyId!,
                day,
                taken_at: new Date().toISOString(),
                logged_by: session?.user.id ?? null,
              },
              ...without(rows),
            ]
          : without(rows),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => queryClient.setQueryData(key, ctx?.previous),
    onSettled: () => {
      // While more toggles are queued, wait: refetching now would show the
      // server's state without them and the ticks would flicker back.
      if (queryClient.isMutating({ mutationKey }) <= 1) queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
