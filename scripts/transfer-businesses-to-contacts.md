# Business → Contacts Transfer (Supabase)

This script moves business records from the source project into the target CRM `contacts` table.

## 1) Required environment variables

Set these in your shell or `.env.local`:

```bash
SOURCE_SUPABASE_URL="https://hsadukhmcclwixuntqwu.supabase.co"
SOURCE_SUPABASE_SERVICE_ROLE_KEY="..."
TARGET_SUPABASE_URL="https://ujdsxzvvgaugypwtugdl.supabase.co"
TARGET_SUPABASE_SERVICE_ROLE_KEY="..."
```

## 2) Ensure target table exists

Run this SQL in the **target** project SQL editor:

```sql
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  raw_phone text,
  normalized_phone text unique not null,
  category text,
  governorate text,
  created_at timestamptz default now()
);
```

## 3) Test with 10 rows

```bash
npm run transfer:businesses -- --mode=test --limit=10
```

## 4) Run full migration

```bash
npm run transfer:businesses -- --mode=full
```

## Mapping and cleanup rules used

- `display_name`: first non-empty from `business_name`, `name`, `display_name`
- `raw_phone`: first non-empty from `whatsapp`, `phone_1`, `phone_2`, `phone`, `mobile`, `telephone`, `tel`
- `normalized_phone`: normalized to Iraqi E.164 using shared `normalizeIraqiPhone` utility (`+9647XXXXXXXXX`)
- optional passthrough fields:
  - `category`: first non-empty from `category`, `business_category`, `segment`
  - `governorate`: first non-empty from `governorate`, `province`, `city`

## Filtering

The script skips:

- rows with no phone
- rows with invalid Iraqi numbers
- duplicate phones in the same source batch
- phones already existing in target (`upsert ... onConflict: normalized_phone` with `ignoreDuplicates: true`)

## Logging

At the end of each run the script prints:

- rows processed
- valid rows prepared
- inserted rows
- skipped counts by reason

