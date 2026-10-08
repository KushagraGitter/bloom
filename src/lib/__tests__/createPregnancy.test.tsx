import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { PREGNANCY_DETAILS, PREGNANCY_KIND, pregnancyDetailsId, useCreatePregnancy } from '@/lib/data';
import { emptyAnswers, type Answers } from '@/lib/onboarding';
import { createLocalStoreAsync, type LocalStore } from '@/lib/vault/localStore';
import { memoryDb } from '@/lib/vault/testHelpers';

jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)) }));
jest.mock('@/lib/session', () => ({ useSession: () => ({ session: { user: { id: 'me' } }, loading: false }) }));

const mockState: {
  writes: { table: string; op: string; value: unknown }[];
  existing: { id: string } | null;
  savedKeys: string[];
  recordsOnServer: number;
  store: LocalStore | null;
} = { writes: [], existing: null, savedKeys: [], recordsOnServer: 0, store: null };

jest.mock('@/lib/supabase', () => {
  const from = (table: string) => {
    const q: Record<string, unknown> = {
      select: () => q,
      eq: () => q,
      limit: () => q,
      maybeSingle: async () => ({ data: mockState.existing, error: null }),
      single: async () => ({ data: { id: 'p-new' }, error: null }),
      update: (value: unknown) => (mockState.writes.push({ table, op: 'update', value }), q),
      insert: (value: unknown) => (mockState.writes.push({ table, op: 'insert', value }), q),
      upsert: async (value: unknown) => (mockState.writes.push({ table, op: 'upsert', value }), { error: null }),
      then: (resolve: (v: unknown) => void) => resolve({ error: null }),
    };
    return q;
  };
  return { supabase: { from } };
});

jest.mock('@/lib/vault/keys', () => ({
  loadHouseholdKey: async () => null,
  saveHouseholdKey: async (pregnancyId: string) => {
    mockState.savedKeys.push(pregnancyId);
  },
}));
jest.mock('@/lib/vault/remote', () => ({ countVaultRecords: async () => mockState.recordsOnServer, supabaseVault: {} }));
jest.mock('@/lib/vault/VaultProvider', () => ({
  ...jest.requireActual('@/lib/vault/VaultProvider'),
  openLocalStore: async () => mockState.store,
}));

const ANSWERS: Answers = {
  ...emptyAnswers,
  name: 'Ananya',
  method: 'lmp',
  date: '2026-08-01',
  babies: emptyAnswers.babies,
  bloodGroup: 'B+',
  conditions: ['Thyroid'],
  doctor: 'Dr. Mehta',
  emergencyContact: 'Kush',
  emergencyPhone: '+91 98765 43210',
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(async () => {
  mockState.writes = [];
  mockState.existing = null;
  mockState.savedKeys = [];
  mockState.recordsOnServer = 0;
  mockState.store = await createLocalStoreAsync(memoryDb());
});

async function create() {
  const { result } = await renderHook(() => useCreatePregnancy(), { wrapper });
  let id = '';
  await act(async () => {
    id = await result.current.mutateAsync(ANSWERS);
    // TanStack Query reports the result on a timer; let it land inside act.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return id;
}

describe('saving onboarding', () => {
  it('creates the pregnancy on the server with no health details', async () => {
    const id = await create();
    expect(id).toBe('p-new');
    const pregnancyWrites = mockState.writes.filter((w) => w.table === 'pregnancies');
    expect(pregnancyWrites).toEqual([{ table: 'pregnancies', op: 'insert', value: {} }]);
    const sent = JSON.stringify(mockState.writes);
    for (const secret of ['2026-08-01', 'B+', 'Thyroid', 'Dr. Mehta', '98765']) expect(sent).not.toContain(secret);
  });

  it('keeps the details on the phone in the vault, with a new household key', async () => {
    await create();
    expect(mockState.savedKeys).toEqual(['p-new']);
    const record = await mockState.store!.get(pregnancyDetailsId('p-new'));
    expect(record).toMatchObject({ kind: PREGNANCY_KIND, pregnancyId: 'p-new', dirty: true, deleted: false });
    const data = record!.data as Record<string, unknown>;
    expect(Object.keys(data).sort()).toEqual([...PREGNANCY_DETAILS].sort());
    expect(data).toMatchObject({
      lmp_date: '2026-08-01',
      due_date: '2027-05-08',
      blood_group: 'B+',
      conditions: ['Thyroid'],
      doctor: 'Dr. Mehta',
      emergency_phone: '+91 98765 43210',
      units: 'metric',
      allergies: null,
    });
  });

  it('reuses a pregnancy an earlier attempt created, without writing to it', async () => {
    mockState.existing = { id: 'p-old' };
    expect(await create()).toBe('p-old');
    expect(mockState.writes.filter((w) => w.table === 'pregnancies')).toEqual([]);
    expect(await mockState.store!.get(pregnancyDetailsId('p-old'))).not.toBeNull();
  });

  it('makes no new key when the household already has records, so the app asks for the existing one', async () => {
    mockState.existing = { id: 'p-old' };
    mockState.recordsOnServer = 3;
    await create();
    expect(mockState.savedKeys).toEqual([]);
    expect(await mockState.store!.get(pregnancyDetailsId('p-old'))).toBeNull();
  });
});
