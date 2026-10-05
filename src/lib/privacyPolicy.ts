import policy from '@/content/privacy-policy.json';

export type PrivacyPolicy = {
  title: string;
  updated: string;
  contactEmail: string | null;
  intro: string[];
  sections: { heading: string; paragraphs: string[]; bullets?: string[] }[];
  deletion: { title: string; paragraphs: string[] };
};

export const PRIVACY_POLICY: PrivacyPolicy = policy;

/** Where scripts/privacy-pages.js publishes the policy (GitHub Pages from docs/). */
export const PRIVACY_POLICY_URL = 'https://kushagragitter.github.io/bloom/privacy/';

/** Kept in step with FALLBACK_CONTACT in scripts/privacy-pages.js. */
const FALLBACK_CONTACT = 'the developer email address shown on Bloom’s Google Play page';

/** Fills {contact} in with the support address, or where to find it. */
export function contactText(text: string, p: PrivacyPolicy = PRIVACY_POLICY): string {
  return text.replace(/\{contact\}/g, p.contactEmail ?? FALLBACK_CONTACT);
}
