import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import dotenv from 'dotenv';
import { loadRecipientsFromCsv, parseOptIn } from './csv.js';
import { sendMessage } from './nabda.js';
import { isValidNormalizedPhone, normalizeIraqiPhone, toNabdaPhone } from './phone.js';
import { appendLog, loadOptOuts, loadSentPhones, saveOptOuts } from './storage.js';
import { renderTemplate } from './template.js';
import type { SendLogEntry } from './types.js';

dotenv.config();

const DEFAULT_LOG_PATH = './send-log.jsonl';
const DEFAULT_OPTOUT_PATH = './opt-outs.json';

type Args = Record<string, string | boolean>;

function parseArgs(input: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < input.length; i += 1) {
    const arg = input[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = input[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function getString(args: Args, key: string, required = false, defaultValue?: string): string {
  const value = args[key];
  if (typeof value === 'string') return value;
  if (defaultValue !== undefined) return defaultValue;
  if (required) throw new Error(`Missing required option --${key}`);
  return '';
}

function getNumber(args: Args, key: string, defaultValue: number): number {
  const value = args[key];
  if (typeof value !== 'string') return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function getBool(args: Args, key: string): boolean {
  return args[key] === true;
}

function chunk<T>(items: T[], size: number): T[][] {
  const list: T[][] = [];
  for (let i = 0; i < items.length; i += size) list.push(items.slice(i, i + size));
  return list;
}

async function runWithConcurrency<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      await fn(items[current]);
    }
  });
  await Promise.all(workers);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureEnv(): { baseUrl: string; instanceId: string; token: string } {
  const instanceId = process.env.NABDA_INSTANCE_ID;
  const token = process.env.NABDA_API_TOKEN;
  const baseUrl = process.env.NABDA_API_URL ?? 'https://api.nabdaotp.com';

  if (!instanceId) throw new Error('Missing NABDA_INSTANCE_ID environment variable.');
  if (!token) throw new Error('Missing NABDA_API_TOKEN environment variable.');

  return { baseUrl, instanceId, token };
}

function buildLogEntry(entry: Partial<SendLogEntry>): SendLogEntry {
  return {
    timestamp: new Date().toISOString(),
    phone_input: entry.phone_input ?? '',
    phone_normalized: entry.phone_normalized ?? null,
    phone_sent: entry.phone_sent ?? null,
    template_id_or_hash: entry.template_id_or_hash ?? '',
    message_preview: entry.message_preview ?? '',
    status: entry.status ?? 'failed',
    http_status: entry.http_status ?? null,
    message_id: entry.message_id ?? null,
    error: entry.error ?? null,
  };
}

async function runSend(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const csvPath = getString(args, 'csv', true);
  const templatePath = getString(args, 'template', true);
  const logPath = getString(args, 'log', false, DEFAULT_LOG_PATH);
  const optOutPath = getString(args, 'optout-store', false, DEFAULT_OPTOUT_PATH);
  const dryRun = getBool(args, 'dry-run');
  const resume = getBool(args, 'resume');

  const limitRaw = getString(args, 'limit');
  const limit = limitRaw ? Number(limitRaw) : undefined;
  const concurrency = getNumber(args, 'concurrency', 1);
  const batchSize = getNumber(args, 'batch-size', 10);
  const batchDelayMs = getNumber(args, 'batch-delay-ms', 2000);

  if (!existsSync(csvPath)) throw new Error(`CSV file not found: ${csvPath}`);
  if (!existsSync(templatePath)) throw new Error(`Template file not found: ${templatePath}`);

  const template = readFileSync(templatePath, 'utf8');
  const templateHash = createHash('sha256').update(template).digest('hex').slice(0, 12);
  const recipients = await loadRecipientsFromCsv(csvPath);
  const limitedRecipients = Number.isFinite(limit) ? recipients.slice(0, limit) : recipients;

  const optOuts = loadOptOuts(optOutPath);
  const sentAlready = resume ? await loadSentPhones(logPath) : new Set<string>();

  const counters: Record<string, number> = {
    total: limitedRecipients.length,
    sent: 0,
    failed: 0,
    skipped_optout: 0,
    skipped_no_optin: 0,
    skipped_invalid_phone: 0,
    skipped_resume: 0,
  };

  const samples: string[] = [];

  const processRecipient = async (recipient: Awaited<typeof limitedRecipients>[number]): Promise<void> => {
    const normalized = normalizeIraqiPhone(recipient.phone);

    if (!normalized || !isValidNormalizedPhone(normalized)) {
      counters.skipped_invalid_phone += 1;
      await appendLog(
        logPath,
        buildLogEntry({
          phone_input: recipient.phone,
          template_id_or_hash: templateHash,
          status: 'skipped_invalid_phone',
          error: 'Invalid Iraqi phone format',
        }),
      );
      return;
    }

    if (!parseOptIn(recipient.opt_in)) {
      counters.skipped_no_optin += 1;
      await appendLog(
        logPath,
        buildLogEntry({
          phone_input: recipient.phone,
          phone_normalized: normalized,
          template_id_or_hash: templateHash,
          status: 'skipped_no_optin',
          error: 'Missing opt-in consent',
        }),
      );
      return;
    }

    const phoneSent = toNabdaPhone(normalized);

    if (optOuts.has(phoneSent)) {
      counters.skipped_optout += 1;
      await appendLog(
        logPath,
        buildLogEntry({
          phone_input: recipient.phone,
          phone_normalized: normalized,
          phone_sent: phoneSent,
          template_id_or_hash: templateHash,
          status: 'skipped_optout',
          error: 'Recipient opted out previously',
        }),
      );
      return;
    }

    if (resume && sentAlready.has(phoneSent)) {
      counters.skipped_resume += 1;
      await appendLog(
        logPath,
        buildLogEntry({
          phone_input: recipient.phone,
          phone_normalized: normalized,
          phone_sent: phoneSent,
          template_id_or_hash: templateHash,
          status: 'skipped_resume',
          error: 'Already sent (resume mode)',
        }),
      );
      return;
    }

    const message = renderTemplate(template, recipient, normalized);
    if (samples.length < 3) samples.push(`${normalized} => ${message.slice(0, 140)}`);

    if (dryRun) return;

    const env = ensureEnv();
    const result = await sendMessage(env, phoneSent, message);

    if (result.success) counters.sent += 1;
    else counters.failed += 1;

    await appendLog(
      logPath,
      buildLogEntry({
        phone_input: recipient.phone,
        phone_normalized: normalized,
        phone_sent: phoneSent,
        template_id_or_hash: templateHash,
        message_preview: message.slice(0, 80),
        status: result.status,
        http_status: result.httpStatus,
        message_id: result.messageId,
        error: result.error,
      }),
    );
  };

  const batches = chunk(limitedRecipients, Math.max(1, batchSize));
  for (let idx = 0; idx < batches.length; idx += 1) {
    await runWithConcurrency(batches[idx], Math.max(1, concurrency), processRecipient);
    if (idx < batches.length - 1) await sleep(Math.max(0, batchDelayMs));
  }

  if (dryRun) {
    console.log('Dry run complete. Example renders:');
    for (const sample of samples) console.log(`- ${sample}`);
  }

  console.log('Summary:', counters);
  console.log(`Log file: ${logPath}`);
}

async function runWebhook(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const port = getNumber(args, 'port', 8787);
  const optOutPath = getString(args, 'optout-store', false, DEFAULT_OPTOUT_PATH);

  const dir = path.dirname(optOutPath);
  await mkdir(dir, { recursive: true });
  const optOuts = loadOptOuts(optOutPath);

  const server = http.createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body) as Record<string, unknown>;
        const nestedMessage = payload.message as Record<string, unknown> | undefined;

        const incomingText = [
          payload.text,
          payload.body,
          payload.content,
          nestedMessage?.text,
          nestedMessage?.body,
          nestedMessage?.content,
        ]
          .map((value) => (typeof value === 'string' ? value : ''))
          .join(' ')
          .toUpperCase();

        const rawPhone = [payload.phone, payload.from, nestedMessage?.from]
          .map((value) => (typeof value === 'string' ? value : ''))
          .find(Boolean);

        const normalized = rawPhone ? normalizeIraqiPhone(rawPhone) : null;
        const phoneSent = normalized ? toNabdaPhone(normalized) : null;

        if (phoneSent && /\b(STOP|UNSUBSCRIBE)\b/.test(incomingText)) {
          optOuts.add(phoneSent);
          await saveOptOuts(optOutPath, optOuts);
          console.log(`[opt-out] ${phoneSent}`);
        }

        console.log('[webhook]', JSON.stringify(payload));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
      }
    });
  });

  server.listen(port, () => {
    console.log(`Webhook server listening on http://localhost:${port}`);
    console.log(`Opt-out store: ${optOutPath}`);
  });
}

function printHelp(): void {
  console.log(`
Usage:
  tsx src/bulk-cli/cli.ts send --csv <path> --template <path> [options]
  tsx src/bulk-cli/cli.ts webhook [options]

Send options:
  --csv <path>            Recipients CSV (required)
  --template <path>       Template text file (required)
  --dry-run               Render only, no API calls
  --limit <N>             Maximum recipients to process
  --concurrency <N>       Parallel sends per batch (default: 1)
  --batch-size <N>        Batch size (default: 10)
  --batch-delay-ms <ms>   Delay between batches (default: 2000)
  --resume                Skip already-sent recipients from log
  --log <path>            JSONL log path (default: ./send-log.jsonl)
  --optout-store <path>   Opt-out JSON store (default: ./opt-outs.json)

Webhook options:
  --port <N>              HTTP port (default: 8787)
  --optout-store <path>   Opt-out JSON store (default: ./opt-outs.json)
`);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === 'send') {
    await runSend(rest);
    return;
  }

  if (command === 'webhook') {
    await runWebhook(rest);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
