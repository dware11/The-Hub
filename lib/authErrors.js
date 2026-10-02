function text(value) {
  return typeof value === 'string' ? value : '';
}

function safeDescription(value) {
  return text(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\b(?:token|otp|secret|authorization)\s*[:=]\s*\S+/gi, '[redacted-auth-value]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

export function getAuthErrorDetails(error, requestMs) {
  const statusValue = Number(error?.status ?? error?.statusCode);
  return {
    status: Number.isFinite(statusValue) ? statusValue : undefined,
    code: text(error?.code || error?.name).slice(0, 100) || 'unknown',
    description: safeDescription(error?.message) || 'unknown',
    requestMs: Number.isFinite(requestMs) ? Math.max(0, Math.round(requestMs)) : undefined,
  };
}

export function getAuthEmailErrorMessage(error) {
  const details = getAuthErrorDetails(error);
  const corpus = (details.code + ' ' + details.description).toLowerCase();

  if (
    /security purposes.{0,60}(second|minute|wait)/.test(corpus) ||
    /(?:already|recent|last).{0,30}(sent|requested|link)/.test(corpus) ||
    /cooldown/.test(corpus)
  ) {
    return 'A sign-in code was recently sent. Check your inbox or wait before requesting another.';
  }

  if (
    details.status === 429 ||
    /(?:rate.?limit|too many|quota|over_email_send_rate_limit|email_send_rate_limit)/.test(corpus)
  ) {
    return 'Too many sign-in codes were requested. Please wait before requesting another. If you recently requested one, check your inbox first.';
  }

  if (/invalid[ _-]?email|email.{0,20}invalid|validation/.test(corpus)) {
    return 'Enter a valid email address.';
  }

  return "We couldn't send the sign-in code right now. Please try again shortly.";
}

export function getAuthOtpErrorMessage(error) {
  const details = getAuthErrorDetails(error);
  const corpus = (details.code + ' ' + details.description).toLowerCase();

  if (details.status === 429 || /rate.?limit|too many/.test(corpus)) {
    return 'Too many verification attempts were made. Please wait and try again.';
  }
  if (/expired/.test(corpus)) {
    return 'That code has expired. Request a new one.';
  }
  if (/already.{0,20}(used|consumed)|used.{0,20}token/.test(corpus)) {
    return 'That code has already been used. Request a new one.';
  }
  if (/invalid|token|otp|code/.test(corpus) && !/service|network|fetch/.test(corpus)) {
    return 'That code is incorrect. Check the email and try again.';
  }
  return "We couldn't verify your code right now. Please try again.";
}

export function logAuthEmailError(error, requestMs) {
  if (process.env.NODE_ENV === 'production') return;
  console.warn('[auth-email] signInWithOtp failed', getAuthErrorDetails(error, requestMs));
}

export function logAuthOtpError(error, requestMs) {
  if (process.env.NODE_ENV === 'production') return;
  console.warn('[auth-email] verifyOtp failed', getAuthErrorDetails(error, requestMs));
}
