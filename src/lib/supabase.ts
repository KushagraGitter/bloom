import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** False until `.env.local` has the project URL and anon key (see README). */
export const isSupabaseConfigured = Boolean(url && anonKey);

// The anon key is public by design; Row Level Security is what protects data.
// Placeholders keep the app booting before a project exists.
export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'missing-anon-key', {
  auth: {
    storage: Platform.OS === 'web' && typeof window === 'undefined' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Web sign-in returns to /auth/callback?code=…, which the client exchanges.
    detectSessionInUrl: Platform.OS === 'web',
    // Code exchange (PKCE) for the browser sign-in in src/lib/auth.ts.
    flowType: 'pkce',
  },
});

// Only refresh the session while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
