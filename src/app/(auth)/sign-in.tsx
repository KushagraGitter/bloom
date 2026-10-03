import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton, Button, Card, Text } from '@/components';
import { signInWithGoogle } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, fonts } from '@/theme/tokens';

export default function SignInScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const google = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // On success the session changes and the root layout moves on to onboarding.
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} />
      <View style={styles.copy}>
        <Text style={styles.title} accessibilityRole="header">
          Let&apos;s get you signed in
        </Text>
        <Text muted style={styles.hint}>
          Your data stays private and backs up to your account, so nothing is lost if you change phones.
        </Text>
      </View>
      <Card tone={colors.yellow} size="panel" elevation="lg" style={styles.card}>
        <Text variant="title">Takes about 2 minutes</Text>
        <Text style={styles.cardBody}>
          A few questions about your pregnancy so we can work out your week, your due date and the right reminders.
        </Text>
      </Card>

      <View style={styles.actions}>
        {!isSupabaseConfigured && (
          <Card tone={colors.pink}>
            <Text variant="label">The app isn&apos;t connected to Supabase yet. Add the keys to .env.local and restart.</Text>
          </Card>
        )}
        {error && (
          <Card tone={colors.pink} accessibilityLiveRegion="polite">
            <Text variant="label">{error}</Text>
          </Card>
        )}
        <Button
          label={busy ? 'Signing in…' : 'Continue with Google'}
          onPress={google}
          disabled={busy || !isSupabaseConfigured}
          accessibilityState={{ busy }}
          style={styles.google}
        />
        <Text variant="caption" style={styles.fine}>
          Bloom doesn&apos;t replace advice from your doctor.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, gap: 22 },
  copy: { gap: 10 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 33, letterSpacing: -0.6 },
  hint: { fontSize: 15, lineHeight: 21 },
  card: { padding: 20, gap: 10 },
  cardBody: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20 },
  actions: { marginTop: 'auto', gap: 12 },
  google: { minHeight: 56, borderRadius: 18 },
  fine: { textAlign: 'center' },
});
