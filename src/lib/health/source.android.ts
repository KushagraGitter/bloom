import { HEALTH_CONNECT_TYPES, METRICS, type HealthMetric } from './metrics';
import { inExpoGo } from './expoGo';
import type { HealthSource } from './source.types';

type HealthConnect = typeof import('react-native-health-connect');

// Loaded on first use, so Expo Go never touches the missing native module.
let hc: HealthConnect | null = null;
let ready: Promise<boolean> | null = null;
function healthConnect(): HealthConnect {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  if (!hc) hc = require('react-native-health-connect') as HealthConnect;
  return hc;
}
async function connected(): Promise<HealthConnect> {
  const lib = healthConnect();
  ready ??= lib.initialize().catch((e) => {
    ready = null;
    throw e;
  });
  await ready;
  return lib;
}

// Values of SdkAvailabilityStatus, kept here so Expo Go never loads the library.
const SDK_UNAVAILABLE = 1;
const SDK_NEEDS_UPDATE = 2;

const HISTORY = 'ReadHealthDataHistory';

function allowedMetrics(granted: readonly { accessType: string; recordType: string }[]): HealthMetric[] {
  const read = new Set(granted.filter((p) => p.accessType === 'read').map((p) => p.recordType));
  return METRICS.map((m) => m.id).filter((id) => read.has(HEALTH_CONNECT_TYPES[id]));
}

/** Health Connect on Android. */
export const healthSource: HealthSource = {
  name: 'Health Connect',
  asksForHistory: true,
  status: async () => {
    if (inExpoGo()) return 'needs-build';
    try {
      const status = await healthConnect().getSdkStatus();
      if (status === SDK_UNAVAILABLE) return 'needs-app';
      if (status === SDK_NEEDS_UPDATE) return 'needs-update';
      return 'ready';
    } catch {
      return 'unsupported';
    }
  },
  request: async (metrics, history) => {
    const lib = await connected();
    const asks = [
      ...metrics.map((m) => ({ accessType: 'read' as const, recordType: HEALTH_CONNECT_TYPES[m] })),
      ...(history ? [{ accessType: 'read' as const, recordType: HISTORY as typeof HISTORY }] : []),
    ];
    if (asks.length) await lib.requestPermission(asks);
    return allowedMetrics(await lib.getGrantedPermissions());
  },
  granted: async () => allowedMetrics(await (await connected()).getGrantedPermissions()),
  countSince: async (metric, since) => {
    const lib = await connected();
    const result = await lib.readRecords(HEALTH_CONNECT_TYPES[metric], {
      timeRangeFilter: { operator: 'after', startTime: since.toISOString() },
    });
    return result.records.length;
  },
  hasHistory: async () => {
    const granted = (await (await connected()).getGrantedPermissions()) as { recordType: string }[];
    return granted.some((p) => p.recordType === HISTORY);
  },
  openSettings: () => healthConnect().openHealthConnectSettings(),
};
