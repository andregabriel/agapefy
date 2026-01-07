import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

type FormOption = { label?: string | null; category_id?: string | null };

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing Supabase env vars. Require SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY (or SB_SERVICE_ROLE_KEY)."
  );
}

const SUPABASE_PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL;
const projectRef = new URL(SUPABASE_PUBLIC_URL).hostname.split(".")[0];
const storageKey = `sb-${projectRef}-auth-token`;
const e2eBaseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:3100";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let step1OptionLabel = "";
let step1CategoryId = "";
let step1OptionIndex = 0;
let step2FormId = "";
let step2WasActive: boolean | null = null;
let userId = "";
let sessionCookieChunks: Array<{ name: string; value: string }> = [];
let whatsappPhone = "";

async function fetchStep1Option(supabase: SupabaseClient) {
  const primary = await supabase
    .from("admin_forms")
    .select("id,schema,onboard_step,created_at")
    .eq("form_type", "onboarding")
    .eq("is_active", true)
    .eq("onboard_step", 1)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (primary.error) {
    throw new Error(`Failed to load onboarding step 1 form: ${primary.error.message}`);
  }

  let formData: any = primary.data || null;

  if (!formData || !Array.isArray(formData.schema)) {
    let fallback = await supabase
      .from("admin_forms")
      .select("id,schema,onboard_step,created_at")
      .eq("form_type", "onboarding")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fallback.error) {
      throw new Error(`Failed to load onboarding step 1 fallback form: ${fallback.error.message}`);
    }
    formData = fallback.data || null;
  }

  if (!formData || !Array.isArray(formData.schema)) {
    throw new Error("No active onboarding step 1 form schema found.");
  }

  const schema = formData.schema as FormOption[];
  const optionIndex = schema.findIndex(
    (opt) => opt?.label && opt?.category_id
  );
  const option = optionIndex >= 0 ? schema[optionIndex] : null;
  if (!option?.label || !option?.category_id) {
    throw new Error("Step 1 schema has no valid option with category_id.");
  }

  return {
    label: String(option.label),
    categoryId: String(option.category_id),
    index: optionIndex,
  };
}

async function fetchStep2Form(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("admin_forms")
    .select("id,is_active")
    .eq("form_type", "onboarding")
    .eq("onboard_step", 2)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load onboarding step 2 form: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error("No onboarding step 2 form found.");
  }
  return { id: String(data.id), isActive: Boolean(data.is_active ?? true) };
}

async function createTestUser() {
  const email = `e2e_${Date.now()}_${crypto.randomUUID()}@example.com`;
  const password = `Test#${crypto.randomUUID()}Aa1`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data?.user?.id) {
    throw new Error(`Failed to create test user: ${error?.message || "unknown error"}`);
  }

  const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signInData?.session) {
    throw new Error(
      `Failed to sign in test user: ${signInError?.message || "no session"}`
    );
  }

  return {
    userId: data.user.id,
    session: signInData.session,
    email,
    password,
  };
}

test.beforeAll(async () => {
  const step1 = await fetchStep1Option(admin);
  step1OptionLabel = step1.label;
  step1CategoryId = step1.categoryId;
  step1OptionIndex = step1.index;

  const step2 = await fetchStep2Form(admin);
  step2FormId = step2.id;
  step2WasActive = step2.isActive;

  if (step2WasActive) {
    const { error } = await admin
      .from("admin_forms")
      .update({ is_active: false })
      .eq("id", step2FormId);
    if (error) {
      throw new Error(`Failed to disable step 2 form: ${error.message}`);
    }
  }

  const testUser = await createTestUser();
  userId = testUser.userId;
  const rawSessionCookie = JSON.stringify([
    testUser.session.access_token,
    testUser.session.refresh_token,
    testUser.session.provider_token,
    testUser.session.provider_refresh_token,
    testUser.session.user?.factors ?? null,
  ]);
  const chunkSize = 3180;
  const chunks = rawSessionCookie.match(new RegExp(`.{1,${chunkSize}}`, "g")) || [];
  sessionCookieChunks = chunks.map((chunk, index) => ({
    name: chunks.length === 1 ? storageKey : `${storageKey}.${index}`,
    value: encodeURIComponent(chunk),
  }));
});

test.afterAll(async () => {
  if (step2FormId && step2WasActive !== null) {
    await admin
      .from("admin_forms")
      .update({ is_active: step2WasActive })
      .eq("id", step2FormId);
  }

  if (userId) {
    await admin.from("admin_form_responses").delete().eq("user_id", userId);
    if (whatsappPhone) {
      await admin
        .from("whatsapp_user_challenges")
        .delete()
        .eq("phone_number", whatsappPhone);
      await admin.from("whatsapp_users").delete().eq("phone_number", whatsappPhone);
    }
    await admin.auth.admin.deleteUser(userId);
  }
});

