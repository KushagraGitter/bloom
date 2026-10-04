// Supabase Edge Function `scan` (Deno). The logic is in handler.ts; this file
// only connects it to Supabase and the Anthropic API.
//
// Secrets (Supabase dashboard > Edge Functions > Secrets):
//   ANTHROPIC_API_KEY   required
//   SCAN_MODEL          optional, defaults to DEFAULT_MODEL
//   SCAN_DAILY_LIMIT    optional, scans per household per day, defaults to 50
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by Supabase.

import Anthropic from 'npm:@anthropic-ai/sdk@0.131.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

import { DEFAULT_DAILY_LIMIT, DEFAULT_MODEL, ScanError, handleScan } from './handler.ts';

const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
const anthropic = apiKey ? new Anthropic({ apiKey, maxRetries: 1, timeout: 120_000 }) : null;
const limit = Number(Deno.env.get('SCAN_DAILY_LIMIT') ?? DEFAULT_DAILY_LIMIT);

Deno.serve((req) => {
  const authorization = req.headers.get('Authorization') ?? '';
  // Calls the database as the signed-in user, so claim_scan sees who they are.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return handleScan(req, {
    authorized: authorization.startsWith('Bearer '),
    configured: anthropic !== null,
    model: Deno.env.get('SCAN_MODEL') || DEFAULT_MODEL,
    dailyLimit: Number.isInteger(limit) ? limit : DEFAULT_DAILY_LIMIT,
    claimScan: async (pregnancyId, dailyLimit) => {
      const { data, error } = await supabase.rpc('claim_scan', { p_pregnancy_id: pregnancyId, p_daily_limit: dailyLimit });
      if (error?.code === '42501') throw new ScanError('not_member');
      if (error) throw new Error('claim_scan failed');
      return data === true;
    },
    callClaude: (request) => anthropic!.beta.messages.create(request),
    log: (line) => console.error(line),
  });
});
