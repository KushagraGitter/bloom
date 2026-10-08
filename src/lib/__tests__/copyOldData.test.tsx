import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { copiedMarkerId, copyOldData, useCopyOldData, type OldTables } from '@/lib/copyOldData';
import { doseId, pregnancyDetailsId, readingKind, tallyKind } from '@/lib/data';
import { localToday } from '@/lib/pregnancy';
import { newHouseholdKey } from '@/lib/vault/crypto';
import { deleteRecord, writeRecord, type LocalStore } from '@/lib/vault/localStore';
import { syncOnce } from '@/lib/vault/sync';
import { fakeServer, readyVault } from '@/lib/vault/testHelpers';
import { VaultContext, type Vault } from '@/lib/vault/VaultProvider';

jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)) }));
jest.mock('@/lib/session', () => ({ useSession: () => ({ session: { user: { id: 'me' } }, loading: false }) }));

type Row = Record<string, unknown>;
const mockTables: { rows: Record<string, Row[]>; reads: string[] } = { rows: {}, reads: [] };

jest.mock('@/lib/supabase', () => {
  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    let range: [number, number] = [0, Infinity];
    const rows = () => mockTables.rows[table] ?? [];
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (col: string, v: unknown) => ((filters[col] = v), q),
      order: () => q,
      limit: () => q,
      range: (a: number, b: number) => ((range = [a, b]), q),
      maybeSingle: async () => {
        if (table === 'members') return { data: { role: 'owner', pregnancy: rows()[0] }, error: null };
        return { data: rows()[0] ?? null, error: null };
      },
      then: (resolve: (v: unknown) => void) => {
        mockTables.reads.push(table);
        resolve({ data: rows().slice(range[0], range[1] + 1), error: null });
      },
    };
    return q;
  };
  return { supabase: { from } };
});

// The shapes the old tables sent: Postgres timestamps and HH:mm:ss times.
const OLD: OldTables = {
  pregnancy: {
    id: 'p1',
    owner_id: 'me',
    lmp_date: '2026-04-15',
    due_date: '2027-01-20',
    method: 'lmp',
    babies: 1,
    blood_group: 'B+',
    conditions: ['Thyroid'],
    units: 'metric',
    created_at: '2026-10-01T09:00:00+00:00',
    updated_at: '2026-10-02T09:00:00.123456+00:00',
  },
  readings: [
    { id: '11111111-1111-4111-8111-111111111111', type: 'weight', value_num: 64.2, value_num2: null, value_text: null, taken_at: '2026-10-02T07:30:00+00:00', logged_by: 'me' },
    { id: '22222222-2222-4222-8222-222222222222', type: 'kicks', value_num: 1, value_num2: null, value_text: null, taken_at: '2026-10-02T12:00:00+00:00', logged_by: 'kush' },
  ],
  medications: [
    { id: '33333333-3333-4333-8333-333333333333', name: 'Iron', dose: null, time_of_day: 'evening', start_date: '2026-09-01', end_date: null, created_at: '2026-09-01T08:00:00+00:00' },
  ],
  doses: [{ id: 'old-dose', medication_id: '33333333-3333-4333-8333-333333333333', day: '2026-10-02', taken_at: '2026-10-02T20:00:00+00:00', logged_by: null }],
  appointments: [
    { id: '44444444-4444-4444-8444-444444444444', title: 'Growth scan', appt_date: '2026-10-14', appt_time: '09:00:00', place: 'City Clinic', created_at: '2026-09-30T10:00:00+00:00' },
  ],
};

const MED = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-10-03T10:00:00Z');

let store: LocalStore;
beforeEach(async () => {
  ({ store } = await readyVault());
});

