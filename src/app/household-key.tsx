import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { BackButton, Button, Card, QrCode, Screen, Text, TextField } from '@/components';
import { QR_PREFIX } from '@/lib/vault/householdKey';
import { fromRecoveryPhrase, RecoveryPhraseError, toRecoveryPhrase } from '@/lib/vault/keys';
import { useVault } from '@/lib/vault/VaultProvider';
import { makeStyles } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';

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
      {vault.state === 'needs-key' && <GetKey />}
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

function GetKey() {
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
      if (ok) router.back();
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
  qr: { alignItems: 'center', gap: 12 },
  phrase: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 18,
    lineHeight: 28,
    letterSpacing: 1,
    color: colors.ink,
  },
  phraseInput: { height: 96, paddingTop: 12, textAlignVertical: 'top' },
  camera: {
    height: 280,
    borderRadius: radius.field,
    overflow: 'hidden',
    backgroundColor: colors.ink,
  },
  error: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.purpleDark },
}));
