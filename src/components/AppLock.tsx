import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { LockIcon } from '@/components/icons';
import { Text } from '@/components/Text';
import { LOCK_AFTER_MS, authenticate, useAppLock } from '@/lib/appLock';
import { border, colors, fonts } from '@/theme/tokens';

/**
 * Covers the app while it is locked. It reads the setting on start (covering
 * the app until it knows), locks again when Bloom comes back after a minute
 * in the background, and asks for Face ID, a fingerprint or the passcode.
 */
export function AppLock() {
  const { enabled, locked, load, lock, unlock } = useAppLock();
  const [failed, setFailed] = useState(false);
  const asking = useRef(false);
  const leftAt = useRef<number | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') leftAt.current = Date.now();
      if (state === 'active' && leftAt.current !== null) {
        if (Date.now() - leftAt.current >= LOCK_AFTER_MS) lock();
        leftAt.current = null;
      }
    });
    return () => sub.remove();
  }, [lock]);

  const ask = async () => {
    if (asking.current) return;
    asking.current = true;
    const ok = await authenticate('Unlock Bloom');
    asking.current = false;
    setFailed(!ok);
    if (ok) unlock();
  };

  // Asks straight away each time it locks.
  useEffect(() => {
    if (locked) ask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  if (enabled === null) return <View style={styles.cover} testID="app-lock-loading" />;
  if (!locked) return null;

  return (
    <View style={[styles.cover, styles.center]} accessibilityViewIsModal>
      <View style={styles.badge}>
        <LockIcon size={36} />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        Bloom is locked
      </Text>
      <Text muted style={styles.sub}>
        {failed ? 'That didn’t work. Try again when you’re ready.' : 'Unlock with Face ID, your fingerprint or your passcode.'}
      </Text>
      <Button label="Unlock" variant="dark" onPress={ask} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.ground, zIndex: 100 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 28,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  sub: { textAlign: 'center' },
  button: { alignSelf: 'stretch' },
});
