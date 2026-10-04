import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { OfflineNote } from '@/components/VaultNotice';
import { useVault } from '@/lib/vault/VaultProvider';

/**
 * Shows its children once this phone has the household key and its records
 * open. Until then it says why not, and what to do about it. `what` finishes
 * the sentences: "Your meals are encrypted…".
 */
export function VaultGate({ what, children }: { what: string; children: ReactNode }) {
  const vault = useVault();

  switch (vault.state) {
    case 'ready':
      return (
        <>
          <OfflineNote />
          {children}
        </>
      );
    case 'needs-key':
      return (
        <Card size="card" style={styles.card}>
          <Text variant="label">This phone needs the household key</Text>
          <Text muted>
            Your {what} are encrypted on your phones. Add the household key here, from her phone or with the recovery phrase, and they
            appear.
          </Text>
          <Button label="Add the household key" variant="dark" onPress={() => router.push('/household-key')} />
        </Card>
      );
    case 'error':
      return (
        <Card size="card" style={styles.card}>
          <Text accessibilityRole="alert">Couldn&apos;t open your {what}. Check your connection and try again.</Text>
          <Button label="Try again" variant="dark" onPress={vault.retry} />
        </Card>
      );
    case 'unsupported':
      return <Text muted>Your {what} are kept on your phones, so they only show in the phone app.</Text>;
    default:
      return <Text muted>Opening your {what}…</Text>;
  }
}

const styles = StyleSheet.create({
  card: { gap: 10 },
});
