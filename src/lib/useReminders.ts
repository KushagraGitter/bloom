import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAppointments, useDoses, useLocalToday, useMedications, useMembership, useReminderPrefs } from '@/lib/data';
import { askForPermission, clearScheduled, permissionState, replaceScheduled, type PermissionState } from '@/lib/notifications';
import { planReminders, planSignature } from '@/lib/reminders';
import { useSession } from '@/lib/session';

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

/**
 * Keeps the reminders scheduled on this phone matching this person's switches
 * and what the app knows: the vitamins still to take, the appointments, the
 * week of pregnancy. Mounted once, at the root.
 *
 * The phone is only touched once everything the plan depends on has loaded, so
 * a slow connection never wipes the reminders it already has. Signed out, or
 * with no pregnancy to follow, nothing stays scheduled.
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

  // One change to the phone at a time, and the last plan it was given.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const applied = useRef<string | null>(null);

  // The phone's prompt is shown the first time any reminder is switched on.
  const wantsAny = !!prefs.data && Object.values(prefs.data).some(Boolean);
  const asked = useRef(false);
  useEffect(() => {
    if (permission !== 'undetermined' || !wantsAny || asked.current) return;
    asked.current = true;
    ask();
  }, [permission, wantsAny, ask]);

  // `day` is listed so each new day brings its vitamin reminders into the window.
  useEffect(() => {
    if (permission !== 'granted' || !pregnancy || !prefs.data || !medications.data || !doses.data || !appointments.data) return;
    const plan = planReminders({
      prefs: prefs.data,
      medications: medications.data,
      doses: doses.data,
      appointments: appointments.data,
      lmpDate: pregnancy.lmp_date,
      now: new Date(),
    });
    const signature = planSignature(plan);
    if (signature === applied.current) return;
    applied.current = signature;
    queue.current = queue.current.then(() => replaceScheduled(plan)).catch(() => {
      applied.current = null;
    });
  }, [permission, pregnancy, prefs.data, medications.data, doses.data, appointments.data, day]);

  // Nobody to remind: signed out, or the pregnancy is gone (a removed partner).
  const nobody = !loading && (!session || (membership.isSuccess && membership.data === null));
  useEffect(() => {
    if (!nobody) return;
    applied.current = null;
    queue.current = queue.current.then(clearScheduled).catch(() => {});
  }, [nobody]);
}
