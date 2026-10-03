import { newHouseholdKey, open, VaultDecryptError, type HouseholdKey } from '@/lib/vault/crypto';
import type { VaultRemote } from '@/lib/vault/sync';

export type KeyResolution = { status: 'ready'; key: HouseholdKey; created: boolean } | { status: 'needs-key' };

/**
 * Works out this phone's household key. A phone that already has it uses it.
 * The owner's phone makes one when the household has no encrypted records yet
 * (her first time on the new data layer). Anyone else, or the owner on a new
 * phone once records exist, has to be given it: scanned from the other phone
 * or typed in from the recovery phrase. Making a fresh key there would lock
 * them out of everything already saved.
 */
export async function resolveHouseholdKey({
  role,
  loadKey,
  saveKey,
  countRecords,
}: {
  role: 'owner' | 'partner';
  loadKey: () => Promise<HouseholdKey | null>;
  saveKey: (key: HouseholdKey) => Promise<void>;
  countRecords: () => Promise<number>;
}): Promise<KeyResolution> {
  const stored = await loadKey();
  if (stored) return { status: 'ready', key: stored, created: false };
  if (role !== 'owner' || (await countRecords()) > 0) return { status: 'needs-key' };
  const key = newHouseholdKey();
  await saveKey(key);
  return { status: 'ready', key, created: true };
}

/**
 * Checks a key someone scanned or typed against what the household has
 * already saved, so a phrase from another household (or an old key) is
 * refused instead of silently splitting the data in two. With nothing saved
 * yet there is nothing to check against, and any well-formed key is taken.
 */
export async function keyFitsHousehold(key: HouseholdKey, pregnancyId: string, remote: VaultRemote): Promise<boolean> {
  const [first] = await remote.pullAfter(pregnancyId, 0, 1);
  if (!first) return true;
  if (first.key_version !== key.version) return false;
  try {
    open(key, { pregnancyId, id: first.id }, first);
    return true;
  } catch (error) {
    if (error instanceof VaultDecryptError) return false;
    throw error;
  }
}

/** What the QR code on the other phone carries. */
export const QR_PREFIX = 'bloom-key:';
