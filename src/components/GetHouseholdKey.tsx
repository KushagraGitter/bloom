import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { QR_PREFIX } from '@/lib/vault/householdKey';
import { fromRecoveryPhrase, RecoveryPhraseError } from '@/lib/vault/keys';
import { useVault } from '@/lib/vault/VaultProvider';
import { makeStyles } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';

/** Takes the household key on a phone that lacks it, by QR code or recovery phrase. */
export function GetHouseholdKey({ onUnlocked = () => router.back() }: { onUnlocked?: () => void }) {
  const styles = useStyles();
  const vault = useVault();
  const [mode, setMode] = useState<'choose' | 'scan' | 'type'>('choose');
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  const tryPhrase = async (text: string) => {
    setError(null);
    setBusy(true);
    try {
      const ok = await vault.adoptKey(fromRecoveryPhrase(text));
      if (ok) onUnlocked();
      else setError("That key is for a different household. Check you're scanning the right phone.");
    } catch (e) {
      setError(e instanceof RecoveryPhraseError ? e.message : 'Something went wrong. Check your connection and try again.');
    } finally {
      setBusy(false);
      handled.current = false;
    }
  };

  const onScan = ({ data }: { data: string }) => {
    if (handled.current || busy) return;
    if (!data.startsWith(QR_PREFIX)) {
      setError("That isn't a Bloom household code.");
      return;
    }
    handled.current = true;
    tryPhrase(data.slice(QR_PREFIX.length));
  };

  const intro =
    vault.role === 'partner'
      ? "This phone doesn't have the key yet. Get it from her phone: on her phone open Profile, Household key, Show QR code."
      : "This phone doesn't have the key yet, and your records are already saved with one. Scan it from your other phone or your partner's, or type your recovery phrase.";

  return (
    <Card size="card" style={styles.card}>
      <Text>{intro}</Text>

      {mode === 'scan' &&
        (permission?.granted ? (
          <View style={styles.camera}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={onScan}
            />
          </View>
        ) : permission && !permission.canAskAgain ? (
          <>
            <Text variant="caption">Camera access is off for Bloom. Turn it on in Settings, or type the recovery phrase instead.</Text>
            <Button label="Open Settings" onPress={() => Linking.openSettings()} />
          </>
        ) : (
          <Button label="Allow camera" variant="dark" onPress={() => requestPermission()} />
        ))}

      {mode === 'type' && (
        <>
          <TextField
            label="Recovery phrase"
            value={phrase}
            onChangeText={setPhrase}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="K1 ABCD EFGH …"
            multiline
            style={styles.phraseInput}
          />
          <Button
            label={busy ? 'Checking…' : 'Unlock'}
            variant="dark"
            disabled={busy || !phrase.trim()}
            onPress={() => tryPhrase(phrase)}
          />
        </>
      )}

      {mode !== 'scan' && (
        <Button label="Scan the QR code" variant={mode === 'choose' ? 'dark' : 'light'} onPress={() => setMode('scan')} />
      )}
      {mode !== 'type' && <Button label="Type the recovery phrase" onPress={() => setMode('type')} />}

      {busy && mode === 'scan' && <Text muted>Checking…</Text>}
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </Card>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: { gap: 12 },
  phraseInput: { height: 96, paddingTop: 12, textAlignVertical: 'top' },
  camera: {
    height: 280,
    borderRadius: radius.field,
    overflow: 'hidden',
    backgroundColor: colors.ink,
  },
  error: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.purpleDark },
}));
