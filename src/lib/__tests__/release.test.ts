import { contactText, PRIVACY_POLICY, type PrivacyPolicy } from '@/lib/privacyPolicy';

// No Node types in this project, so the two Node modules are typed here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs') as { readFileSync: (file: string, encoding: 'utf8') => string };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path') as { join: (...parts: string[]) => string };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pages = require('../../../scripts/privacy-pages.js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { addPrivacyLink } = require('../../../plugins/withHealthConnectPrivacyLink.js');

describe('privacy pages', () => {
  it('match the policy text the app shows (run node scripts/privacy-pages.js after editing it)', () => {
    for (const [file, render] of Object.entries(pages.PAGES) as [string, () => string][]) {
      expect(fs.readFileSync(path.join(pages.ROOT, file), 'utf8')).toBe(render());
    }
  });

  it('point at the Play listing until there is a support address', () => {
    const noEmail: PrivacyPolicy = { ...PRIVACY_POLICY, contactEmail: null };
    expect(contactText('write to {contact}.', noEmail)).toBe(`write to ${pages.FALLBACK_CONTACT}.`);
    const withEmail: PrivacyPolicy = { ...PRIVACY_POLICY, contactEmail: 'help@example.com' };
    expect(contactText('write to {contact}.', withEmail)).toBe('write to help@example.com.');
  });
});

describe('Health Connect privacy link plugin', () => {
  const template = fs.readFileSync(path.join(pages.ROOT, 'src/lib/__tests__/fixtures/MainActivity.kt.txt'), 'utf8');

  it('rewrites Health Connect intents before the activity starts and on new intents', () => {
    const out = addPrivacyLink(template);
    expect(out).toMatch(/override fun onCreate\(savedInstanceState: Bundle\?\) \{\n {4}showPrivacyForHealthConnect\(intent\)\n/);
    expect(out).toContain('override fun onNewIntent(intent: android.content.Intent)');
    expect(out).toContain('"bloom://privacy"');
    expect(out).toContain('androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE');
    expect(out).toContain('android.intent.action.VIEW_PERMISSION_USAGE');
  });

  it('runs once', () => {
    const once = addPrivacyLink(template);
    expect(addPrivacyLink(once)).toBe(once);
  });

  it('fails loudly if the template changes shape', () => {
    expect(() => addPrivacyLink('class Other {}')).toThrow(/onCreate not found/);
  });
});
