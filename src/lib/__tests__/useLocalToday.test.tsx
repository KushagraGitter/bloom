import { act, renderHook } from '@testing-library/react-native';

import { useLocalToday } from '../data';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/session', () => ({ useSession: () => ({ session: null, loading: false }) }));

describe('useLocalToday', () => {
  afterEach(() => jest.useRealTimers());

  it('moves to the next day at local midnight', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 3, 23, 59, 0) });
    const { result } = await renderHook(() => useLocalToday());
    expect(result.current).toBe('2026-10-03');

    await act(async () => {
      jest.advanceTimersByTime(2 * 60 * 1000);
    });
    expect(result.current).toBe('2026-10-04');
  });
});
