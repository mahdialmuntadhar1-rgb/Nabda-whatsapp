import type { Recipient } from './types.js';

export function renderTemplate(template: string, recipient: Recipient, normalizedPhone: string): string {
  const mapping: Record<string, string> = {
    name: recipient.name ?? '',
    governorate: recipient.governorate ?? '',
    category: recipient.category ?? '',
    phone: normalizedPhone,
    '1': recipient.name ?? '',
    '2': recipient.governorate ?? '',
    '3': recipient.category ?? '',
    '4': normalizedPhone,
  };

  return template.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, key: string) => mapping[key] ?? '');
}