describe('copyOldData', () => {
  it('saves each old row as a vault record, keeping its id and when it was saved', async () => {
    expect(await copyOldData(store, 'p1', OLD, NOW)).toBe(6);

    expect(await store.get(pregnancyDetailsId('p1'))).toMatchObject({
      kind: 'pregnancy',
      updatedAt: '2026-10-02T09:00:00.123Z',
      dirty: true,
      data: { lmp_date: '2026-04-15', due_date: '2027-01-20', method: 'lmp', babies: 1, blood_group: 'B+', conditions: ['Thyroid'], units: 'metric' },
    });
    // Only health details are copied, not who owns it or when the row was made.
    expect((await store.get(pregnancyDetailsId('p1')))?.data).not.toHaveProperty('owner_id');

    const [weight] = await store.list('p1', readingKind('weight'));
    expect(weight).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      updatedAt: '2026-10-02T07:30:00.000Z',
      data: { type: 'weight', value_num: 64.2, value_num2: null, value_text: null, taken_at: '2026-10-02T07:30:00.000Z', logged_by: 'me' },
    });
    const kickDay = localToday(new Date('2026-10-02T12:00:00Z'));
    expect(await store.list('p1', tallyKind('kicks', kickDay))).toEqual([expect.objectContaining({ id: '22222222-2222-4222-8222-222222222222' })]);

    expect(await store.get(MED)).toMatchObject({ kind: 'medication', data: { name: 'Iron', time_of_day: 'evening', created_at: '2026-09-01T08:00:00.000Z' } });
    expect(await store.get(doseId(MED, '2026-10-02'))).toMatchObject({ kind: 'dose', data: { medication_id: MED, day: '2026-10-02', logged_by: null } });
    expect(await store.get('44444444-4444-4444-8444-444444444444')).toMatchObject({
      kind: 'appointment',
      data: { title: 'Growth scan', appt_date: '2026-10-14', appt_time: '09:00', place: 'City Clinic' },
    });
    expect(await store.get(copiedMarkerId('p1'))).toMatchObject({ kind: 'meta.copied', dirty: true });
  });

  it('leaves alone what this phone already has, edited or deleted since', async () => {
    await copyOldData(store, 'p1', OLD, NOW);
    await writeRecord(store, { id: MED, pregnancyId: 'p1', kind: 'medication', data: { name: 'Iron (new dose)' } }, NOW);
    await deleteRecord(store, '44444444-4444-4444-8444-444444444444', NOW);

    expect(await copyOldData(store, 'p1', OLD, NOW)).toBe(0);
    expect((await store.get(MED))?.data).toEqual({ name: 'Iron (new dose)' });
    expect(await store.get('44444444-4444-4444-8444-444444444444')).toMatchObject({ deleted: true });
  });

  it('copying on both phones ends with one of each, and an edit made since still wins', async () => {
    const { remote, rows } = fakeServer();
    const key = newHouseholdKey(1);
    const other = (await readyVault()).store;

    await copyOldData(store, 'p1', OLD, NOW);
    await syncOnce({ store, remote, key, pregnancyId: 'p1' });
    // Her phone edits the medicine after copying.
    await writeRecord(store, { id: MED, pregnancyId: 'p1', kind: 'medication', data: { name: 'Iron (new dose)' } }, NOW);
    await syncOnce({ store, remote, key, pregnancyId: 'p1' });

    // The other phone copies too, before it has pulled anything.
    await copyOldData(other, 'p1', OLD, NOW);
    await syncOnce({ store: other, remote, key, pregnancyId: 'p1' });

    expect(rows.size).toBe(7);
    expect((await other.get(MED))?.data).toEqual({ name: 'Iron (new dose)' });
  });

  it('skips a pregnancy row with no details, as households set up since the move have', async () => {
    await copyOldData(store, 'p1', { ...OLD, pregnancy: { id: 'p1', owner_id: 'me', lmp_date: null, conditions: [] } }, NOW);
    expect(await store.get(pregnancyDetailsId('p1'))).toBeNull();
  });

  it('copies a pregnancy with no saved time as of now', async () => {
    await copyOldData(store, 'p1', { ...OLD, pregnancy: { lmp_date: '2026-04-15' } }, NOW);
    expect(await store.get(pregnancyDetailsId('p1'))).toMatchObject({ updatedAt: NOW.toISOString() });
  });
});

describe('useCopyOldData', () => {
  function mount(vault: Vault) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <VaultContext.Provider value={vault}>{children}</VaultContext.Provider>
      </QueryClientProvider>
    );
    return renderHook(() => useCopyOldData(), { wrapper });
  }

  beforeEach(() => {
    mockTables.reads = [];
    mockTables.rows = {
      members: [OLD.pregnancy!],
      pregnancies: [OLD.pregnancy!],
      readings: OLD.readings,
      medications: OLD.medications,
      med_doses: OLD.doses,
      appointments: OLD.appointments,
    };
  });

  it('copies once the first sync is done, and asks for another sync to upload it', async () => {
    const { vault, store: s, syncs } = await readyVault();
    await mount(vault);
    await waitFor(async () => expect(await s.get(copiedMarkerId('p1'))).not.toBeNull());
    expect(await s.get(MED)).not.toBeNull();
    expect(syncs).toHaveLength(1);
  });

  it('waits for the first sync, which tells it whether the other phone already copied', async () => {
    const { vault, store: s } = await readyVault();
    await mount({ ...vault, sync: { ...vault.sync, lastSyncedAt: null } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockTables.reads).toEqual([]);
    expect(await s.get(copiedMarkerId('p1'))).toBeNull();
  });

  it('does nothing when the household was already copied', async () => {
    const { vault, store: s } = await readyVault();
    await writeRecord(s, { id: copiedMarkerId('p1'), pregnancyId: 'p1', kind: 'meta.copied', data: { at: NOW.toISOString() } });
    await mount(vault);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockTables.reads).toEqual([]);
    expect(await s.get(MED)).toBeNull();
  });

  it('does nothing on a phone without the key', async () => {
    const { vault } = await readyVault('partner');
    await mount({ ...vault, state: 'needs-key', householdKey: null, sync: null });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockTables.reads).toEqual([]);
  });
});
