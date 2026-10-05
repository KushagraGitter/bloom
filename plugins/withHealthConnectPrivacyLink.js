// When someone taps "privacy policy" in Health Connect's permission screen,
// Android opens Bloom's main activity with a Health Connect action instead of
// a link. React Native only reports links that arrive as ACTION_VIEW, so the
// app would open on its home screen. This rewrites those intents into a
// bloom://privacy link, which Expo Router opens on the privacy policy screen.
//
// react-native-health-connect's own plugin adds the intent filter (Android 13
// and older) and the activity alias (Android 14 and newer) that bring the
// intent here.

const { createRunOncePlugin, withMainActivity } = require('@expo/config-plugins');

const MARKER = 'showPrivacyForHealthConnect';

const HELPER = `
  override fun onNewIntent(intent: android.content.Intent) {
    ${MARKER}(intent)
    super.onNewIntent(intent)
  }

  // Health Connect's privacy policy link arrives as its own action; turn it into bloom://privacy.
  private fun ${MARKER}(intent: android.content.Intent?) {
    if (intent == null) return
    val action = intent.action
    if (action == "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" ||
        action == "android.intent.action.VIEW_PERMISSION_USAGE") {
      intent.action = android.content.Intent.ACTION_VIEW
      intent.data = android.net.Uri.parse("bloom://privacy")
    }
  }
`;

function addPrivacyLink(src) {
  if (src.includes(MARKER)) return src;
  const onCreate = /(override fun onCreate\(savedInstanceState: Bundle\?\) \{\n)/;
  if (!onCreate.test(src)) throw new Error('withHealthConnectPrivacyLink: onCreate not found in MainActivity.kt');
  const withCall = src.replace(onCreate, `$1    ${MARKER}(intent)\n`);
  const classOpen = /(class MainActivity : ReactActivity\(\) \{\n)/;
  if (!classOpen.test(withCall)) throw new Error('withHealthConnectPrivacyLink: MainActivity class not found');
  return withCall.replace(classOpen, `$1${HELPER}\n`);
}

const withHealthConnectPrivacyLink = (config) =>
  withMainActivity(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error('withHealthConnectPrivacyLink: expected a Kotlin MainActivity');
    }
    config.modResults.contents = addPrivacyLink(config.modResults.contents);
    return config;
  });

module.exports = createRunOncePlugin(withHealthConnectPrivacyLink, 'with-health-connect-privacy-link', '1.0.0');
module.exports.addPrivacyLink = addPrivacyLink;
