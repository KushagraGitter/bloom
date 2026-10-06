import { router } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '@/components';
import { makeStyles } from '@/theme/theme';
import { fonts } from '@/theme/tokens';

export default function WelcomeScreen() {
  const styles = useStyles();
  const toSignIn = () => router.push('/sign-in');
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.art} accessible accessibilityLabel="Bloom">
        <View style={[styles.blob, styles.sun]} />
        <View style={[styles.blob, styles.pink]} />
        <View style={[styles.blob, styles.mint]} />
        <View style={[styles.blob, styles.purple]} />
        <Text style={styles.word}>Bloom</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} accessibilityRole="header">
          Your pregnancy, one happy little app.
        </Text>
        <Text muted style={styles.hint}>
          Track meals, vitamins, check-ins, reports and every week of the journey.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button label="Get started" variant="cta" onPress={toSignIn} />
        <Button label="I already have an account" onPress={toSignIn} style={styles.link} />
        <Text muted style={styles.privacy} accessibilityRole="link" onPress={() => router.push('/privacy')}>
          Privacy policy
        </Text>
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors, border }) => ({
  root: { flex: 1, backgroundColor: colors.ground, paddingHorizontal: 24, paddingBottom: 24, gap: 24 },
  art: { height: 340, marginTop: 24 },
  blob: { position: 'absolute', borderWidth: border.width, borderColor: border.color },
  sun: { left: 10, top: 20, width: 210, height: 210, borderRadius: 105, backgroundColor: colors.yellow },
  pink: { right: 0, top: 110, width: 160, height: 160, borderRadius: 80, backgroundColor: colors.pink },
  mint: {
    left: 70,
    bottom: 0,
    width: 130,
    height: 130,
    borderRadius: 40,
    backgroundColor: colors.mint,
    transform: [{ rotate: '-12deg' }],
  },
  purple: { right: 40, top: 10, width: 60, height: 60, borderRadius: 30, backgroundColor: colors.purple },
  word: { position: 'absolute', left: 36, top: 96, fontFamily: fonts.display, fontSize: 72, letterSpacing: -2.8, color: colors.onAccent },
  copy: { gap: 10 },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 37, letterSpacing: -0.7 },
  hint: { fontSize: 15, lineHeight: 21 },
  actions: { marginTop: 'auto', gap: 10 },
  link: { borderWidth: 0, backgroundColor: 'transparent' },
  privacy: { textAlign: 'center', fontSize: 14, textDecorationLine: 'underline' },
}));
