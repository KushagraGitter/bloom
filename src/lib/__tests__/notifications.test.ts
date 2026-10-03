import { PermissionStatus } from 'expo';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import {
  askForPermission,
  clearScheduled,
  openSystemSettings,
  permissionState,
  replaceScheduled,
  sendTestReminder,
} from '@/lib/notifications';
import type { PlannedReminder } from '@/lib/reminders';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  scheduleNotificationAsync: jest.fn(async () => 'scheduled'),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  AndroidImportance: { DEFAULT: 3 },
  IosAuthorizationStatus: { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
  SchedulableTriggerInputTypes: { DAILY: 'daily', DATE: 'date', TIME_INTERVAL: 'timeInterval' },
}));

const mock = jest.mocked(Notifications);

/** What the phone says about permission, with only the parts the app reads. */
const permissions = (status: PermissionStatus, over: Record<string, unknown> = {}) =>
  ({ status, granted: status === PermissionStatus.GRANTED, canAskAgain: true, expires: 'never', ...over }) as never;

const pending = (...identifiers: string[]) =>
  mock.getAllScheduledNotificationsAsync.mockResolvedValue(identifiers.map((identifier) => ({ identifier })) as never);

const daily = (key: string, hour: number): PlannedReminder => ({
  key,
  kind: 'water',
  title: 'A glass of water?',
  body: 'Tap a glass on Today to count it.',
  trigger: { type: 'daily', hour, minute: 0 },
});

const once = (key: string, at: Date): PlannedReminder => ({
  key,
  kind: 'vitamins',
  title: 'Morning vitamins',
  body: 'Folic acid',
  trigger: { type: 'date', at },
});

const FUTURE = new Date(2099, 0, 1, 8, 0);
const PAST = new Date(2020, 0, 1, 8, 0);

/** Every call into the notifications package, in the order they were made. */
function callsInOrder(): string[] {
  const names = [
    'setNotificationChannelAsync',
    'getAllScheduledNotificationsAsync',
    'scheduleNotificationAsync',
    'cancelScheduledNotificationAsync',
    'requestPermissionsAsync',
  ] as const;
  return names
    .flatMap((name) => mock[name].mock.invocationCallOrder.map((order) => ({ name, order })))
    .sort((a, b) => a.order - b.order)
    .map((c) => c.name);
}

/**
 * Loads the module again from scratch, as the app does when it starts, and
 * returns the handlers it gave the notifications package while loading.
 */
function loadFresh(os?: 'web'): { handlers: Notifications.NotificationHandler[] } {
  const loaded: { handlers: Notifications.NotificationHandler[] } = { handlers: [] };
  jest.isolateModules(() => {
    // The fresh copy has its own `Platform`, so the one set above does not reach it.
    if (os) jest.replaceProperty(jest.requireActual<{ Platform: typeof Platform }>('react-native').Platform, 'OS', os);
    jest.requireActual('@/lib/notifications');
    const { setNotificationHandler } = jest.requireMock<typeof Notifications>('expo-notifications');
    for (const [handler] of jest.mocked(setNotificationHandler).mock.calls) if (handler) loaded.handlers.push(handler);
  });
  return loaded;
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mock.getAllScheduledNotificationsAsync.mockResolvedValue([]);
});

