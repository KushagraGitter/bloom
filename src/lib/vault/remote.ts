import { supabase } from '@/lib/supabase';
import type { RemoteRecord, VaultRemote } from '@/lib/vault/sync';

const COLUMNS = 'id, pregnancy_id, key_version, nonce, ciphertext, client_updated_at, seq';

/** `vault_records` in Supabase. Row Level Security limits it to the household's members. */
export const supabaseVault: VaultRemote = {
  async push(rows) {
    if (rows.length === 0) return;
    const { error } = await supabase.from('vault_records').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  },

  async pullAfter(pregnancyId, seq, limit) {
    const { data, error } = await supabase
      .from('vault_records')
      .select(COLUMNS)
      .eq('pregnancy_id', pregnancyId)
      .gt('seq', seq)
      .order('seq')
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as RemoteRecord[];
  },
};

/** How many encrypted records the household has saved so far. */
export async function countVaultRecords(pregnancyId: string): Promise<number> {
  const { count, error } = await supabase
    .from('vault_records')
    .select('id', { count: 'exact', head: true })
    .eq('pregnancy_id', pregnancyId);
  if (error) throw error;
  return count ?? 0;
}
