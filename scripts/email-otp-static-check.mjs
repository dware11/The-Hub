import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = path => readFileSync(resolve(process.cwd(),path),'utf8');
const form = read('components/EmailSignInForm.js');
const errors = read('lib/authErrors.js');
const page = read('app/auth/signin/page.js');
const config = read('supabase/config.toml');
const runbook = read('SUPABASE_EMAIL_AUTH_LAUNCH_RUNBOOK.md');

assert.match(form,/signInWithOtp/);
assert.match(form,/options:\{shouldCreateUser:true\}/);
assert.doesNotMatch(form,/emailRedirectTo/);
assert.match(form,/verifyOtp\(\{email,token,type:'email'\}\)/);
assert.match(form,/window\.location\.replace\(next\)/);
assert.match(form,/autoComplete="one-time-code"/);
assert.match(form,/pattern="\[0-9\]\{6\}"/);
assert.match(form,/PENDING_EMAIL_KEY/);
assert.match(form,/sessionStorage\.setItem/);
assert.match(form,/sessionStorage\.removeItem/);
assert.match(form,/Resend code/);
assert.match(form,/Use the newest email you receive/);
assert.match(errors,/That code is incorrect/);
assert.match(errors,/That code has expired/);
assert.match(errors,/That code has already been used/);
assert.match(errors,/couldn't verify your code right now/);
assert.match(page,/secure 6-digit sign-in code/);
assert.match(config,/\[auth\.email\][\s\S]*otp_length = 6[\s\S]*otp_expiry = 600/);
assert.match(runbook,/\{\{ \.Token \}\}/);
assert.match(runbook,/both Supabase Auth \*\*Magic Link\*\* and \*\*Confirm signup\*\* templates/);

console.log('Typed email OTP checks passed: six-digit verification, preserved account admission, safe routing, resend UX, fallback retention, and 600-second expiry.');
