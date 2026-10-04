import Constants, { ExecutionEnvironment } from 'expo-constants';

import { useHealthSettings } from '@/lib/health/settings';
import type { HealthSource } from '@/lib/health/source.types';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => void mockStore.set(k, v)),
  deleteItemAsync: jest.fn(async (k: string) => void mockStore.delete(k)),
}));

const mockHealthConnect = {
  getSdkStatus: jest.fn(async () => 3),
  initialize: jest.fn(async () => true),
  requestPermission: jest.fn(async () => []),
  getGrantedPermissions: jest.fn(async (): Promise<{ accessType: string; recordType: string }[]> => []),
  readRecords: jest.fn(async () => ({ records: [{}, {}] })),
  openHealthConnectSettings: jest.fn(),
};
jest.mock('react-native-health-connect', () => mockHealthConnect);

const mockHealthKit = {
  isHealthDataAvailable: jest.fn(() => true),
  requestAuthorization: jest.fn(async () => true),
  queryCategorySamples: jest.fn(async () => [{}, {}, {}]),
  queryQuantitySamples: jest.fn(async () => [{}]),
};
jest.mock('@kingstinct/react-native-healthkit', () => mockHealthKit);

const android = (): HealthSource => jest.requireActual('@/lib/health/source.android').healthSource;
const ios = (): HealthSource => jest.requireActual('@/lib/health/source.ios').healthSource;

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  useHealthSettings.setState({ metrics: null });
  jest.replaceProperty(Constants, 'executionEnvironment', ExecutionEnvironment.Standalone);
});

describe('health settings', () => {
  it('starts with nothing on and ignores anything it does not know', async () => {
    await useHealthSettings.getState().load();
    expect(useHealthSettings.getState().metrics).toEqual([]);

    mockStore.set('bloom.health', JSON.stringify(['steps', 'stress', 'sleep']));
    await useHealthSettings.getState().load();
    expect(useHealthSettings.getState().metrics).toEqual(['steps', 'sleep']);
  });

  it('keeps metrics in a fixed order and forgets everything on disconnect', async () => {
    await useHealthSettings.getState().load();
    await useHealthSettings.getState().setMetric('steps', true);
    await useHealthSettings.getState().setMetric('sleep', true);
    expect(useHealthSettings.getState().metrics).toEqual(['sleep', 'steps']);
    expect(JSON.parse(mockStore.get('bloom.health')!)).toEqual(['sleep', 'steps']);

    await useHealthSettings.getState().setMetric('sleep', false);
    expect(useHealthSettings.getState().metrics).toEqual(['steps']);

    await useHealthSettings.getState().disconnect();
    expect(useHealthSettings.getState().metrics).toEqual([]);
    expect(mockStore.has('bloom.health')).toBe(false);
  });
});

describe('Health Connect', () => {
  it('never loads the library in Expo Go', async () => {
    jest.replaceProperty(Constants, 'executionEnvironment', ExecutionEnvironment.StoreClient);
    expect(await android().status()).toBe('needs-build');
    expect(mockHealthConnect.getSdkStatus).not.toHaveBeenCalled();
  });

  it('says when Health Connect is missing or needs an update', async () => {
    mockHealthConnect.getSdkStatus.mockResolvedValueOnce(1);
    expect(await android().status()).toBe('needs-app');
    mockHealthConnect.getSdkStatus.mockResolvedValueOnce(2);
    expect(await android().status()).toBe('needs-update');
    expect(await android().status()).toBe('ready');
  });

  it('asks to read only, and reports what was allowed', async () => {
    mockHealthConnect.getGrantedPermissions.mockResolvedValueOnce([
      { accessType: 'read', recordType: 'SleepSession' },
      { accessType: 'write', recordType: 'Steps' },
    ]);
    const allowed = await android().request(['sleep', 'steps'], true);
    expect(mockHealthConnect.requestPermission).toHaveBeenCalledWith([
      { accessType: 'read', recordType: 'SleepSession' },
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'ReadHealthDataHistory' },
    ]);
    expect(allowed).toEqual(['sleep']);
  });

  it('knows whether older data is allowed', async () => {
    expect(await android().hasHistory!()).toBe(false);
    mockHealthConnect.getGrantedPermissions.mockResolvedValueOnce([{ accessType: 'read', recordType: 'ReadHealthDataHistory' }]);
    expect(await android().hasHistory!()).toBe(true);
  });

  it('counts records since a time', async () => {
    const since = new Date('2026-10-01T00:00:00Z');
    expect(await android().countSince('hrv', since)).toBe(2);
    expect(mockHealthConnect.readRecords).toHaveBeenCalledWith('HeartRateVariabilityRmssd', {
      timeRangeFilter: { operator: 'after', startTime: '2026-10-01T00:00:00.000Z' },
    });
  });
});

describe('Apple Health', () => {
  it('never loads the library in Expo Go', async () => {
    jest.replaceProperty(Constants, 'executionEnvironment', ExecutionEnvironment.StoreClient);
    expect(await ios().status()).toBe('needs-build');
    expect(mockHealthKit.isHealthDataAvailable).not.toHaveBeenCalled();
  });

  it('asks to read only, and can never tell what was allowed', async () => {
    expect(await ios().status()).toBe('ready');
    expect(await ios().request(['sleep', 'bloodPressure'])).toBeNull();
    expect(mockHealthKit.requestAuthorization).toHaveBeenCalledWith({
      toRead: [
        'HKCategoryTypeIdentifierSleepAnalysis',
        'HKQuantityTypeIdentifierBloodPressureSystolic',
        'HKQuantityTypeIdentifierBloodPressureDiastolic',
      ],
    });
    expect(await ios().granted()).toBeNull();
  });

  it('counts sleep and quantity samples since a time', async () => {
    const since = new Date('2026-10-01T00:00:00Z');
    expect(await ios().countSince('sleep', since)).toBe(3);
    expect(mockHealthKit.queryCategorySamples).toHaveBeenCalledWith('HKCategoryTypeIdentifierSleepAnalysis', {
      limit: 0,
      filter: { date: { startDate: since } },
    });
    expect(await ios().countSince('restingHeartRate', since)).toBe(1);
    expect(mockHealthKit.queryQuantitySamples).toHaveBeenCalledWith('HKQuantityTypeIdentifierRestingHeartRate', {
      limit: 0,
      filter: { date: { startDate: since } },
    });
  });
});
