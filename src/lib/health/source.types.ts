import type { HealthMetric } from './metrics';

/**
 * - ready: she can switch metrics on.
 * - needs-app: Health Connect isn't on this Android phone (Android 13 and older).
 * - needs-update: Health Connect is there but too old.
 * - needs-build: Expo Go, which doesn't include the health libraries.
 * - unsupported: the web build, or an iPad or phone without health data.
 */
export type SourceStatus = 'ready' | 'needs-app' | 'needs-update' | 'needs-build' | 'unsupported';

export type HealthSource = {
  /** What the phone calls it: Apple Health or Health Connect. */
  name: string;
  /** Whether she can be asked about older data separately (Health Connect only). */
  asksForHistory: boolean;
  status: () => Promise<SourceStatus>;
  /**
   * Shows the phone's own permission sheet for these metrics. Returns the
   * metrics now allowed, or null when the phone won't say (Apple never tells
   * an app whether reading was allowed).
   */
  request: (metrics: HealthMetric[], history?: boolean) => Promise<HealthMetric[] | null>;
  /** Metrics allowed right now, or null when the phone won't say. */
  granted: () => Promise<HealthMetric[] | null>;
  /** How many entries the phone holds for this metric since the given time. Nothing is saved. */
  countSince: (metric: HealthMetric, since: Date) => Promise<number>;
  /** Whether she has let Bloom read data from before she connected (Health Connect only). */
  hasHistory?: () => Promise<boolean>;
  /** Opens the screen where she can change Bloom's access, when the phone has one. */
  openSettings?: () => void;
};
