import { newHouseholdKey, seal, VaultDecryptError, type HouseholdKey } from '@/lib/vault/crypto';
import { createLocalStoreAsync, deleteRecord, writeRecord, type LocalStore } from '@/lib/vault/localStore';
import { PULL_OVERLAP, PULL_PAGE, PUSH_BYTES, syncOnce, type VaultRemote } from '@/lib/vault/sync';
import { fromBase64 } from '@/lib/vault/base64';
import { fakeServer, latin1, memoryDb } from '@/lib/vault/testHelpers';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)),
}));

const P = 'p1';
const at = (iso: string) => new Date(iso);

async function phone(remote: VaultRemote, key: HouseholdKey) {
  const store = await createLocalStoreAsync(memoryDb());
  return { store, sync: () => syncOnce({ store, remote, key, pregnancyId: P }) };
}

async function household() {
  const server = fakeServer();
  const key = newHouseholdKey();
  return { server, key, hers: await phone(server.remote, key), his: await phone(server.remote, key) };
}

const write = (store: LocalStore, id: string, data: unknown, when: string, kind = 'reading') =>
  writeRecord(store, { id, pregnancyId: P, kind, data }, at(when));

describe('syncOnce', () => {
  it("brings her changes to his phone, and his to hers", async () => {
    const { hers, his } = await household();
    await write(hers.store, 'a', { type: 'weight', value: 64.2 }, '2026-10-04T10:00:00Z');
    await write(his.store, 'b', { title: 'Growth scan' }, '2026-10-04T10:05:00Z', 'appointment');

    expect(await hers.sync()).toEqual({ pushed: 1, pulled: 0 });
    expect(await his.sync()).toEqual({ pushed: 1, pulled: 1 });
    expect(await hers.sync()).toEqual({ pushed: 0, pulled: 1 });

    for (const { store } of [hers, his]) {
      expect((await store.list(P, 'reading')).map((r) => r.data)).toEqual([{ type: 'weight', value: 64.2 }]);
      expect((await store.list(P, 'appointment')).map((r) => r.data)).toEqual([{ title: 'Growth scan' }]);
      expect(await store.dirty(P)).toEqual([]);
    }
  });

  it('gives the server nothing readable', async () => {
    const { server, hers } = await household();
    await write(hers.store, 'a', { type: 'bp', value: 112, value2: 74, note: 'after lunch' }, '2026-10-04T10:00:00Z');
    await hers.sync();

    const [row] = server.rows.values();
    expect(Object.keys(row).sort()).toEqual(['ciphertext', 'client_updated_at', 'id', 'key_version', 'nonce', 'pregnancy_id', 'seq']);
    const everything = JSON.stringify(row) + latin1(fromBase64(row.ciphertext));
    // Long enough that random bytes won't contain them by chance.
    for (const secret of ['"bp"', '"value":112', 'after lunch', 'reading']) expect(everything).not.toContain(secret);
  });

  it('carries deletes across', async () => {
    const { hers, his } = await household();
    await write(hers.store, 'a', { v: 1 }, '2026-10-04T10:00:00Z');
    await hers.sync();
    await his.sync();

    await deleteRecord(his.store, 'a', at('2026-10-04T11:00:00Z'));
    await his.sync();
    await hers.sync();
    expect(await hers.store.list(P, 'reading')).toEqual([]);
    expect(await hers.store.get('a')).toMatchObject({ deleted: true, data: null, dirty: false });
  });

  it('keeps the newest edit when both phones changed the same record offline', async () => {
    const { hers, his } = await household();
    await write(hers.store, 'a', { v: 'first' }, '2026-10-04T10:00:00Z');
    await hers.sync();
    await his.sync();

    // Both offline: he edits at 11:00, she edits later at 12:00 but he syncs last.
    await write(his.store, 'a', { v: 'his' }, '2026-10-04T11:00:00Z');
    await write(hers.store, 'a', { v: 'hers' }, '2026-10-04T12:00:00Z');
    await hers.sync();
    await his.sync();
    await hers.sync();

    expect((await hers.store.get('a'))?.data).toEqual({ v: 'hers' });
    expect((await his.store.get('a'))?.data).toEqual({ v: 'hers' });
  });

  it('does not let an older download overwrite a newer edit that has not been uploaded yet', async () => {
    const { server, key, hers, his } = await household();
    await write(his.store, 'a', { v: 'his, older' }, '2026-10-04T10:00:00Z');
    await his.sync();
    await write(hers.store, 'a', { v: 'hers, newer' }, '2026-10-04T11:00:00Z');

    // Her upload hasn't gone through yet when the download arrives.
    const pullOnly: VaultRemote = { push: async () => {}, pullAfter: server.remote.pullAfter };
    const result = await syncOnce({ store: hers.store, remote: pullOnly, key, pregnancyId: P });
    expect(result.pulled).toBe(0);
    expect((await hers.store.get('a'))?.data).toEqual({ v: 'hers, newer' });
  });

  it('pages through more records than one pull returns', async () => {
    const { hers, his } = await household();
    for (let i = 0; i < PULL_PAGE + 20; i++) await write(hers.store, `r${i}`, { i }, '2026-10-04T10:00:00Z');
    await hers.sync();
    expect((await his.sync()).pulled).toBe(PULL_PAGE + 20);
    expect(await his.store.list(P, 'reading')).toHaveLength(PULL_PAGE + 20);
  });

  it('picks up a write that committed after a later one had already been pulled', async () => {
    const { server, key, hers, his } = await household();
    server.bumpSeq(1000);
    await write(hers.store, 'a', { v: 1 }, '2026-10-04T10:00:00Z');
    await hers.sync();
    await his.sync();

    // A write that took an earlier seq but only became visible now.
    const late = { id: 'late', pregnancy_id: P, key_version: key.version, client_updated_at: '2026-10-04T10:30:00Z' };
    const sealed = seal(key, { pregnancyId: P, id: 'late' }, { kind: 'reading', data: { v: 'late' }, deleted: false, updatedAt: '2026-10-04T10:30:00.000Z' });
    const lastSeen = await his.store.lastSeq(P);
    server.rows.set('late', { ...late, ...sealed, seq: lastSeen - Math.floor(PULL_OVERLAP / 2) });

    await his.sync();
    expect((await his.store.get('late'))?.data).toEqual({ v: 'late' });
  });

  it('stops, without skipping, at a record it cannot unlock', async () => {
    const { server, hers } = await household();
    const stranger = await phone(server.remote, newHouseholdKey());
    await write(hers.store, 'a', { v: 1 }, '2026-10-04T10:00:00Z');
    await hers.sync();

    await expect(stranger.sync()).rejects.toThrow(VaultDecryptError);
    expect(await stranger.store.get('a')).toBeNull();
    expect(await stranger.store.lastSeq(P)).toBe(0);
  });

  it('keeps local changes for the next try when the upload fails', async () => {
    const { hers } = await household();
    await write(hers.store, 'a', { v: 1 }, '2026-10-04T10:00:00Z');
    const offline: VaultRemote = {
      push: async () => {
        throw new Error('Network request failed');
      },
      pullAfter: async () => [],
    };
    await expect(syncOnce({ store: hers.store, remote: offline, key: newHouseholdKey(), pregnancyId: P })).rejects.toThrow('Network');
    expect(await hers.store.dirty(P)).toHaveLength(1);
  });

  it('splits big uploads, like a few photos, into several requests', async () => {
    const { server, hers, his } = await household();
    const pushes: number[] = [];
    const push = server.remote.push;
    server.remote.push = async (rows) => {
      pushes.push(rows.reduce((n, r) => n + r.ciphertext.length, 0));
      return push(rows);
    };
    const photo = 'x'.repeat(PUSH_BYTES / 3);
    for (const id of ['a', 'b', 'c', 'd']) await write(hers.store, id, { jpeg: photo }, '2026-10-04T10:00:00Z', 'bump-image');
    await write(hers.store, 'e', { v: 1 }, '2026-10-04T10:00:00Z');

    expect(await hers.sync()).toEqual({ pushed: 5, pulled: 0 });
    expect(pushes).toHaveLength(2);
    for (const size of pushes) expect(size).toBeLessThanOrEqual(PUSH_BYTES);
    expect(await hers.store.dirty(P)).toEqual([]);
    expect(await his.sync()).toEqual({ pushed: 0, pulled: 5 });
    expect((await his.store.list(P, 'bump-image')).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('still sends a record bigger than the cap, on its own', async () => {
    const { server, hers } = await household();
    const sizes: number[] = [];
    const push = server.remote.push;
    server.remote.push = async (rows) => {
      sizes.push(rows.length);
      return push(rows);
    };
    await write(hers.store, 'a', { v: 1 }, '2026-10-04T10:00:00Z');
    await write(hers.store, 'b', { jpeg: 'x'.repeat(PUSH_BYTES) }, '2026-10-04T10:00:01Z');
    await write(hers.store, 'c', { v: 2 }, '2026-10-04T10:00:02Z');
    await hers.sync();
    expect(sizes).toEqual([1, 1, 1]);
    expect(server.rows.size).toBe(3);
  });
});
