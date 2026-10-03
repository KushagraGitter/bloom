import { Redirect } from 'expo-router';

import { useMembership } from '@/lib/data';
import { useSession } from '@/lib/session';

/**
 * Landing route for the OAuth redirect (`bloom://auth/callback`). The in-app
 * browser normally captures the redirect first; if the OS opens the app with
 * it instead, send the user wherever their session says they belong.
 */
export default function AuthCallback() {
  const { session, loading } = useSession();
  const membership = useMembership();
  if (loading || (session && membership.isPending)) return null;
  if (!session) return <Redirect href="/welcome" />;
  return <Redirect href={membership.data ? '/' : '/onboarding'} />;
}
