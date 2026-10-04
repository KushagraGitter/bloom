/**
 * What Bloom can read from Apple Health (iPhone) or Health Connect (Android).
 * Bloom only ever reads, and only the metrics she switches on.
 */

export type HealthMetric = 'sleep' | 'restingHeartRate' | 'hrv' | 'steps' | 'weight' | 'glucose' | 'bloodPressure';

export type MetricInfo = {
  id: HealthMetric;
  label: string;
  /** One line under the switch. */
  hint: string;
  /** Only useful with a scale, meter or cuff that syncs to the phone. */
  optional: boolean;
};

export const METRICS: MetricInfo[] = [
  { id: 'sleep', label: 'Sleep', hint: 'Time asleep, bedtime and wake time', optional: false },
  { id: 'restingHeartRate', label: 'Resting heart rate', hint: 'From your watch or band', optional: false },
  { id: 'hrv', label: 'Heart rate variability', hint: 'From your watch or band', optional: false },
  { id: 'steps', label: 'Steps', hint: 'Daily total', optional: false },
  { id: 'weight', label: 'Weight', hint: 'If your scale syncs to the phone', optional: true },
  { id: 'glucose', label: 'Blood sugar', hint: 'If your meter syncs to the phone', optional: true },
  { id: 'bloodPressure', label: 'Blood pressure', hint: 'If your cuff syncs to the phone', optional: true },
];

export const METRIC_IDS = METRICS.map((m) => m.id);

export function isMetric(value: unknown): value is HealthMetric {
  return typeof value === 'string' && (METRIC_IDS as string[]).includes(value);
}

/** Apple Health types to ask for. Blood pressure is two quantities on iPhone. */
export const HEALTHKIT_TYPES = {
  sleep: ['HKCategoryTypeIdentifierSleepAnalysis'],
  restingHeartRate: ['HKQuantityTypeIdentifierRestingHeartRate'],
  hrv: ['HKQuantityTypeIdentifierHeartRateVariabilitySDNN'],
  steps: ['HKQuantityTypeIdentifierStepCount'],
  weight: ['HKQuantityTypeIdentifierBodyMass'],
  glucose: ['HKQuantityTypeIdentifierBloodGlucose'],
  bloodPressure: ['HKQuantityTypeIdentifierBloodPressureSystolic', 'HKQuantityTypeIdentifierBloodPressureDiastolic'],
} as const satisfies Record<HealthMetric, readonly string[]>;

/** Health Connect record types to ask for. */
export const HEALTH_CONNECT_TYPES = {
  sleep: 'SleepSession',
  restingHeartRate: 'RestingHeartRate',
  hrv: 'HeartRateVariabilityRmssd',
  steps: 'Steps',
  weight: 'Weight',
  glucose: 'BloodGlucose',
  bloodPressure: 'BloodPressure',
} as const satisfies Record<HealthMetric, string>;

/** The Android permission each record type needs, for app.json. */
export const ANDROID_PERMISSIONS = {
  sleep: 'android.permission.health.READ_SLEEP',
  restingHeartRate: 'android.permission.health.READ_RESTING_HEART_RATE',
  hrv: 'android.permission.health.READ_HEART_RATE_VARIABILITY',
  steps: 'android.permission.health.READ_STEPS',
  weight: 'android.permission.health.READ_WEIGHT',
  glucose: 'android.permission.health.READ_BLOOD_GLUCOSE',
  bloodPressure: 'android.permission.health.READ_BLOOD_PRESSURE',
} as const satisfies Record<HealthMetric, string>;

/** Reading from before she first connected (Health Connect's default is the 30 days before). */
export const ANDROID_HISTORY_PERMISSION = 'android.permission.health.READ_HEALTH_DATA_HISTORY';
