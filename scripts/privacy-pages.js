// Builds the public privacy policy and account-deletion pages in docs/ from
// src/content/privacy-policy.json, the same text the app shows on /privacy.
// Google Play links to both pages, and Health Connect needs the policy in the
// app and on the web to match, so edit the JSON and run:
//
//   node scripts/privacy-pages.js
//
// A test fails if the pages in docs/ are out of date with the JSON.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const policy = require('../src/content/privacy-policy.json');

const FALLBACK_CONTACT = 'the developer email address shown on Bloom’s Google Play page';

function escape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Fills {contact} in, as a mailto link when there is an address. */
function withContact(text, p) {
  const safe = escape(text);
  const contact = p.contactEmail
    ? `<a href="mailto:${escape(p.contactEmail)}">${escape(p.contactEmail)}</a>`
    : escape(FALLBACK_CONTACT);
  return safe.replace(/\{contact\}/g, contact);
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>
  :root { --ground: #F7F2FF; --ink: #1E1433; --muted: #5B4E73; --accent: #6B3FF0; }
  @media (prefers-color-scheme: dark) { :root { --ground: #15101F; --ink: #F3EDFF; --muted: #B9ADD1; --accent: #B79CFF; } }
  body { margin: 0; background: var(--ground); color: var(--ink); font: 17px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 680px; margin: 0 auto; padding: 32px 16px 64px; }
  h1 { font-size: 32px; line-height: 1.15; margin: 0 0 4px; }
  h2 { font-size: 20px; margin: 32px 0 8px; }
  .updated { color: var(--muted); margin: 0 0 24px; }
  a { color: var(--accent); }
  li { margin: 6px 0; }
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`;
}

function renderPrivacy(p = policy) {
  const parts = [`<h1>${escape(p.title)}</h1>`, `<p class="updated">Last updated ${escape(p.updated)}</p>`];
  for (const para of p.intro) parts.push(`<p>${withContact(para, p)}</p>`);
  for (const s of p.sections) {
    parts.push(`<h2>${escape(s.heading)}</h2>`);
    for (const para of s.paragraphs) parts.push(`<p>${withContact(para, p)}</p>`);
    if (s.bullets) parts.push(`<ul>\n${s.bullets.map((b) => `  <li>${withContact(b, p)}</li>`).join('\n')}\n</ul>`);
  }
  parts.push(`<p><a href="../delete-account/">Delete your account</a></p>`);
  return page(p.title, parts.join('\n'));
}

function renderDeletion(p = policy) {
  const parts = [`<h1>${escape(p.deletion.title)}</h1>`, `<p class="updated">Bloom · last updated ${escape(p.updated)}</p>`];
  for (const para of p.deletion.paragraphs) parts.push(`<p>${withContact(para, p)}</p>`);
  parts.push(`<p><a href="../privacy/">Bloom privacy policy</a></p>`);
  return page(p.deletion.title, parts.join('\n'));
}

function renderIndex() {
  return page(
    'Bloom',
    `<h1>Bloom</h1>
<p>A private pregnancy diary for your household.</p>
<p><a href="privacy/">Privacy policy</a> · <a href="delete-account/">Delete your account</a></p>`,
  );
}

const PAGES = {
  'docs/index.html': renderIndex,
  'docs/privacy/index.html': renderPrivacy,
  'docs/delete-account/index.html': renderDeletion,
};

if (require.main === module) {
  for (const [file, render] of Object.entries(PAGES)) {
    const out = path.join(ROOT, file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, render());
    console.log(`wrote ${file}`);
  }
}

module.exports = { PAGES, ROOT, FALLBACK_CONTACT };
