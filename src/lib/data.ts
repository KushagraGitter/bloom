import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { REMINDERS, toPregnancyInsert, type Answers } from '@/lib/onboarding';
import { localToday } from '@/lib/pregnancy';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export type Pregnancy = {
  id: string;
  owner_id: string;
  lmp_date: string;
  due_date: string;
  method: 'lmp' | 'due' | 'ivf';
  nickname: string | null;
  babies: number;
};

export type Membership = { role: 'owner' | 'partner'; pregnancy: Pregnancy };

export type Profile = { id: string; name: string | null; avatar_url: string | null };

export const keys = {
  membership: (userId: string) => ['membership', userId] as const,
  profile: (userId: string) => ['profile', userId] as const,
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
        .select('role, pregnancy:pregnancies(id, owner_id, lmp_date, due_date, method, nickname, babies)')
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
