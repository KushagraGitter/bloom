import type { LocalStore } from '@/lib/vault/localStore';

// The web build is a preview without the keychain or an on-phone database, so
// it never opens one. Keeping expo-sqlite out of this file also keeps its
// WebAssembly worker out of the web bundle.
export async function openLocalStoreAsync(): Promise<LocalStore> {
  throw new Error('The household data lives in the phone app.');
}
