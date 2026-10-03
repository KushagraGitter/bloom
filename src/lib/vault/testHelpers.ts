// Test doubles for the vault: Node's own SQLite standing in for expo-sqlite,
// and an in-memory server that behaves like `vault_records` (server-assigned
// seq, newest edit wins).

import { createLocalStoreAsync, type SqlDatabase } from '@/lib/vault/localStore';
import type { RemoteRecord, VaultRemote } from '@/lib/vault/sync';

export function memoryDb(): SqlDatabase {
  type Statement = { run(...a: unknown[]): unknown; get(...a: unknown[]): unknown; all(...a: unknown[]): unknown[] };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require('node:sqlite') as {
    DatabaseSync: new (path: string) => { exec(sql: string): void; prepare(sql: string): Statement };
  };
  const db = new DatabaseSync(':memory:');
  const args = (params: unknown) => (Array.isArray(params) ? params : []) as (string | number | null)[];
  return {
    async execAsync(source) {
      db.exec(source);
    },
    async runAsync(source, params) {
      return db.prepare(source).run(...args(params));
    },
    async getFirstAsync<T>(source: string, params: unknown) {
      return ((db.prepare(source).get(...args(params)) as T | undefined) ?? null) as T | null;
    },
    async getAllAsync<T>(source: string, params: unknown) {
      return db.prepare(source).all(...args(params)) as T[];
    },
  };
}

export function fakeServer() {
  const rows = new Map<string, RemoteRecord>();
  let seq = 0;
  const remote: VaultRemote = {
    async push(batch) {
      for (const row of batch) {
        const existing = rows.get(row.id);
        if (existing && existing.pregnancy_id !== row.pregnancy_id) throw new Error('42501');
        if (existing && Date.parse(row.client_updated_at) < Date.parse(existing.client_updated_at)) continue;
        rows.set(row.id, { ...row, seq: ++seq });
      }
    },
    async pullAfter(pregnancyId, after, limit) {
      return [...rows.values()]
        .filter((r) => r.pregnancy_id === pregnancyId && r.seq > after)
        .sort((a, b) => a.seq - b.seq)
        .slice(0, limit)
        .map((r) => ({ ...r }));
    },
  };
  return { remote, rows, bumpSeq: (n: number) => (seq += n) };
}

/** Bytes as one character each, to search sealed data for leaked text. */
export function latin1(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => String.fromCharCode(b)).join('');
}

/** A vault that is ready on this phone, backed by an in-memory store, for screen and hook tests. */
export async function readyVault(role: 'owner' | 'partner' = 'owner') {
  const store = await createLocalStoreAsync(memoryDb());
  const syncs: number[] = [];
  const vault = {
    state: 'ready' as const,
    role,
    householdKey: { version: 1, bytes: new Uint8Array(32) },
    store,
    sync: {
      syncing: false,
      error: null,
      lastSyncedAt: new Date(0),
      requestSync: async () => {
        syncs.push(Date.now());
      },
    },
    adoptKey: async () => true,
    retry: () => {},
  };
  return { vault, store, syncs };
}
