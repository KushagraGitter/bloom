import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import {
  Figtree_400Regular,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
} from '@expo-google-fonts/figtree';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Button, Text } from '@/components';
import { AppLock } from '@/components/AppLock';
import { useCopyOldData } from '@/lib/copyOldData';
import { useMembership } from '@/lib/data';
import { queryClient } from '@/lib/queryClient';
import { SessionProvider, useSession } from '@/lib/session';
import { useReminders } from '@/lib/useReminders';
import { useVault, VaultProvider } from '@/lib/vault/VaultProvider';
import { makeStyles, ThemeProvider, useTheme } from '@/theme/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Figtree_400Regular,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
  });

  if (!loaded && !error) return null;

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <SafeAreaProvider>
            <ThemedStatusBar />
            <RootNavigator />
          </SafeAreaProvider>
        </SessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

/** Dark icons on the light theme, light icons on the dark one. */
function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

/**
 * Signed out → welcome and sign-in. Signed in without a pregnancy →
 * onboarding (set one up, or join a partner's with a code). Otherwise → tabs,
 * once this phone can read the pregnancy details (see `Routes`).
 */
function RootNavigator() {
  const styles = useStyles();
  const { session, loading } = useSession();
  const membership = useMembership();
  const signedIn = !!session;
  const ready = !loading && (!signedIn || !membership.isPending);

  // Otherwise `Routes` hides the splash once it knows which screen to show.
  const failed = ready && signedIn && membership.isError;
  useEffect(() => {
    if (failed) SplashScreen.hideAsync();
  }, [failed]);

  if (!ready) return null;

  if (signedIn && membership.isError) {
    return (
      <View style={styles.error}>
        <Text variant="title">Couldn&apos;t load your pregnancy</Text>
        <Text muted>Check your connection and try again.</Text>
        <Button label="Try again" variant="dark" onPress={() => membership.refetch()} />
      </View>
    );
  }

  const hasPregnancy = !!membership.data;

  return (
    <VaultProvider pregnancyId={membership.data?.pregnancy.id} role={membership.data?.role}>
      <Background />
      <Routes signedIn={signedIn} hasPregnancy={hasPregnancy} />
      {signedIn && <AppLock />}
    </VaultProvider>
  );
}

/**
 * The screens each state may see. The pregnancy details live only in the
 * vault, so until this phone can read them (it needs the household key, and
 * the details record) the signed-in app shows the unlock screen.
 */
function Routes({ signedIn, hasPregnancy }: { signedIn: boolean; hasPregnancy: boolean }) {
  const { colors } = useTheme();
  // Inside the vault provider, so the vault's details are laid over the server row.
  const membership = useMembership();
  const vault = useVault();
  const unlocked = hasPregnancy && !!membership.data?.pregnancy.lmp_date;
  // Keep the splash up while the vault opens, rather than flash the unlock screen.
  const settling = hasPregnancy && !unlocked && (vault.state === 'loading' || vault.state === 'idle');

  useEffect(() => {
    if (!settling) SplashScreen.hideAsync();
  }, [settling]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !hasPregnancy}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && hasPregnancy && !unlocked}>
        <Stack.Screen name="unlock" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && unlocked}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="appointments" />
        <Stack.Screen name="mood" />
        <Stack.Screen name="contractions" />
        <Stack.Screen name="household-key" />
        <Stack.Screen name="connected-health" />
        <Stack.Screen name="week/[week]" />
        <Stack.Screen name="weeks" />
        <Stack.Screen name="dev/components" />
      </Stack.Protected>
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="privacy" />
    </Stack>
  );
}

/** Work that reads health data, so runs inside the vault: reminders, and the one-time copy of old data. */
function Background() {
  useReminders();
  useCopyOldData();
  return null;
}

const useStyles = makeStyles(({ colors }) => ({
  error: { flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: colors.ground },
}));
