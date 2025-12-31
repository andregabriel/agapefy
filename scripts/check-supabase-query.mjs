import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const contents = fs.readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2] || "";
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SB_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: sample, error: sampleError } = await admin
    .from("admin_forms")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (sampleError) {
    throw new Error(`admin_forms sample query failed: ${sampleError.message}`);
  }

  const hasParentFormId = !!sample && Object.prototype.hasOwnProperty.call(sample, "parent_form_id");

  let step2Query = admin
    .from("admin_forms")
    .select("id,is_active")
    .eq("form_type", "onboarding")
    .eq("onboard_step", 2);

  if (hasParentFormId) {
    step2Query = step2Query.is("parent_form_id", null);
  }

  const { data: step2Rows, error: step2Error } = await step2Query;
  if (step2Error) {
    throw new Error(`step2 query failed: ${step2Error.message}`);
  }

  const { data: challengeRows, error: challengeError } = await admin
    .from("whatsapp_user_challenges")
    .select("id,phone_number,playlist_id")
    .limit(1);
  if (challengeError) {
    throw new Error(`whatsapp_user_challenges query failed: ${challengeError.message}`);
  }

  console.log("OK", {
    hasParentFormId,
    step2Count: Array.isArray(step2Rows) ? step2Rows.length : 0,
    whatsappChallengesCount: Array.isArray(challengeRows) ? challengeRows.length : 0,
  });
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
