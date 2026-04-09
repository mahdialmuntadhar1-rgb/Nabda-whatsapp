import dotenv from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { normalizeIraqiPhone } from "../src/lib/phone-utils";

dotenv.config();

type RunMode = "test" | "full";

type SourceRow = Record<string, unknown>;

const SOURCE_URL = process.env.SOURCE_SUPABASE_URL || "https://hsadukhmcclwixuntqwu.supabase.co";
const SOURCE_SERVICE_KEY = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY;
const TARGET_URL = process.env.TARGET_SUPABASE_URL || "https://ujdsxzvvgaugypwtugdl.supabase.co";
const TARGET_SERVICE_KEY = process.env.TARGET_SUPABASE_SERVICE_ROLE_KEY;

const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
const mode = (modeArg?.split("=")[1] || "test") as RunMode;
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const explicitLimit = limitArg ? Number.parseInt(limitArg.split("=")[1], 10) : NaN;
const TEST_LIMIT = Number.isFinite(explicitLimit) ? explicitLimit : 10;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

function pickFirstString(row: SourceRow, candidates: string[]): string {
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

async function resolveSourceTable(source: SupabaseClient): Promise<"businesses" | "staging_businesses"> {
  for (const table of ["businesses", "staging_businesses"] as const) {
    const { error } = await source.from(table).select("*", { head: true, count: "exact" }).limit(1);
    if (!error) return table;
    if (!error.message.toLowerCase().includes("does not exist")) {
      console.warn(`[WARN] Could not probe table ${table}: ${error.message}`);
    }
  }
  throw new Error("Neither businesses nor staging_businesses is accessible in source project.");
}

async function main() {
  const source = createClient(SOURCE_URL, requireEnv("SOURCE_SUPABASE_SERVICE_ROLE_KEY", SOURCE_SERVICE_KEY));
  const target = createClient(TARGET_URL, requireEnv("TARGET_SUPABASE_SERVICE_ROLE_KEY", TARGET_SERVICE_KEY));

  const sourceTable = await resolveSourceTable(source);

  const nameCandidates = ["business_name", "name", "display_name"];
  const phoneCandidates = ["whatsapp", "phone_1", "phone_2", "phone", "mobile", "telephone", "tel"];
  const categoryCandidates = ["category", "business_category", "segment"];
  const governorateCandidates = ["governorate", "province", "city"];

  const query = source.from(sourceTable).select("*");
  if (mode === "test") {
    query.limit(TEST_LIMIT);
  }

  const { data: rows, error: sourceError } = await query;
  if (sourceError) {
    throw new Error(`Failed reading source rows: ${sourceError.message}`);
  }

  const contactsPayload: Array<Record<string, string>> = [];
  const seen = new Set<string>();

  let skippedNoPhone = 0;
  let skippedInvalidPhone = 0;
  let skippedDuplicateInBatch = 0;

  for (const row of rows || []) {
    const displayName = pickFirstString(row, nameCandidates) || "Unknown Business";
    const rawPhone = pickFirstString(row, phoneCandidates);

    if (!rawPhone) {
      skippedNoPhone += 1;
      continue;
    }

    const normalized = normalizeIraqiPhone(rawPhone);
    if (!normalized) {
      skippedInvalidPhone += 1;
      continue;
    }

    if (seen.has(normalized)) {
      skippedDuplicateInBatch += 1;
      continue;
    }
    seen.add(normalized);

    const record: Record<string, string> = {
      display_name: displayName,
      raw_phone: rawPhone,
      normalized_phone: normalized,
    };

    const category = pickFirstString(row, categoryCandidates);
    const governorate = pickFirstString(row, governorateCandidates);
    if (category) record.category = category;
    if (governorate) record.governorate = governorate;

    contactsPayload.push(record);
  }

  const BATCH_SIZE = 500;
  let inserted = 0;
  let skippedExistingTargetDuplicates = 0;

  for (let i = 0; i < contactsPayload.length; i += BATCH_SIZE) {
    const chunk = contactsPayload.slice(i, i + BATCH_SIZE);

    const { data: insertedRows, error } = await target
      .from("contacts")
      .upsert(chunk, { onConflict: "normalized_phone", ignoreDuplicates: true })
      .select("normalized_phone");

    if (error) {
      throw new Error(`Insert error at batch ${i / BATCH_SIZE + 1}: ${error.message}`);
    }

    const insertedNow = insertedRows?.length || 0;
    inserted += insertedNow;
    skippedExistingTargetDuplicates += chunk.length - insertedNow;
  }

  const totalProcessed = rows?.length || 0;
  const skippedTotal = skippedNoPhone + skippedInvalidPhone + skippedDuplicateInBatch + skippedExistingTargetDuplicates;

  console.log("\n=== Transfer Summary ===");
  console.log(`Mode: ${mode}`);
  console.log(`Source project: ${SOURCE_URL}`);
  console.log(`Target project: ${TARGET_URL}`);
  console.log(`Source table used: ${sourceTable}`);
  console.log(`Mapped name columns (priority): ${nameCandidates.join(" -> ")}`);
  console.log(`Mapped phone columns (priority): ${phoneCandidates.join(" -> ")}`);
  console.log(`Mapped category columns (priority): ${categoryCandidates.join(" -> ")}`);
  console.log(`Mapped governorate columns (priority): ${governorateCandidates.join(" -> ")}`);
  console.log(`Rows processed: ${totalProcessed}`);
  console.log(`Valid rows prepared: ${contactsPayload.length}`);
  console.log(`Inserted rows: ${inserted}`);
  console.log(`Skipped (no phone): ${skippedNoPhone}`);
  console.log(`Skipped (invalid phone): ${skippedInvalidPhone}`);
  console.log(`Skipped (duplicate in source batch): ${skippedDuplicateInBatch}`);
  console.log(`Skipped (already exists in target): ${skippedExistingTargetDuplicates}`);
  console.log(`Total skipped: ${skippedTotal}`);

  if (mode === "test") {
    console.log("\nTest run completed. Re-run with --mode=full for full migration.");
  }
}

main().catch((error) => {
  console.error("Transfer failed:", error.message);
  process.exit(1);
});
