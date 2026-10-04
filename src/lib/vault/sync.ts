import { open, seal, VaultDecryptError, type HouseholdKey } from '@/lib/vault/crypto';
import type { LocalStore } from '@/lib/vault/localStore';

/** A row of `vault_records`: everything the server knows about a record. */
export type RemoteRecord = {
  id: string;
  pregnancy_id: string;
  key_version: number;
  nonce: string;
  ciphertext: string;
  client_updated_at: string;
  seq: number;
};

export type VaultRemote = {
  /** Inserts or replaces records. The server keeps whichever edit is newer. */
  push(rows: Omit<RemoteRecord, 'seq'>[]): Promise<void>;
  /** Records of the household written after `seq`, in seq order. */
  pullAfter(pregnancyId: string, seq: number, limit: number): Promise<RemoteRecord[]>;
};

/** What is sealed inside each blob. Kind and deletion live in here so the server cannot see or change them. */
type Payload = { kind: string; data: unknown; deleted: boolean; updatedAt: string };

export const PUSH_BATCH = 200;
/** Most sealed characters sent in one upload, so a few photos don't make one huge request. */
export const PUSH_BYTES = 3_000_000;
export const PULL_PAGE = 500;
/**
 * Pulls start this many seqs before the last one seen. A write that took its
 * seq first but committed after a later one would otherwise be skipped; with
 * two people writing, a hundred in flight at once cannot happen. Records
 * already up to date are left alone, so pulling them again is harmless.
 */
export const PULL_OVERLAP = 100;

export type SyncResult = { pushed: number; pulled: number };

function isPayload(value: unknown): value is Payload {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return typeof p.kind === 'string' && typeof p.deleted === 'boolean' && typeof p.updatedAt === 'string' && 'data' in p;
}

/** Uploads this phone's changes, then downloads the other phone's. */
export async function syncOnce({
  store,
  remote,
  key,
  pregnancyId,
}: {
  store: LocalStore;
  remote: VaultRemote;
  key: HouseholdKey;
  pregnancyId: string;
}): Promise<SyncResult> {
  const pushed = await push(store, remote, key, pregnancyId);
  const pulled = await pull(store, remote, key, pregnancyId);
  return { pushed, pulled };
}

async function push(store: LocalStore, remote: VaultRemote, key: HouseholdKey, pregnancyId: string): Promise<number> {
  const dirty = await store.dirty(pregnancyId);
  let batch: { record: (typeof dirty)[number]; row: Omit<RemoteRecord, 'seq'> }[] = [];
  let bytes = 0;
  const send = async () => {
    if (batch.length === 0) return;
    await remote.push(batch.map((b) => b.row));
    for (const { record } of batch) await store.markClean(record.id, record.updatedAt);
    batch = [];
    bytes = 0;
  };
  for (const record of dirty) {
    const payload: Payload = { kind: record.kind, data: record.data, deleted: record.deleted, updatedAt: record.updatedAt };
    const sealed = seal(key, { pregnancyId, id: record.id }, payload);
    // A bump photo is a few hundred KB sealed, so a batch is also capped by size.
    if (batch.length > 0 && (batch.length >= PUSH_BATCH || bytes + sealed.ciphertext.length > PUSH_BYTES)) await send();
    batch.push({
      record,
      row: {
        id: record.id,
        pregnancy_id: pregnancyId,
        key_version: key.version,
        nonce: sealed.nonce,
        ciphertext: sealed.ciphertext,
        client_updated_at: record.updatedAt,
      },
    });
    bytes += sealed.ciphertext.length;
  }
  await send();
  return dirty.length;
}

async function pull(store: LocalStore, remote: VaultRemote, key: HouseholdKey, pregnancyId: string): Promise<number> {
  let after = Math.max(0, (await store.lastSeq(pregnancyId)) - PULL_OVERLAP);
  let applied = 0;
  for (;;) {
    const rows = await remote.pullAfter(pregnancyId, after, PULL_PAGE);
    for (const row of rows) {
      let payload: unknown;
      try {
        if (row.key_version !== key.version) throw new VaultDecryptError('This record was locked with a different household key.');
        payload = open(key, { pregnancyId, id: row.id }, row);
        if (!isPayload(payload)) throw new VaultDecryptError('This record is not in a shape Bloom understands.');
      } catch (error) {
        // Keep what was read so far, and stop here so this record is tried
        // again rather than skipped for good.
        await store.setLastSeq(pregnancyId, after);
        throw error;
      }
      const local = await store.get(row.id);
      if (!local || local.updatedAt < payload.updatedAt) {
        await store.put({
          id: row.id,
          pregnancyId,
          kind: payload.kind,
          data: payload.deleted ? null : payload.data,
          updatedAt: payload.updatedAt,
          deleted: payload.deleted,
          dirty: false,
        });
        applied++;
      }
      after = row.seq;
    }
    await store.setLastSeq(pregnancyId, after);
    if (rows.length < PULL_PAGE) return applied;
  }
}