describe('on a phone', () => {
  describe('permissionState', () => {
    it('says whether the phone has allowed notifications, without asking', async () => {
      mock.getPermissionsAsync.mockResolvedValue(permissions(PermissionStatus.GRANTED));
      expect(await permissionState()).toBe('granted');
      mock.getPermissionsAsync.mockResolvedValue(permissions(PermissionStatus.DENIED, { canAskAgain: false }));
      expect(await permissionState()).toBe('denied');
      mock.getPermissionsAsync.mockResolvedValue(permissions(PermissionStatus.UNDETERMINED));
      expect(await permissionState()).toBe('undetermined');
      expect(mock.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('counts an iPhone’s quiet, provisional permission as allowed', async () => {
      mock.getPermissionsAsync.mockResolvedValue(
        permissions(PermissionStatus.DENIED, { ios: { status: Notifications.IosAuthorizationStatus.PROVISIONAL } }),
      );
      expect(await permissionState()).toBe('granted');
    });

    it('is unavailable when the phone cannot say', async () => {
      mock.getPermissionsAsync.mockRejectedValue(new Error('no module'));
      expect(await permissionState()).toBe('unavailable');
    });
  });

  describe('askForPermission', () => {
    it('shows the phone’s prompt and reports what was decided', async () => {
      mock.requestPermissionsAsync.mockResolvedValue(permissions(PermissionStatus.GRANTED));
      expect(await askForPermission()).toBe('granted');
      mock.requestPermissionsAsync.mockResolvedValue(permissions(PermissionStatus.DENIED));
      expect(await askForPermission()).toBe('denied');
    });

    it('is unavailable when the prompt fails', async () => {
      mock.requestPermissionsAsync.mockRejectedValue(new Error('no module'));
      expect(await askForPermission()).toBe('unavailable');
    });

    it('sets up the Android channel first, since Android will not ask without one', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      mock.requestPermissionsAsync.mockResolvedValue(permissions(PermissionStatus.GRANTED));
      await askForPermission();
      expect(mock.setNotificationChannelAsync).toHaveBeenCalledWith('reminders', { name: 'Reminders', importance: 3 });
      expect(callsInOrder()).toEqual(['setNotificationChannelAsync', 'requestPermissionsAsync']);
    });
  });

  describe('replaceScheduled', () => {
    it('schedules each reminder under its own key, daily ones repeating and the rest on their day', async () => {
      await replaceScheduled([daily('water:9', 9), once('vitamins:2099-01-01:morning', FUTURE)]);

      expect(mock.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
      expect(mock.scheduleNotificationAsync).toHaveBeenCalledWith({
        identifier: 'water:9',
        content: { title: 'A glass of water?', body: 'Tap a glass on Today to count it.', data: { kind: 'water' } },
        trigger: { type: 'daily', hour: 9, minute: 0, channelId: 'reminders' },
      });
      expect(mock.scheduleNotificationAsync).toHaveBeenCalledWith({
        identifier: 'vitamins:2099-01-01:morning',
        content: { title: 'Morning vitamins', body: 'Folic acid', data: { kind: 'vitamins' } },
        trigger: { type: 'date', date: FUTURE, channelId: 'reminders' },
      });
    });

    it('takes away the reminders that are no longer wanted and leaves the rest', async () => {
      pending('water:9', 'water:11', 'vitamins:2099-01-01:morning', 'appointments:x:two-hours');
      await replaceScheduled([daily('water:9', 9), once('vitamins:2099-01-01:morning', FUTURE)]);

      const cancelled = mock.cancelScheduledNotificationAsync.mock.calls.map(([id]) => id);
      expect(cancelled.sort()).toEqual(['appointments:x:two-hours', 'water:11']);
    });

    it('takes them away before scheduling, so an iPhone is never over its 64', async () => {
      pending('old:1', 'old:2');
      await replaceScheduled([daily('water:9', 9), once('new', FUTURE)]);
      expect(callsInOrder()).toEqual([
        'getAllScheduledNotificationsAsync',
        'cancelScheduledNotificationAsync',
        'cancelScheduledNotificationAsync',
        'scheduleNotificationAsync',
        'scheduleNotificationAsync',
      ]);
    });

    it('does not schedule a one-off whose time has gone by, and clears the old one', async () => {
      pending('vitamins:2020-01-01:morning');
      await replaceScheduled([once('vitamins:2020-01-01:morning', PAST), once('vitamins:2099-01-01:morning', FUTURE)]);

      expect(mock.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      expect(mock.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: 'vitamins:2099-01-01:morning' }),
      );
      expect(mock.cancelScheduledNotificationAsync).toHaveBeenCalledWith('vitamins:2020-01-01:morning');
    });

    it('with an empty plan, clears everything it had', async () => {
      pending('water:9', 'kicks');
      await replaceScheduled([]);
      expect(mock.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(mock.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    });

    it('does not cancel a test reminder that is still on its way', async () => {
      pending('test-reminder', 'water:11');
      await replaceScheduled([daily('water:9', 9)]);
      expect(mock.cancelScheduledNotificationAsync.mock.calls.map(([id]) => id)).toEqual(['water:11']);
    });

    it('sets up the Android channel before scheduling into it', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      await replaceScheduled([daily('water:9', 9)]);
      expect(callsInOrder()).toEqual(['setNotificationChannelAsync', 'getAllScheduledNotificationsAsync', 'scheduleNotificationAsync']);
    });

    it('lets the failure through, so the caller can try again', async () => {
      mock.scheduleNotificationAsync.mockRejectedValueOnce(new Error('too many'));
      await expect(replaceScheduled([daily('water:9', 9)])).rejects.toThrow('too many');
    });
  });

  describe('clearScheduled', () => {
    it('takes every reminder away', async () => {
      await clearScheduled();
      expect(mock.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendTestReminder', () => {
    it('schedules one a few seconds from now, under an id the others leave alone', async () => {
      await sendTestReminder();
      expect(mock.scheduleNotificationAsync).toHaveBeenCalledWith({
        identifier: 'test-reminder',
        content: { title: 'Bloom reminders are on', body: 'This is how a reminder will look.' },
        trigger: { type: 'timeInterval', seconds: 5, channelId: 'reminders' },
      });
    });
  });

  it('opens the phone’s settings for Bloom', async () => {
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await openSystemSettings();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('shows a reminder as a banner even while the app is open', async () => {
    const { handlers } = loadFresh();
    expect(handlers).toHaveLength(1);
    expect(await handlers[0].handleNotification({} as never)).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
  });
});

describe('on the web', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'web');
  });

  it('has no permission to ask about', async () => {
    expect(await permissionState()).toBe('unavailable');
    expect(await askForPermission()).toBe('unavailable');
    expect(mock.getPermissionsAsync).not.toHaveBeenCalled();
    expect(mock.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('has nothing to schedule or clear, and does not touch the package', async () => {
    await replaceScheduled([daily('water:9', 9)]);
    await clearScheduled();
    await sendTestReminder();
    expect(callsInOrder()).toEqual([]);
    expect(mock.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  });

  it('does not register a handler when the module loads', () => {
    expect(loadFresh('web').handlers).toEqual([]);
  });
});
