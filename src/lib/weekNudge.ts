/**
 * Whether this phone gets a notification when a new week's cards arrive. It is
 * a setting on each phone, off until switched on, and kept in the phone's own
 * storage: nothing about it goes to the server.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const KEY = 'bloom.weekNudge';

type WeekNudge = {
  /** Null until read from the phone. */
  on: boolean | null;
  load: () => Promise<void>;
  set: (on: boolean) => Promise<void>;
};

export const useWeekNudge = create<WeekNudge>((set) => ({
  on: null,
  load: async () => {
    let on = false;
    try {
      on = (await AsyncStorage.getItem(KEY)) === 'on';
    } catch {
      // Unreadable storage leaves the nudge off.
    }
    set({ on });
  },
  set: async (on) => {
    set({ on });
    try {
      if (on) await AsyncStorage.setItem(KEY, 'on');
      else await AsyncStorage.removeItem(KEY);
    } catch {
      // Kept for this session; the phone asks again next time it opens.
    }
  },
}));
