// Supabase Edge Function `delete-account` (Deno). The logic is in handler.ts.
//
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided
// by Supabase. The service role key stays here and never reaches the app.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { handleDeleteAccount } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve((req) => {
  const authorization = req.headers.get('Authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '');

  return handleDeleteAccount(req, {
    authorized: authorization.startsWith('Bearer ') && token.length > 0,
    currentUserId: async () => {
      const { data, error } = await admin.auth.getUser(token);
      if (error) return null;
      return data.user?.id ?? null;
    },
    deleteUser: async (userId) => {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
    },
    log: (line) => console.error(line),
  });
});
