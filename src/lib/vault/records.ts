import { sha256 } from '@noble/hashes/sha2.js';
import { useQuery } from '@tanstack/react-query';
import { getRandomBytes } from 'expo-crypto';

import { deleteRecord, writeRecord, type LocalRecord, type LocalStore } from '@/lib/vault/localStore';
import { vaultKey } from '@/lib/vault/useVaultSync';
import { useVault, type Vault } from '@/lib/vault/VaultProvider';

/**
 * What features build on: read records of a kind from this phone's store,
 * save or delete one, and let sync carry the change to the other phone.
 */

/** A record's id and contents, as a feature sees it. */
export type VaultItem<T> = { id: string; data: T; updatedAt: string };

export class VaultNotReadyError extends Error {
  constructor() {
    super('This phone doesn’t have the household key yet.');
    this.name = 'VaultNotReadyError';
  }
}

/** A query key under `vaultKey`, so every pull from the other phone refreshes it. */
export const vaultQueryKey = (pregnancyId: string | undefined, ...rest: readonly unknown[]) =>
  [...vaultKey(pregnancyId ?? 'none'), ...rest] as const;

const ID_ASCII = /^[\x20-\x7e]*$/;

/**
 * The same UUID for the same parts on either phone, for records that must
 * not be doubled when both phones create them (a dose for one medicine on
 * one day, the pregnancy details). Parts are joined with a separator that
 * cannot appear in them.
 */
export function stableId(...parts: string[]): string {
  const text = parts.join('\u001f');
  if (!ID_ASCII.test(parts.join(''))) throw new Error('stableId parts must be plain ASCII');
  return formatUuid(sha256(Uint8Array.from(text, (c) => c.charCodeAt(0))).slice(0, 16), 0x80);
}

/** A fresh random id for a new record. */
export function newId(): string {
  return formatUuid(getRandomBytes(16), 0x40);
}

function formatUuid(bytes: Uint8Array, version: number): string {
  bytes[6] = (bytes[6] & 0x0f) | version;
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const toItem = <T>(record: LocalRecord): VaultItem<T> => ({ id: record.id, data: record.data as T, updatedAt: record.updatedAt });

/** Live records of one kind, oldest change first. */
export async function listItems<T>(store: LocalStore, pregnancyId: string, kind: string): Promise<VaultItem<T>[]> {
  return (await store.list(pregnancyId, kind)).map((r) => toItem<T>(r));
}

/** The store, once this phone has the key; throws otherwise so a save shows its error. */
export function readyStore(vault: Vault): LocalStore {
  if (vault.state !== 'ready' || !vault.store) throw new VaultNotReadyError();
  return vault.store;
}

/** Saves a change made on this phone and starts uploading it. */
export async function saveItem(
  vault: Vault,
  record: { id: string; pregnancyId: string; kind: string; data: unknown },
  now?: Date,
): Promise<void> {
  await writeRecord(readyStore(vault), record, now);
  void vault.sync?.requestSync();
}

/** Deletes records on this phone and starts uploading the deletes. */
export async function removeItems(vault: Vault, ids: string[]): Promise<void> {
  const store = readyStore(vault);
  for (const id of ids) await deleteRecord(store, id);
  void vault.sync?.requestSync();
}

/**
 * A query over this phone's store. It waits until the phone has the key, and
 * is refreshed whenever a sync brings in changes from the other phone.
 */
export function useVaultQuery<T>(
  pregnancyId: string | undefined,
  key: readonly unknown[],
  read: (store: LocalStore, pregnancyId: string) => Promise<T>,
) {
  const vault = useVault();
  const store = vault.state === 'ready' ? vault.store : null;
  return useQuery({
    queryKey: vaultQueryKey(pregnancyId, ...key),
    enabled: !!pregnancyId && !!store,
    queryFn: () => read(store!, pregnancyId!),
    // The store is on the phone: nothing goes stale behind its back.
    staleTime: Infinity,
  });
}
