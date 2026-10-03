/**
 * The phone's local notifications: asking permission, and replacing what is
 * scheduled. `reminders.ts` works out what should be scheduled; this puts it
 * there. Everything quietly does nothing on the web, where there is nothing to
 * schedule.
 */
import { PermissionStatus } from 'expo';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import type { PlannedReminder } from '@/lib/reminders';

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

const CHANNEL = 'reminders';

/** The test reminder's own id, so refreshing the real ones leaves it alone. */
const TEST_ID = 'test-reminder';

function supported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

if (supported()) {
  // A reminder shows as a banner even while the app is open.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Android needs a channel before it will show, or ask to show, anything. */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

function toState(permissions: Notifications.NotificationPermissionsStatus): PermissionState {
  if (permissions.granted || permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return permissions.status === PermissionStatus.UNDETERMINED ? 'undetermined' : 'denied';
}

/** Whether the app may show notifications, without asking. */
export async function permissionState(): Promise<PermissionState> {
  if (!supported()) return 'unavailable';
  try {
    return toState(await Notifications.getPermissionsAsync());
  } catch {
    return 'unavailable';
  }
}

/** Shows the phone's permission prompt (it only ever appears once), then says what was decided. */
export async function askForPermission(): Promise<PermissionState> {
  if (!supported()) return 'unavailable';
  try {
    await ensureChannel();
    return toState(await Notifications.requestPermissionsAsync());
  } catch {
    return 'unavailable';
  }
}

/**
 * Makes the phone's scheduled reminders exactly `plan`. The ones no longer
 * wanted are cancelled first, so the phone never holds more than the plan (an
 * iPhone drops everything past its 64 soonest), then each wanted one is
 * scheduled; a reminder with the same key is replaced in place. If the app is
 * closed halfway the rest is scheduled the next time it opens.
 */
export async function replaceScheduled(plan: PlannedReminder[]): Promise<void> {
  if (!supported()) return;
  await ensureChannel();
  const now = Date.now();
  const wanted = plan.filter((r) => r.trigger.type === 'daily' || r.trigger.at.getTime() > now);
  const keep = new Set(wanted.map((r) => r.key));
  for (const n of await Notifications.getAllScheduledNotificationsAsync()) {
    if (n.identifier !== TEST_ID && !keep.has(n.identifier)) await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
  for (const r of wanted) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.key,
      content: { title: r.title, body: r.body, data: { kind: r.kind } },
      trigger:
        r.trigger.type === 'daily'
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: r.trigger.hour,
              minute: r.trigger.minute,
              channelId: CHANNEL,
            }
          : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.trigger.at, channelId: CHANNEL },
    });
  }
}

/** Takes every scheduled reminder away, for when nobody is signed in or the pregnancy is gone. */
export async function clearScheduled(): Promise<void> {
  if (!supported()) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** One reminder a few seconds from now, to see how they look and that they arrive. */
export async function sendTestReminder(): Promise<void> {
  if (!supported()) return;
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: TEST_ID,
    content: { title: 'Bloom reminders are on', body: 'This is how a reminder will look.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL },
  });
}

export function openSystemSettings(): Promise<void> {
  return Linking.openSettings();
}
