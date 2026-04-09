import { readFileSync } from 'node:fs';
import type { Recipient } from './types.js';

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

export async function loadRecipientsFromCsv(path: string): Promise<Recipient[]> {
  const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new Error('CSV has no rows.');

  const headers = splitCsvLine(lines[0]).map((value) => value.trim());
  if (!headers.includes('phone')) throw new Error('CSV must include a phone column.');

  const recipients: Recipient[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = (cols[idx] ?? '').trim();
    });
    recipients.push(record as Recipient);
  }

  return recipients;
}

export function parseOptIn(value: string | boolean | undefined): boolean {
  if (typeof value === 'boolean') return value;
  if (!value) return false;
  const lowered = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y'].includes(lowered);
}
