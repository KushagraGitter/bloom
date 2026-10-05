import { router } from 'expo-router';
import { Linking, View } from 'react-native';

import { BackButton, Screen, Text } from '@/components';
import { contactText, PRIVACY_POLICY, PRIVACY_POLICY_URL } from '@/lib/privacyPolicy';
import { makeStyles } from '@/theme/theme';

/**
 * The privacy policy, the same text as the web page Google Play links to.
 * Reachable signed in or out: Profile and the welcome screen link here, and
 * Health Connect's "privacy policy" link opens it as bloom://privacy.
 */
export default function PrivacyScreen() {
  const styles = useStyles();
  const p = PRIVACY_POLICY;
  return (
    <Screen>
      <BackButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <Text variant="screenTitle" accessibilityRole="header">
        Privacy
      </Text>
      <Text muted>Last updated {p.updated}</Text>
      {p.intro.map((para) => (
        <Text key={para} style={styles.para}>
          {contactText(para)}
        </Text>
      ))}
      {p.sections.map((s) => (
        <View key={s.heading} style={styles.section}>
          <Text variant="title" accessibilityRole="header">
            {s.heading}
          </Text>
          {s.paragraphs.map((para) => (
            <Text key={para} style={styles.para}>
              {contactText(para)}
            </Text>
          ))}
          {s.bullets?.map((b) => (
            <Text key={b} style={styles.para}>
              {'•  '}
              {contactText(b)}
            </Text>
          ))}
        </View>
      ))}
      <Text style={styles.link} accessibilityRole="link" onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}>
        Read this on the web
      </Text>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  section: { gap: 8, marginTop: 8 },
  para: { fontSize: 15, lineHeight: 22 },
  link: { fontSize: 15, color: colors.purple, textDecorationLine: 'underline', marginTop: 8, marginBottom: 24 },
}));
