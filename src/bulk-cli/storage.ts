import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { appendFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import type { SendLogEntry } from './types.js';

export async function appendLog(logPath: string, entry: SendLogEntry): Promise<void> {
  await appendFile(logPath, `${JSON.stringify(entry)}\n`, 'utf8');
}

export async function loadSentPhones(logPath: string): Promise<Set<string>> {
  const sent = new Set<string>();
  if (!existsSync(logPath)) return sent;

  const stream = createReadStream(logPath, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as SendLogEntry;
      if (parsed.status === 'sent' && parsed.phone_sent) sent.add(parsed.phone_sent);
    } catch {
      // ignore malformed rows
    }
  }

  return sent;
}

export function loadOptOuts(optOutPath: string): Set<string> {
  if (!existsSync(optOutPath)) return new Set<string>();
  try {
    const data = JSON.parse(readFileSync(optOutPath, 'utf8'));
    if (!Array.isArray(data)) return new Set<string>();
    return new Set<string>(data.filter((value) => typeof value === 'string'));
  } catch {
    return new Set<string>();
  }
}

export async function saveOptOuts(optOutPath: string, values: Set<string>): Promise<void> {
  const sorted = Array.from(values).sort();
  await writeFile(optOutPath, JSON.stringify(sorted, null, 2), 'utf8');
}
