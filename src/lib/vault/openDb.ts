import { openDatabaseAsync } from 'expo-sqlite';

import { createLocalStoreAsync, type LocalStore } from '@/lib/vault/localStore';

/** Opens this phone's own database. The web build has its own version of this file. */
export async function openLocalStoreAsync(): Promise<LocalStore> {
  return createLocalStoreAsync(await openDatabaseAsync('bloom-vault.db'));
}
