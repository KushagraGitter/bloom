import { createLocalStoreAsync, deleteRecord, nextUpdatedAt, writeRecord } from '@/lib/vault/localStore';
import { memoryDb } from '@/lib/vault/testHelpers';

const at = (iso: string) => new Date(iso);

describe('local store', () => {
  it('keeps records per pregnancy and kind, and remembers what needs uploading', async () => {
    const store = await createLocalStoreAsync(memoryDb());
    await writeRecord(store, { id: 'a', pregnancyId: 'p1', kind: 'reading', data: { type: 'weight', value: 64.2 } }, at('2026-10-04T10:00:00Z'));
    await writeRecord(store, { id: 'b', pregnancyId: 'p1', kind: 'appointment', data: { title: 'Scan' } }, at('2026-10-04T10:01:00Z'));
    await writeRecord(store, { id: 'c', pregnancyId: 'p2', kind: 'reading', data: { type: 'kicks', value: 3 } }, at('2026-10-04T10:02:00Z'));

    const readings = await store.list('p1', 'reading');
    expect(readings).toEqual([
      { id: 'a', pregnancyId: 'p1', kind: 'reading', data: { type: 'weight', value: 64.2 }, updatedAt: '2026-10-04T10:00:00.000Z', deleted: false, dirty: true },
    ]);
    expect((await store.dirty('p1')).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('leaves a tombstone when a record is deleted', async () => {
    const store = await createLocalStoreAsync(memoryDb());
    await writeRecord(store, { id: 'a', pregnancyId: 'p1', kind: 'reading', data: { v: 1 } }, at('2026-10-04T10:00:00Z'));
    await store.markClean('a', '2026-10-04T10:00:00.000Z');
    await deleteRecord(store, 'a', at('2026-10-04T11:00:00Z'));

    expect(await store.list('p1', 'reading')).toEqual([]);
    expect(await store.get('a')).toMatchObject({ deleted: true, data: null, dirty: true, updatedAt: '2026-10-04T11:00:00.000Z' });
  });

  it('keeps a record dirty if it changed again while it was being uploaded', async () => {
    const store = await createLocalStoreAsync(memoryDb());
    const first = await writeRecord(store, { id: 'a', pregnancyId: 'p1', kind: 'reading', data: { v: 1 } }, at('2026-10-04T10:00:00Z'));
    await writeRecord(store, { id: 'a', pregnancyId: 'p1', kind: 'reading', data: { v: 2 } }, at('2026-10-04T10:00:05Z'));
    await store.markClean('a', first.updatedAt);
    expect(await store.get('a')).toMatchObject({ dirty: true, data: { v: 2 } });
  });

  it('only moves the sync position forward', async () => {
    const store = await createLocalStoreAsync(memoryDb());
    expect(await store.lastSeq('p1')).toBe(0);
    await store.setLastSeq('p1', 40);
    await store.setLastSeq('p1', 12);
    expect(await store.lastSeq('p1')).toBe(40);
  });

  it('can open the same database twice', async () => {
    const db = memoryDb();
    await createLocalStoreAsync(db);
    await expect(createLocalStoreAsync(db)).resolves.toBeDefined();
  });
});

describe('nextUpdatedAt', () => {
  it('is now, unless the clock went backwards, then just after the last change', () => {
    expect(nextUpdatedAt(undefined, at('2026-10-04T10:00:00Z'))).toBe('2026-10-04T10:00:00.000Z');
    expect(nextUpdatedAt('2026-10-04T09:00:00.000Z', at('2026-10-04T10:00:00Z'))).toBe('2026-10-04T10:00:00.000Z');
    expect(nextUpdatedAt('2026-10-04T11:00:00.000Z', at('2026-10-04T10:00:00Z'))).toBe('2026-10-04T11:00:00.001Z');
  });
});
