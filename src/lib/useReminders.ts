import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAppointments, useDoses, useLocalToday, useMedications, useMembership, useReminderPrefs } from '@/lib/data';
import { askForPermission, clearScheduled, permissionState, replaceScheduled, type PermissionState } from '@/lib/notifications';
import { planReminders, planSignature, type PlannedReminder } from '@/lib/reminders';
import { useSession } from '@/lib/session';
import { useWeekNudge } from '@/lib/weekNudge';

/**
 * Whether the phone lets the app show notifications. It is read again when the
 * app comes back to the foreground, so turning them on in Settings shows up.
 */
export function useNotificationPermission() {
  const [state, setState] = useState<PermissionState | 'checking'>('checking');
  useEffect(() => {
    let active = true;
    const refresh = () => {
      permissionState().then((next) => {
        if (active) setState(next);
      });
    };
    refresh();
    const sub = AppState.addEventListener('change', (next) => next === 'active' && refresh());
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  const ask = useCallback(async () => {
    setState(await askForPermission());
  }, []);
  return { state, ask };
}

/** What the phone should be told next: this plan (with its signature), or to hold nothing. */
type Wish = { plan: PlannedReminder[]; signature: string } | { plan: null };

/**
 * Keeps the reminders scheduled on this phone matching this person's switches
 * and what the app knows: the vitamins still to take, the appointments, the
 * week of pregnancy. Mounted once, at the root.
 *
 * The phone is only touched once everything the plan depends on has loaded, so
 * a slow connection never wipes the reminders it already has. Nothing stays
 * scheduled once the person has signed out or the pregnancy is gone. A phone
 * that opens with no sign-in at all (offline, with the last one out of date)
 * keeps what it has until the sign-in comes back.
 */
export function useReminders(): void {
  const { session, loading } = useSession();
  const membership = useMembership();
  const pregnancy = membership.data?.pregnancy;
  const prefs = useReminderPrefs(pregnancy?.id);
  const medications = useMedications(pregnancy?.id);
  const doses = useDoses(pregnancy?.id);
  const appointments = useAppointments(pregnancy?.id);
  const day = useLocalToday();
  const { state: permission, ask } = useNotificationPermission();
  const weekNudge = useWeekNudge((s) => s.on);
  const loadWeekNudge = useWeekNudge((s) => s.load);
  useEffect(() => {
    loadWeekNudge();
  }, [loadWeekNudge]);

  // The signature of the plan the phone was last given or is on its way to.
  const applied = useRef<string | null>(null);

  // The phone is changed one step at a time, and only the newest wish is kept while a step is
  // under way: a run of ticks costs one more pass over the phone, not one for every tick.
  const wish = useRef<Wish | null>(null);
  const working = useRef(false);
  const request = useCallback(async (next: Wish) => {
    wish.current = next;
    if (working.current) return;
    working.current = true;
    try {
      while (wish.current) {
        const current = wish.current;
        wish.current = null;
        try {
          await (current.plan ? replaceScheduled(current.plan) : clearScheduled());
        } catch {
          // The phone may be missing some of it, so the same plan is offered again on the next change.
          if (current.plan && applied.current === current.signature) applied.current = null;
        }
      }
    } finally {
      working.current = false;
    }
  }, []);

  // The phone's prompt is shown the first time any reminder is switched on.
  const wantsAny = (!!prefs.data && Object.values(prefs.data).some(Boolean)) || !!weekNudge;
  const asked = useRef(false);
  useEffect(() => {
    if (permission !== 'undetermined' || !wantsAny || asked.current) return;
    asked.current = true;
    ask();
  }, [permission, wantsAny, ask]);

  // `day` is listed so each new day brings its vitamin reminders into the window.
  useEffect(() => {
    if (permission !== 'granted' || !pregnancy || !prefs.data || !medications.data || !doses.data || !appointments.data || weekNudge === null)
      return;
    const plan = planReminders({
      prefs: prefs.data,
      medications: medications.data,
      doses: doses.data,
      appointments: appointments.data,
      lmpDate: pregnancy.lmp_date,
      weekNudge,
      now: new Date(),
    });
    const signature = planSignature(plan);
    if (signature === applied.current) return;
    applied.current = signature;
    request({ plan, signature });
  }, [permission, pregnancy, prefs.data, medications.data, doses.data, appointments.data, weekNudge, day, request]);

  // Nobody to remind: she signed out while the app was open, or the pregnancy is gone (a removed
  // partner). Opening with no session is not the same as signing out, so it clears nothing.
  const signedIn = !!session;
  const wasSignedIn = useRef(false);
  const removed = signedIn && membership.isSuccess && membership.data === null;
  useEffect(() => {
    if (signedIn) wasSignedIn.current = true;
    const signedOut = !signedIn && !loading && wasSignedIn.current;
    if (!signedOut && !removed) return;
    applied.current = null;
    request({ plan: null });
  }, [signedIn, loading, removed, request]);
}
