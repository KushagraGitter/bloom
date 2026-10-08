import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { BackButton, Button, Card, QrCode, Screen, Text } from '@/components';
import { GetHouseholdKey } from '@/components/GetHouseholdKey';
import { QR_PREFIX } from '@/lib/vault/householdKey';
import { toRecoveryPhrase } from '@/lib/vault/keys';
import { useVault } from '@/lib/vault/VaultProvider';
import { makeStyles } from '@/theme/theme';

/**
 * The household key: health data is encrypted with it, and only phones that
 * have it can read what the other phone saved. A phone that has it shows it
 * (as a QR code for the partner's phone, or as the recovery phrase to keep
 * safe); a phone that doesn't is given it here.
 */
export default function HouseholdKeyScreen() {
  const styles = useStyles();
  const vault = useVault();

  return (
    <Screen>
      <BackButton label="Profile" onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} />
      <Text variant="screenTitle" accessibilityRole="header">
        Household key
      </Text>
      <Text muted>
        Your health records are encrypted on your phones with this key before anything is saved online. Bloom&apos;s server can&apos;t read
        them, and neither can anyone without the key.
      </Text>

      {vault.state === 'ready' && <ShowKey />}
      {vault.state === 'needs-key' && <GetHouseholdKey />}
      {vault.state === 'loading' && <Text muted>Checking this phone…</Text>}
      {vault.state === 'error' && (
        <Card size="card" style={styles.card}>
          <Text>Couldn&apos;t check for the key. Check your connection and try again.</Text>
          <Button label="Try again" variant="dark" onPress={vault.retry} />
        </Card>
      )}
      {vault.state === 'unsupported' && <Text muted>The household key lives in the phone app, not on the web.</Text>}
    </Screen>
  );
}

function ShowKey() {
  const styles = useStyles();
  const { householdKey } = useVault();
  const [showing, setShowing] = useState<'qr' | 'phrase' | null>(null);
  if (!householdKey) return null;
  const phrase = toRecoveryPhrase(householdKey);

  return (
    <>
      <Card size="card" style={styles.card}>
        <Text variant="label">Add another phone</Text>
        <Text variant="caption">
          On the other phone, open Bloom, go to Profile, then Household key, and scan this. Only show it in person.
        </Text>
        {showing === 'qr' ? (
          <View style={styles.qr}>
            <QrCode value={QR_PREFIX + phrase} size={240} accessibilityLabel="Household key QR code" />
            <Button label="Hide" onPress={() => setShowing(null)} />
          </View>
        ) : (
          <Button label="Show QR code" variant="dark" onPress={() => setShowing('qr')} />
        )}
      </Card>

      <Card size="card" style={styles.card}>
        <Text variant="label">Recovery phrase</Text>
        <Text variant="caption">
          If both phones are lost, this is the only way back into your records. Write it down or keep it in a password manager. Anyone who
          has it can read your records.
        </Text>
        {showing === 'phrase' ? (
          <>
            <Text style={styles.phrase} selectable accessibilityLabel={`Recovery phrase ${phrase.split('').join(' ')}`}>
              {phrase.replace(/-/g, ' ')}
            </Text>
            <Button label="Hide" onPress={() => setShowing(null)} />
          </>
        ) : (
          <Button label="Show recovery phrase" onPress={() => setShowing('phrase')} />
        )}
      </Card>
    </>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: { gap: 12 },
  qr: { alignItems: 'center', gap: 12 },
  phrase: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 18,
    lineHeight: 28,
    letterSpacing: 1,
    color: colors.ink,
  },
}));