test("onboarding step 3 persists playlist when step 2 inactive and /whatsapp preselects it", async ({
  page,
}) => {
  page.on("pageerror", (err) => {
    console.log("[e2e] pageerror", err.message);
    if (err.stack) {
      console.log("[e2e] pageerror stack", err.stack);
    }
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log("[e2e] console.error", msg.text());
    }
  });
  page.on("requestfailed", (req) => {
    console.log("[e2e] requestfailed", req.url(), req.failure()?.errorText);
  });
  page.on("response", (resp) => {
    if (resp.status() >= 400) {
      const url = resp.url();
      if (url.includes("supabase.co") || url.includes("/api/") || url.includes("/_next/static/")) {
        console.log("[e2e] response", resp.status(), url);
      }
    }
  });

  await page.route("**/api/subscription/status", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });

  await page.context().addCookies(
    sessionCookieChunks.map((chunk) => ({
      name: chunk.name,
      value: chunk.value,
      url: e2eBaseUrl,
    }))
  );

  const onboardingResponse = await page.goto("/onboarding?step=1", {
    waitUntil: "networkidle",
  });
  if (!onboardingResponse) {
    throw new Error("No response when loading /onboarding?step=1");
  }
  console.log("[e2e] onboarding response", onboardingResponse.status(), page.url());
  await expect(page).toHaveURL(/\/onboarding\?step=1/);
  const onboardingContent = await page.content();
  console.log("[e2e] onboarding content flags", {
    hasOnboardingUnavailable: onboardingContent.includes("Onboarding indisponível"),
    hasQuestion: onboardingContent.includes("Por qual motivo"),
  });
  const radioCount = await page.locator('[role="radio"]').count();
  const labelCount = await page.locator(`text=${step1OptionLabel}`).count();
  const skeletonCount = await page.locator('.animate-pulse').count();
  console.log("[e2e] onboarding element counts", {
    radioCount,
    labelCount,
    skeletonCount,
  });

  const step1Radio = page.getByRole("radio").nth(step1OptionIndex);
  await expect(step1Radio).toBeVisible({ timeout: 60000 });
  await step1Radio.click();

  await page.waitForURL(/step=3/);
  await expect(page).toHaveURL(/step=3/);

  const playlistHeading = page.locator("h2").first();
  await expect(playlistHeading).toBeVisible();
  const playlistTitle = (await playlistHeading.textContent())?.trim() || "";
  expect(playlistTitle).not.toBe("");

  const { data: playlistRows, error: playlistError } = await admin
    .from("playlists")
    .select("id,title,category_id,category_ids")
    .eq("title", playlistTitle);
  if (playlistError) {
    throw new Error(`Failed to resolve playlist by title: ${playlistError.message}`);
  }

  const resolvedPlaylist = (playlistRows || []).find((p: any) => {
    const categoryIds = Array.isArray(p.category_ids) ? p.category_ids : [];
    return p.category_id === step1CategoryId || categoryIds.includes(step1CategoryId);
  });

  if (!resolvedPlaylist?.id) {
    throw new Error(
      `Playlist not found for title "${playlistTitle}" in category ${step1CategoryId}.`
    );
  }

  const playlistId = String(resolvedPlaylist.id);

  await expect.poll(async () => {
    const { data } = await admin
      .from("admin_form_responses")
      .select("id,answers,created_at,form_id")
      .eq("form_id", step2FormId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      formId: (data as any)?.form_id || null,
      option: (data as any)?.answers?.option || null,
    };
  }).toEqual({ formId: step2FormId, option: playlistId });

  const ddd = crypto.randomInt(11, 99);
  const subscriber = crypto.randomInt(900_000_000, 999_999_999);
  whatsappPhone = `55${ddd}${subscriber}`;
  const whatsappPayload = {
    phone_number: whatsappPhone,
    is_active: true,
    receives_daily_prayer: true,
    updated_at: new Date().toISOString(),
  };
  const { error: whatsappUserError } = await admin
    .from("whatsapp_users")
    .upsert({ ...whatsappPayload, user_id: userId }, { onConflict: "phone_number" });
  if (whatsappUserError) {
    const msg = String(whatsappUserError.message || "").toLowerCase();
    const code = String((whatsappUserError as any).code || "");
    const missingUserId =
      code === "42703" ||
      msg.includes("user_id") ||
      msg.includes("schema cache") ||
      (msg.includes("column") && msg.includes("does not exist"));
    if (missingUserId) {
      const retry = await admin
        .from("whatsapp_users")
        .upsert(whatsappPayload, { onConflict: "phone_number" });
      if (retry.error) {
        throw new Error(`Failed to seed whatsapp_users (retry): ${retry.error.message}`);
      }
    } else {
      throw new Error(`Failed to seed whatsapp_users: ${whatsappUserError.message}`);
    }
  }

  await admin
    .from("whatsapp_user_challenges")
    .delete()
    .eq("phone_number", whatsappPhone);

  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: `whatsapp_phone_${userId}`, value: { full: whatsappPhone } }
  );

  await page.evaluate(
    ({ key }) => {
      sessionStorage.setItem(key, "1");
    },
    { key: `onboardingRedirected_${userId}` }
  );

  await page.goto("/whatsapp");
  await expect(page).toHaveURL(/\/whatsapp/);

  await page.reload();

  const adminFormPayload = await page
    .waitForFunction(() => (window as any).__wppAdminFormResponsesRead, null, {
      timeout: 60000,
    })
    .then((handle) => handle.jsonValue());
  expect(adminFormPayload).toEqual({ formId: step2FormId, option: playlistId });

  const playlistTitleForId = String(resolvedPlaylist.title || "");
  const combobox = page.getByRole("combobox", {
    name: /selecione seu desafio de orações/i,
  });
  await expect(combobox).toBeVisible();
  await expect(combobox).toHaveText(playlistTitleForId);
  const selectedIdAttr = await combobox.getAttribute("data-selected-challenge-id");
  expect(selectedIdAttr).toBe(playlistId);
});
