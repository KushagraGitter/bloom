import type { SQLiteBindParams } from 'expo-sqlite';

/**
 * One health record as the phone keeps it. `data` is whatever the feature
 * stores (a reading, a medicine, an appointment); the store does not look
 * inside it. A deleted record stays as a tombstone (`deleted`, `data` null) so
 * the delete can reach the other phone.
 */
export type LocalRecord = {
  id: string;
  pregnancyId: string;
  kind: string;
  data: unknown;
  /** When this phone or the other one last changed it, as an ISO string. */
  updatedAt: string;
  deleted: boolean;
  /** Changed here and not yet uploaded. */
  dirty: boolean;
};

/** The few expo-sqlite calls the store uses, so tests can run it on Node's SQLite. */
export type SqlDatabase = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SQLiteBindParams): Promise<unknown>;
  getFirstAsync<T>(source: string, params: SQLiteBindParams): Promise<T | null>;
  getAllAsync<T>(source: string, params: SQLiteBindParams): Promise<T[]>;
};

type Row = {
  id: string;
  pregnancy_id: string;
  kind: string;
  data: string | null;
  updated_at: string;
  deleted: number;
  dirty: number;
};

const SCHEMA = `
  create table if not exists records (
    id text primary key not null,
    pregnancy_id text not null,
    kind text not null,
    data text,
    updated_at text not null,
    deleted integer not null default 0,
    dirty integer not null default 0
  );
  create index if not exists records_kind_idx on records (pregnancy_id, kind, deleted);
  create index if not exists records_dirty_idx on records (pregnancy_id, dirty);
  create table if not exists sync_state (
    pregnancy_id text primary key not null,
    last_seq integer not null default 0
  );
`;

const toRecord = (row: Row): LocalRecord => ({
  id: row.id,
  pregnancyId: row.pregnancy_id,
  kind: row.kind,
  data: row.data === null ? null : JSON.parse(row.data),
  updatedAt: row.updated_at,
  deleted: row.deleted === 1,
  dirty: row.dirty === 1,
});

export type LocalStore = ReturnType<typeof createLocalStore>;

/** The phone's own copy of every record, in SQLite. This is what screens read. */
export async function createLocalStoreAsync(db: SqlDatabase) {
  await db.execAsync(SCHEMA);
  return createLocalStore(db);
}

function createLocalStore(db: SqlDatabase) {
  return {
    async get(id: string): Promise<LocalRecord | null> {
      const row = await db.getFirstAsync<Row>('select * from records where id = ?', [id]);
      return row ? toRecord(row) : null;
    },

    /** Live (not deleted) records of one kind, oldest change first. */
    async list(pregnancyId: string, kind: string): Promise<LocalRecord[]> {
      const rows = await db.getAllAsync<Row>(
        'select * from records where pregnancy_id = ? and kind = ? and deleted = 0 order by updated_at, id',
        [pregnancyId, kind],
      );
      return rows.map(toRecord);
    },

    async dirty(pregnancyId: string): Promise<LocalRecord[]> {
      const rows = await db.getAllAsync<Row>('select * from records where pregnancy_id = ? and dirty = 1 order by updated_at', [
        pregnancyId,
      ]);
      return rows.map(toRecord);
    },

    /** Saves a record as it is, used for changes that arrive from the other phone. */
    async put(record: LocalRecord): Promise<void> {
      await db.runAsync(
        `insert into records (id, pregnancy_id, kind, data, updated_at, deleted, dirty) values (?, ?, ?, ?, ?, ?, ?)
         on conflict (id) do update set pregnancy_id = excluded.pregnancy_id, kind = excluded.kind, data = excluded.data,
           updated_at = excluded.updated_at, deleted = excluded.deleted, dirty = excluded.dirty`,
        [
          record.id,
          record.pregnancyId,
          record.kind,
          record.data === null || record.data === undefined ? null : JSON.stringify(record.data),
          record.updatedAt,
          record.deleted ? 1 : 0,
          record.dirty ? 1 : 0,
        ],
      );
    },

    /**
     * Marks an uploaded record as synced, unless it changed again while the
     * upload was in flight (then it stays dirty and goes up next time).
     */
    async markClean(id: string, updatedAt: string): Promise<void> {
      await db.runAsync('update records set dirty = 0 where id = ? and updated_at = ?', [id, updatedAt]);
    },

    async lastSeq(pregnancyId: string): Promise<number> {
      const row = await db.getFirstAsync<{ last_seq: number }>('select last_seq from sync_state where pregnancy_id = ?', [pregnancyId]);
      return row?.last_seq ?? 0;
    },

    async setLastSeq(pregnancyId: string, seq: number): Promise<void> {
      await db.runAsync(
        `insert into sync_state (pregnancy_id, last_seq) values (?, ?)
         on conflict (pregnancy_id) do update set last_seq = max(last_seq, excluded.last_seq)`,
        [pregnancyId, seq],
      );
    },
  };
}

/**
 * A timestamp for a change made now that sorts after `previous`, even if this
 * phone's clock went backwards, so an edit always wins over the version it
 * replaced.
 */
export function nextUpdatedAt(previous: string | undefined, now = new Date()): string {
  const stamp = now.toISOString();
  if (!previous || stamp > previous) return stamp;
  return new Date(Date.parse(previous) + 1).toISOString();
}

/** Saves a change made on this phone. It is uploaded on the next sync. */
export async function writeRecord(
  store: LocalStore,
  record: { id: string; pregnancyId: string; kind: string; data: unknown },
  now = new Date(),
): Promise<LocalRecord> {
  const existing = await store.get(record.id);
  const saved: LocalRecord = { ...record, updatedAt: nextUpdatedAt(existing?.updatedAt, now), deleted: false, dirty: true };
  await store.put(saved);
  return saved;
}

/** Deletes a record on this phone and leaves a tombstone for the other phone. */
export async function deleteRecord(store: LocalStore, id: string, now = new Date()): Promise<void> {
  const existing = await store.get(id);
  if (!existing || existing.deleted) return;
  await store.put({ ...existing, data: null, deleted: true, dirty: true, updatedAt: nextUpdatedAt(existing.updatedAt, now) });
}
