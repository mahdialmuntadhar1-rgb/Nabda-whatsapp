/**
 * Phone normalization for Iraq (+964)
 * Accept formats:
 * 07xxxxxxxxx
 * 7xxxxxxxxx
 * +9647xxxxxxxxx
 * 9647xxxxxxxxx
 * Convert ALL to: +9647XXXXXXXXX
 */
export function normalizeIraqiPhone(phone: string): string | null {
  // Remove all non-numeric characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // If it starts with +, keep it and check length
  if (cleaned.startsWith('+')) {
    if (cleaned.startsWith('+9647') && cleaned.length === 14) {
      return cleaned;
    }
    // Try to fix if it's +96407...
    if (cleaned.startsWith('+96407') && cleaned.length === 15) {
      return '+9647' + cleaned.substring(6);
    }
    return null;
  }

  // Handle 07...
  if (cleaned.startsWith('07') && cleaned.length === 11) {
    return '+964' + cleaned.substring(1);
  }

  // Handle 7...
  if (cleaned.startsWith('7') && cleaned.length === 10) {
    return '+964' + cleaned;
  }

  // Handle 9647...
  if (cleaned.startsWith('9647') && cleaned.length === 13) {
    return '+' + cleaned;
  }

  // Handle 96407...
  if (cleaned.startsWith('96407') && cleaned.length === 14) {
    return '+9647' + cleaned.substring(5);
  }

  return null;
}

export function validatePhone(phone: string): boolean {
  return normalizeIraqiPhone(phone) !== null;
}
