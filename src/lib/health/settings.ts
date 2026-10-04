/**
 * Which health metrics Bloom may read on this phone. It is a setting on each
 * phone (only the phone that connects reads anything), kept in the phone's
 * secure storage next to the app lock.
 */
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { isMetric, METRIC_IDS, type HealthMetric } from './metrics';

const KEY = 'bloom.health';

type HealthSettings = {
  /** Null until read from the phone. */
  metrics: HealthMetric[] | null;
  load: () => Promise<void>;
  setMetric: (metric: HealthMetric, on: boolean) => Promise<void>;
  /** Stops all reading on this phone. The phone's own permission stays until she changes it there. */
  disconnect: () => Promise<void>;
};

async function save(metrics: HealthMetric[]) {
  if (metrics.length) await SecureStore.setItemAsync(KEY, JSON.stringify(metrics));
  else await SecureStore.deleteItemAsync(KEY);
}

export const useHealthSettings = create<HealthSettings>((set, get) => ({
  metrics: null,
  load: async () => {
    let metrics: HealthMetric[] = [];
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) metrics = parsed.filter(isMetric);
    } catch {
      // No secure storage (the web build) or an unreadable value: nothing is on.
    }
    set({ metrics });
  },
  setMetric: async (metric, on) => {
    const current = get().metrics ?? [];
    const next = METRIC_IDS.filter((id) => (id === metric ? on : current.includes(id)));
    await save(next);
    set({ metrics: next });
  },
  disconnect: async () => {
    await save([]);
    set({ metrics: [] });
  },
}));
