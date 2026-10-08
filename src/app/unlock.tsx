import { useEffect, useRef } from 'react';

import { Button, Card, Screen, Text } from '@/components';
import { GetHouseholdKey } from '@/components/GetHouseholdKey';
import { signOut } from '@/lib/auth';
import { useVault } from '@/lib/vault/VaultProvider';
import { makeStyles } from '@/theme/theme';

/**
 * Shown instead of the app while this phone can't read the pregnancy details:
 * they live only in the vault, so a partner's phone or a new phone needs the
 * household key first. Once the details can be read, the root layout moves on
 * to the tabs by itself.
 */
export default function UnlockScreen() {
  const styles = useStyles();
  const vault = useVault();
  const requestSync = useRef(vault.sync?.requestSync);
  useEffect(() => {
    requestSync.current = vault.sync?.requestSync;
  });

  // The key is here but the details haven't arrived from the other phone yet.
  useEffect(() => {
    if (vault.state === 'ready') void requestSync.current?.();
  }, [vault.state]);

  return (
    <Screen>
      <Text variant="screenTitle" accessibilityRole="header">
        Open Bloom on this phone
      </Text>
      <Text muted>
        Your pregnancy details are encrypted with your household key, so only your phones can read them. This phone needs the key before it
        can show them.
      </Text>

      {vault.state === 'needs-key' && <GetHouseholdKey onUnlocked={() => {}} />}
      {(vault.state === 'loading' || vault.state === 'idle') && <Text muted>Checking this phone…</Text>}
      {vault.state === 'ready' && (
        <Card size="card" style={styles.card}>
          <Text>Getting your details from your other phone. Keep Bloom open on both phones with a connection.</Text>
          <Button label="Try again" variant="dark" onPress={() => void vault.sync?.requestSync()} />
        </Card>
      )}
      {vault.state === 'error' && (
        <Card size="card" style={styles.card}>
          <Text>Couldn&apos;t check for the key. Check your connection and try again.</Text>
          <Button label="Try again" variant="dark" onPress={vault.retry} />
        </Card>
      )}
      {vault.state === 'unsupported' && <Text muted>Your pregnancy details live in the phone app, not on the web.</Text>}
      <Button label="Sign out" onPress={() => signOut().catch(() => {})} style={styles.signOut} />
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  card: { gap: 12 },
  signOut: { marginTop: 8 },
}));
