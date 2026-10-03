import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useLocalTime } from '../data';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/session', () => ({ useSession: () => ({ session: null, loading: false }) }));

/** The listener the hook gave AppState most recently, to call as the phone would. */
function appStateListener(): (state: string) => void {
  const calls = (AppState.addEventListener as jest.Mock).mock.calls;
  return calls[calls.length - 1][1];
}

describe('useLocalTime', () => {
  afterEach(() => jest.useRealTimers());

  it('starts at the time it is now', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 3, 8, 59, 30) });
    const { result } = await renderHook(() => useLocalTime());
    expect(result.current).toBe('08:59');
  });

  it('moves on as each minute starts, and keeps going', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 3, 8, 59, 30) });
    const { result } = await renderHook(() => useLocalTime());

    await act(async () => {
      jest.advanceTimersByTime(29 * 1000); // 8:59:59
    });
    expect(result.current).toBe('08:59');

    await act(async () => {
      jest.advanceTimersByTime(2 * 1000); // 9:00:01
    });
    expect(result.current).toBe('09:00');

    await act(async () => {
      jest.advanceTimersByTime(60 * 1000); // 9:01:01
    });
    expect(result.current).toBe('09:01');

    await act(async () => {
      jest.advanceTimersByTime(60 * 60 * 1000); // 10:01:01
    });
    expect(result.current).toBe('10:01');
  });

  it('catches up the moment the app comes back to the foreground', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 3, 8, 59, 30) });
    const { result } = await renderHook(() => useLocalTime());

    // The phone slept: the clock moved on, but no timer got to run.
    jest.setSystemTime(new Date(2026, 9, 3, 9, 40, 10));
    expect(result.current).toBe('08:59');

    await act(async () => appStateListener()('background'));
    expect(result.current).toBe('08:59');

    await act(async () => appStateListener()('active'));
    expect(result.current).toBe('09:40');
  });

  it('lets go of its timer and listener when it leaves the screen', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 3, 8, 59, 30) });
    const setTimer = jest.spyOn(globalThis, 'setTimeout');
    const clearTimer = jest.spyOn(globalThis, 'clearTimeout');
    const { unmount } = await renderHook(() => useLocalTime());

    // Its next wake-up is 30 seconds and a moment away.
    const wakeUp = setTimer.mock.calls.findIndex(([, ms]) => ms === 30 * 1000 + 50);
    expect(wakeUp).toBeGreaterThanOrEqual(0);
    const timer = setTimer.mock.results[wakeUp].value;
    const calls = (AppState.addEventListener as jest.Mock).mock.results;
    const subscription = calls[calls.length - 1].value as { remove: jest.Mock };

    await unmount();
    expect(clearTimer).toHaveBeenCalledWith(timer);
    expect(subscription.remove).toHaveBeenCalled();
  });
});
