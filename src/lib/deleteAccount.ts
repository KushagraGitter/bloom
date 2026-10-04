/**
 * Delete account: the `delete-account` function removes the person from
 * Supabase (and, for the owner, the whole household's synced data), then this
 * phone forgets its own copy, the household key, the app lock and the
 * reminders, and signs out.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAppLock } from '@/lib/appLock';
import { clearScheduled } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { forgetHouseholdKey } from '@/lib/vault/keys';
import { useVault } from '@/lib/vault/VaultProvider';

/** Must match CONFIRM in supabase/functions/delete-account/handler.ts. */
const CONFIRM = 'delete my account';

/** What she types to confirm. */
export const CONFIRM_WORD = 'DELETE';

export type DeleteFailureCode = 'offline' | 'not_set_up' | 'failed';

export class DeleteFailure extends Error {
  constructor(readonly code: DeleteFailureCode) {
    super(code);
  }
}

export const DELETE_FAILURE_TEXT: Record<DeleteFailureCode, string> = {
  offline: 'Couldn’t reach Bloom. Check your connection and try again. Nothing was deleted.',
  not_set_up: 'Deleting accounts isn’t switched on for Bloom yet. Nothing was deleted.',
  failed: 'Something went wrong. Nothing was deleted on this phone; try again.',
};

const settle = (p: Promise<unknown>) => p.catch(() => {});

export function useDeleteAccount(pregnancyId: string | undefined) {
  const vault = useVault();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('delete-account', { body: { confirm: CONFIRM } });
      if (error) {
        const status = (error.context as { status?: number } | undefined)?.status;
        if (error.name !== 'FunctionsHttpError' || typeof status !== 'number') throw new DeleteFailure('offline');
        throw new DeleteFailure(status === 404 ? 'not_set_up' : 'failed');
      }

      // The account is gone; nothing below can bring it back, so a step that
      // fails doesn't stop the rest.
      if (vault.store) await settle(vault.store.wipe());
      if (pregnancyId) await settle(forgetHouseholdKey(pregnancyId));
      await settle(useAppLock.getState().setEnabled(false));
      await settle(clearScheduled());
      queryClient.clear();
      // The user no longer exists on the server, so only this phone's session is cleared.
      await settle(supabase.auth.signOut({ scope: 'local' }));
    },
  });
}
