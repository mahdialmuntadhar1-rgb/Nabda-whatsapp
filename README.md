# Nabda WhatsApp Gateway

This repository now includes:
- The existing React + server workflow.
- A **bulk template messaging CLI** (`src/bulk-cli/cli.ts`) for compliant, resumable bulk sends through Nabda REST API.

## Prerequisites

- Node.js 20+
- npm

## Install

```bash
npm install
```

## Environment variables

Create a `.env` file (or export in shell):

```bash
NABDA_API_URL=https://api.nabdaotp.com
NABDA_INSTANCE_ID=your_instance_id
NABDA_API_TOKEN=your_api_token
```

> Never commit tokens. If any token is exposed, rotate it immediately in your Nabda dashboard.

## Bulk CLI usage

### Commands

```bash
# Send campaign (or dry-run)
npm run bulk:send -- --csv ./recipients.csv --template ./template.txt --dry-run

# Real send
npm run bulk:send -- --csv ./recipients.csv --template ./template.txt --concurrency 1 --batch-size 10 --batch-delay-ms 2000

# Resume from prior successful sends
npm run bulk:send -- --csv ./recipients.csv --template ./template.txt --resume

# Start webhook listener for inbound STOP/UNSUBSCRIBE
npm run bulk:webhook -- --port 8787
```

### Send options

- `--csv <path>` required
- `--template <path>` required
- `--dry-run` render only, no API calls
- `--limit <N>` max recipients
- `--concurrency <N>` default `1`
- `--batch-size <N>` default `10`
- `--batch-delay-ms <ms>` default `2000`
- `--resume` skip recipients already logged as sent
- `--log <path>` default `./send-log.jsonl`
- `--optout-store <path>` default `./opt-outs.json`

### Webhook options

- `--port <N>` default `8787`
- `--optout-store <path>` default `./opt-outs.json`

## CSV format

Required columns:
- `phone`

Optional columns:
- `name`
- `governorate`
- `category`
- `opt_in` (`true/false`, missing = false)

Example:

```csv
phone,name,governorate,category,opt_in
+9647701234567,Ali,Baghdad,Retail,true
07701234568,Sara,Basra,Healthcare,true
9647701234569,Omar,Erbil,Education,false
```

## Template format

Supported placeholders:
- Named: `{{name}}`, `{{governorate}}`, `{{category}}`, `{{phone}}`
- Numeric aliases: `{{1}}`, `{{2}}`, `{{3}}`, `{{4}}` (same order)

Example template:

```txt
Hello {{name}},
Nabda update for {{governorate}} ({{category}}).
We may contact you at {{phone}}.
Reply STOP to opt out.
```

## Safety, compliance, and throttling defaults

- Only recipients with `opt_in=true` are sent.
- Numbers in local opt-out store are always skipped.
- Webhook can auto-mark opt-outs when inbound text includes `STOP` or `UNSUBSCRIBE`.
- Conservative defaults: `concurrency=1`, `batch-size=10`, `batch-delay-ms=2000`.
- Retries are automatic for transient failures (`429`, `502`, `503`, `504`, network errors) with exponential backoff + jitter, up to 5 attempts.

## Logging and resume

Each attempted send writes one line to JSONL log (`send-log.jsonl` by default), including:
- input + normalized phone
- template hash
- message preview
- status (`sent`, `failed`, `skipped_*`)
- HTTP status, message ID, and error summary

With `--resume`, the CLI reads the log and skips numbers already marked as `sent`.

## Existing app (unchanged)

To run the existing app:

```bash
npm run dev
```
