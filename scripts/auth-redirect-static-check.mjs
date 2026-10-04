import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const redirects = read('lib/authRedirects.js');
const signIn = read('components/EmailSignInForm.js');
const runbook = read('SUPABASE_EMAIL_AUTH_LAUNCH_RUNBOOK.md');
const confirm = read('app/auth/confirm/page.js');
const sessionSync = read('components/AuthSessionSync.js');
const signOut = read('components/SignOutButton.js');
const submissionGate = read('components/SubmissionGate.js');
const adminLayout = read('app/admin/layout.js');
const protectedPages = [
  read('app/admin/page.js'),
  read('app/admin/review/page.js'),
  read('app/admin/analytics/page.js'),
  read('app/admin/review/[type]/[id]/page.js'),
];

assert.match(redirects, /'\/workspace'/);
assert.match(redirects, /'\/panther-submit\/submissions'/);
assert.match(redirects, /export function optionalSafeAuthDestination/);
assert.doesNotMatch(signIn, /NEXT_PUBLIC_SITE_URL/);
assert.match(signIn, /verifyOtp\(\{email,token,type:'email'\}\)/);
assert.match(signIn, /window\.location\.replace\(next\)/);
assert.match(signIn, /shouldCreateUser:true/);
assert.match(confirm, /redirect\(signInUrl\)/);
assert.doesNotMatch(confirm, /token_hash|AuthConfirmation|Magic link/i);
assert.match(runbook, /\{\{ \.Token \}\}/);
assert.match(runbook, /https:\/\/hub\.codepv\.org/);
assert.match(runbook, /retain `https:\/\/code-engineering-hub-staging\.vercel\.app\/auth\/confirm` as a fallback redirect/);
assert.match(runbook, /Do not include `\{\{ \.ConfirmationURL \}\}` or `\{\{ \.TokenHash \}\}` as the primary sign-in action/);
assert.match(submissionGate, /redirect\(`\/auth\/signin\?next=/);
assert.doesNotMatch(submissionGate, /passwordless email link|SignInButton/i);
assert.match(adminLayout, /if \(!viewer\.user\) redirect\('\/auth\/signin\?next=%2Fworkspace'\)/);
assert.match(adminLayout, /if \(!canReview\(viewer\)\) redirect\('\/workspace'\)/);
for (const page of protectedPages) {
  assert.doesNotMatch(page, /<h1[^>]*>\s*(?:Sign in|Reviewer|Workspace) access required|<h1[^>]*>\s*Sign in required/i);
  assert.match(page, /redirect\(/);
}

const executableRedirects = redirects
  .replaceAll('export function ', 'function ')
  .replace(/export \{[^}]+\};?/g, '');
const helpers = new Function(`${executableRedirects}\nreturn { safeAuthDestination, optionalSafeAuthDestination };`)();
assert.equal(helpers.optionalSafeAuthDestination('/workspace'), '/workspace');
assert.equal(helpers.optionalSafeAuthDestination(undefined), '');
assert.equal(helpers.optionalSafeAuthDestination(''), '');
assert.equal(helpers.optionalSafeAuthDestination('https://evil.example/workspace'), '');
assert.equal(helpers.optionalSafeAuthDestination('javascript:alert(1)'), '');
assert.equal(helpers.optionalSafeAuthDestination('https://hub.codepv.org/auth/confirm?next=%2Fworkspace'), '/workspace');
assert.equal(helpers.optionalSafeAuthDestination('https://code-engineering-hub-staging.vercel.app/auth/confirm?next=%2Fworkspace'), '/workspace');
assert.equal(helpers.safeAuthDestination(undefined), '/submit');
assert.match(sessionSync, /onAuthStateChange/);
assert.match(sessionSync, /visibilitychange/);
assert.match(sessionSync, /BroadcastChannel\('code-hub-auth'\)/);
assert.match(signOut, /code-hub-signed-out/);
assert.match(signOut, /window\.location\.replace\('\/'\)/);

console.log('Auth redirect checks passed: current OTP routes, safe next handling, clean legacy callback redirect, protected workspace gating, and no transient legacy access UI.');
