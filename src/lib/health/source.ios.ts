import { HEALTHKIT_TYPES, type HealthMetric } from './metrics';
import { inExpoGo } from './expoGo';
import type { HealthSource } from './source.types';

type HealthKit = typeof import('@kingstinct/react-native-healthkit');

// Loaded on first use: in Expo Go the native module isn't there and loading it would crash.
let kit: HealthKit | null = null;
function healthKit(): HealthKit {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  if (!kit) kit = require('@kingstinct/react-native-healthkit') as HealthKit;
  return kit;
}

/** Apple Health on iPhone. */
export const healthSource: HealthSource = {
  name: 'Apple Health',
  asksForHistory: false,
  status: async () => {
    if (inExpoGo()) return 'needs-build';
    try {
      return healthKit().isHealthDataAvailable() ? 'ready' : 'unsupported';
    } catch {
      return 'unsupported';
    }
  },
  request: async (metrics) => {
    const toRead = metrics.flatMap((m) => HEALTHKIT_TYPES[m]);
    if (toRead.length) await healthKit().requestAuthorization({ toRead });
    // Apple keeps whether she allowed reading private, even from Bloom.
    return null;
  },
  granted: async () => null,
  countSince: async (metric: HealthMetric, since: Date) => {
    const hk = healthKit();
    const filter = { date: { startDate: since } };
    // limit 0 means every sample in the range.
    if (metric === 'sleep') {
      return (await hk.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', { limit: 0, filter })).length;
    }
    // Blood pressure is a pair; count the top numbers.
    const [type] = HEALTHKIT_TYPES[metric];
    return (await hk.queryQuantitySamples(type as Exclude<typeof type, 'HKCategoryTypeIdentifierSleepAnalysis'>, { limit: 0, filter })).length;
  },
};
