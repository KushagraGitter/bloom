// The logic of the `delete-account` Edge Function, kept free of Deno and
// Supabase imports so Jest can test it. index.ts connects it to Supabase.
//
// Deleting the auth user removes everything that hangs off it in the
// database: the profile, then (through `on delete cascade`) the pregnancy she
// owns with its members, invites, vault records and scan counts. A partner
// deleting their account removes only their own profile and membership.

export type DeleteDeps = {
  /** The request carried a bearer token. */
  authorized: boolean;
  /** Who the token belongs to, checked with Supabase Auth; null if it isn't a valid session. */
  currentUserId: () => Promise<string | null>;
  /** Removes the auth user with the service role, which only this function holds. */
  deleteUser: (userId: string) => Promise<void>;
  log: (line: string) => void;
};

/** The app sends this to show the person confirmed it on screen. */
export const CONFIRM = 'delete my account';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export async function handleDeleteAccount(req: Request, deps: DeleteDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'bad_request' });
  if (!deps.authorized) return json(401, { error: 'not_signed_in' });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'bad_request' });
  }
  if ((body as { confirm?: unknown } | null)?.confirm !== CONFIRM) return json(400, { error: 'bad_request' });

  let userId: string | null;
  try {
    userId = await deps.currentUserId();
  } catch (e) {
    deps.log(`delete-account: checking the session failed: ${String(e)}`);
    return json(502, { error: 'failed' });
  }
  if (!userId) return json(401, { error: 'not_signed_in' });

  try {
    await deps.deleteUser(userId);
  } catch (e) {
    deps.log(`delete-account: deleting the user failed: ${String(e)}`);
    return json(502, { error: 'failed' });
  }
  return json(200, { deleted: true });
}
