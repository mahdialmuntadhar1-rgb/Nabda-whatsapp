const IRAQ_MOBILE_REGEX = /^\+9647\d{9}$/;

export function normalizeIraqiPhone(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^\d+]/g, '');

  if (/^\+9647\d{9}$/.test(digits)) return digits;
  if (/^9647\d{9}$/.test(digits)) return `+${digits}`;
  if (/^07\d{9}$/.test(digits)) return `+964${digits.slice(1)}`;
  if (/^7\d{9}$/.test(digits)) return `+964${digits}`;

  return null;
}

export function isValidNormalizedPhone(phone: string): boolean {
  return IRAQ_MOBILE_REGEX.test(phone);
}

export function toNabdaPhone(phone: string): string {
  return phone.startsWith('+') ? phone.slice(1) : phone;
}
