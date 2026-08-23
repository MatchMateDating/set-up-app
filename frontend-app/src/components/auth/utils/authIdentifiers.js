/** Shared auth identifier helpers (email or US phone). */

export function phoneDigitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function isValidPhone(value) {
  return phoneDigitsOnly(value).length >= 10;
}

export function normalizeUsPhoneToE164(value) {
  let digits = phoneDigitsOnly(value);
  if (!digits) return null;
  if (!digits.startsWith('1') && digits.length === 10) {
    digits = `1${digits}`;
  }
  if (digits.length < 11) return null;
  return `+${digits}`;
}

export function getIdentifierKind(trimmed) {
  const value = String(trimmed || '').trim();
  if (!value) return null;
  if (isValidEmail(value)) return 'email';
  if (isValidPhone(value)) return 'phone';
  return null;
}

export const SIGNUP_DATA_KEY = 'signupData';
export const VERIFICATION_TOKEN_KEY = 'verificationToken';
