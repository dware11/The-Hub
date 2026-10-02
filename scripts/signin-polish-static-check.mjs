import fs from 'node:fs';

const root = process.cwd();
const read = (file) => fs.readFileSync(`${root}/${file}`, 'utf8');
const page = read('app/auth/signin/page.js');
const form = read('components/EmailSignInForm.js');
const nav = read('components/Nav.js');
const button = read('components/SignInButton.js');
const home = read('app/page.js');
const css = read('app/globals.css');
const errors = read('lib/authErrors.js');

const checks = [
  [page.includes('auth-page-shell') && page.includes('auth-card'), 'centered branded auth card'],
  [page.includes('We’ll email you a secure 6-digit sign-in code. No password needed.'), 'one-time code guidance'],
  [page.includes('After verification, you’ll continue to the page you originally requested.'), 'destination guidance'],
  [page.includes('Delivery may take up to 3 minutes. Please wait before requesting another code.'), 'PVAMU delivery-delay guidance'],
  [form.includes('PVAMU inboxes may take up to 3 minutes') && form.includes('Enter your sign-in code') && form.includes('Change email'), 'verification state, PVAMU delay guidance, and change-email action'],
  [form.includes('Resend code') && form.includes('cooldownSeconds'), 'cooldown-aware resend'],
  [errors.includes('Too many sign-in codes were requested. Please wait before requesting another.'), 'exact rate-limit UX copy'],
  [nav.includes('next="/workspace"') && !nav.includes('nav-workspace-link'), 'signed-out sign-in action without duplicate Workspace pill'],
  [button.includes('<span>Sign in</span>') && button.includes("next = '/workspace'") && !button.includes('Sign in with email'), 'compact sign-in label'],
  [home.includes('Submit to the Hub') && !home.includes('Sign in'), 'home has task CTA without duplicate sign-in CTA'],
  [css.includes('.nav-sign-in-button') && css.includes('.auth-card') && css.includes('.auth-sent-state'), 'auth presentation styles'],
  [css.includes('@media(max-width:500px)'), 'mobile auth styles'],
];

const failures = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failures.length) {
  console.error(`Sign-in polish static check failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log(`Sign-in polish static check passed (${checks.length} assertions).`);
