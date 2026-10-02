import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const redirects = read('lib/authRedirects.js');
const signIn = read('components/EmailSignInForm.js');
const runbook = read('SUPABASE_EMAIL_AUTH_LAUNCH_RUNBOOK.md');
const confirm = read('app/auth/confirm/page.js');
const verify = read('app/auth/confirm/verify/route.js');
const sessionSync = read('components/AuthSessionSync.js');
const signOut = read('components/SignOutButton.js');
const confirmation = read('components/AuthConfirmation.js');

assert.match(redirects, /export function buildEmailRedirectUrl/);
assert.match(redirects, /new URL\('\/auth\/confirm', origin\)/);
assert.match(redirects, /url\.searchParams\.set\('next', safeNext\)/);
assert.match(redirects, /'\/workspace'/);
assert.match(redirects, /export function optionalSafeAuthDestination/);
assert.doesNotMatch(signIn, /NEXT_PUBLIC_SITE_URL/);
assert.match(signIn, /verifyOtp\(\{email,token,type:'email'\}\)/);
assert.match(signIn, /window\.location\.replace\(next\)/);
assert.match(signIn, /shouldCreateUser:true/);
assert.match(confirm, /token_hash/);
assert.match(verify, /verifyOtp\(\{ token_hash: tokenHash, type \}\)/);
assert.match(runbook, /\{\{ \.Token \}\}/);
assert.match(runbook, /https:\/\/hub\.codepv\.org/);
assert.match(runbook, /retain `https:\/\/code-engineering-hub-staging\.vercel\.app\/auth\/confirm` as a fallback redirect/);
assert.match(runbook, /Do not include `\{\{ \.ConfirmationURL \}\}` or `\{\{ \.TokenHash \}\}` as the primary sign-in action/);
assert.match(confirmation, /retryDestination\s*=\s*optionalSafeAuthDestination\(next\)/);
assert.match(confirmation, /:\s*'\/auth\/signin'/);

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

console.log('Auth redirect checks passed: canonical confirmation path, safe next handling, token-hash verification, and template guidance.');
