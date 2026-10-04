import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';
import { useVault, type VaultState } from '@/lib/vault/VaultProvider';
import { colors } from '@/theme/tokens';

const MESSAGES: Partial<Record<VaultState, { title: string; body: string; action?: string }>> = {
  'needs-key': {
    title: 'This phone needs the household key',
    body: 'Health details are locked with a key that stays on your phones. Scan it from the other phone, or type the recovery phrase.',
    action: 'Add the key',
  },
  error: {
    title: 'Couldn’t open your health details',
    body: 'Check your connection, then try again.',
    action: 'Try again',
  },
  unsupported: {
    title: 'Health details stay on your phones',
    body: 'Open Bloom on your phone to see and log them.',
  },
};

/**
 * Says why health data isn't showing, when this phone can't open the vault,
 * or that it is offline when it can.
 */
export function VaultNotice() {
  const vault = useVault();
  const message = MESSAGES[vault.state];
  if (!message) return <OfflineNote />;
  return (
    <Card tone={colors.yellow} style={styles.card} accessibilityRole="summary">
      <Text variant="title">{message.title}</Text>
      <Text>{message.body}</Text>
      {message.action && (
        <Button
          label={message.action}
          variant="dark"
          onPress={() => (vault.state === 'error' ? vault.retry() : router.push('/household-key'))}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, marginBottom: 16 },
  offline: { marginBottom: 8 },
});

/** A quiet line while syncing fails: what she adds is safe on the phone and goes up later. */
export function OfflineNote() {
  const vault = useVault();
  if (vault.state !== 'ready' || !vault.sync?.error) return null;
  return (
    <Text muted accessibilityRole="alert" style={styles.offline}>
      Offline. What you add is saved on this phone and syncs when you&apos;re back online.
    </Text>
  );
}
