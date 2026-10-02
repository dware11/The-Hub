import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const errors = read('lib/authErrors.js');
const signIn = read('components/EmailSignInForm.js');

assert.match(errors, /getAuthEmailErrorMessage/);
assert.match(errors, /getAuthOtpErrorMessage/);
assert.match(errors, /details\.status === 429/);
assert.match(errors, /Too many sign-in codes were requested\. Please wait before requesting another/);
assert.match(errors, /A sign-in code was recently sent/);
assert.match(errors, /Enter a valid email address/);
assert.match(errors, /couldn't send the sign-in code/);
assert.match(errors, /requestMs/);
assert.match(errors, /redacted-email/);
assert.match(errors, /NODE_ENV === 'production'/);
assert.match(signIn, /try \{/);
assert.match(signIn, /logAuthEmailError\(error, requestMs\)/);
assert.match(signIn, /logAuthOtpError\(error,requestMs\)/);
assert.match(signIn, /verifyOtp\(\{email,token,type:'email'\}\)/);
assert.match(signIn, /finally \{/);
assert.doesNotMatch(signIn, /verify address and try again/);

console.log('Auth email error checks passed: user-safe mapping, request timing, redacted development diagnostics, and thrown-error handling.');
