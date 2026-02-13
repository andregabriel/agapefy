import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY || "";

const e2eBaseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:5002";

const SUPABASE_PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL;
const projectRef = SUPABASE_PUBLIC_URL ? new URL(SUPABASE_PUBLIC_URL).hostname.split(".")[0] : "";
const storageKey = projectRef ? `sb-${projectRef}-auth-token` : "";

const hasSupabaseEnv =
  Boolean(SUPABASE_URL) && Boolean(SUPABASE_ANON_KEY) && Boolean(SUPABASE_SERVICE_ROLE_KEY) && Boolean(storageKey);

const admin: SupabaseClient | null = hasSupabaseEnv
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;
const anon: SupabaseClient | null = hasSupabaseEnv
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

let userId = "";
let sessionCookieChunks: Array<{ name: string; value: string }> = [];

async function createTestUser() {
  if (!admin || !anon) throw new Error("Supabase clients not configured");
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
    throw new Error(`Failed to sign in test user: ${signInError?.message || "no session"}`);
  }

  const rawSessionCookie = JSON.stringify([
    signInData.session.access_token,
    signInData.session.refresh_token,
    signInData.session.provider_token,
    signInData.session.provider_refresh_token,
    signInData.session.user?.factors ?? null,
  ]);
  const chunkSize = 3180;
  const chunks = rawSessionCookie.match(new RegExp(`.{1,${chunkSize}}`, "g")) || [];
  const cookieChunks = chunks.map((chunk, index) => ({
    name: chunks.length === 1 ? storageKey : `${storageKey}.${index}`,
    value: encodeURIComponent(chunk),
  }));

  return { userId: data.user.id, cookieChunks };
}

function mockAudioRoute(page: any) {
  return page.route("**/rest/v1/audios**", async (route: any) => {
    if (route.request().method() !== "GET") return route.fallback();
    const url = route.request().url();
    const m = url.match(/[?&]id=eq\.([^&]+)/);
    const audioId = m ? decodeURIComponent(m[1]) : "audio-1";
    const body = JSON.stringify({
      id: audioId,
      title: `Oração ${audioId}`,
      subtitle: "Subtítulo",
      description: "Descrição",
      audio_url: "https://example.com/test.mp3",
      cover_url: null,
      thumbnail_url: null,
      duration: 60,
      transcript: null,
      category_id: null,
      created_by: null,
      created_at: "2026-01-07T00:00:00.000Z",
      category: null,
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body,
      headers: { "access-control-allow-origin": "*" },
    });
  });
}

function mockSettingsRoute(page: any, permissions: any) {
  return page.route("**/rest/v1/app_settings**", async (route: any) => {
    if (route.request().method() !== "GET") return route.fallback();
    const rows = [
      {
        id: "1",
        key: "paywall_permissions",
        value: JSON.stringify(permissions),
        type: "text",
        created_at: "2026-01-07T00:00:00.000Z",
        updated_at: "2026-01-07T00:00:00.000Z",
      },
    ];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(rows),
      headers: { "access-control-allow-origin": "*" },
    });
  });
}

test.describe("player permissions (logged in)", () => {
  test.beforeAll(async () => {
    if (!hasSupabaseEnv) return;
    const created = await createTestUser();
    userId = created.userId;
    sessionCookieChunks = created.cookieChunks;
  });

  test.afterAll(async () => {
    if (!hasSupabaseEnv) return;
    if (admin && userId) {
      await admin.auth.admin.deleteUser(userId);
    }
  });

  test("no_subscription: second new audio triggers paywall when limit reached", async ({ page }) => {
    test.skip(!hasSupabaseEnv, "Missing Supabase env vars for e2e auth");

    const permissions = {
      anonymous: { limit_enabled: true, max_free_audios_per_day: 0 },
      no_subscription: { limit_enabled: true, max_free_audios_per_day: 1 },
      active_subscription: { full_access_enabled: true },
      trial: { full_access_enabled: true },
    };

    // Keep onboarding gate from redirecting mid-test.
    await page.route("**/api/onboarding/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ pending: false, nextStep: null, steps: [] }),
      });
    });

    // Avoid profile lookup issues by forcing non-admin role.
    await page.route("**/rest/v1/profiles**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ role: null }),
        headers: { "access-control-allow-origin": "*" },
      });
    });

    // Bypass onboarding WhatsApp gate (step 7) by returning a phone number.
    await page.route("**/rest/v1/whatsapp_users**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ phone_number: "5511999999999" }),
        headers: { "access-control-allow-origin": "*" },
      });
    });

    await page.route("**/api/subscription/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          userType: "no_subscription",
          hasActiveSubscription: false,
          hasActiveTrial: false,
        }),
      });
    });

    let checkCalls = 0;
    await page.route("**/api/free-plays/check", async (route) => {
      checkCalls += 1;
      const allowed = checkCalls === 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ allowed, count: checkCalls, max: 1 }),
      });
    });

    await mockAudioRoute(page);
    await mockSettingsRoute(page, permissions);

    await page.context().addCookies(
      sessionCookieChunks.map((chunk) => ({
        name: chunk.name,
        value: chunk.value,
        url: e2eBaseUrl,
      })),
    );

    // First audio: allowed
    await page.goto("/player/audio/audio-1", { waitUntil: "domcontentloaded" });
    const playButtonFirstAudio = page.locator("button.bg-green-500:visible");
    await expect(playButtonFirstAudio).toBeVisible({ timeout: 60_000 });
    await playButtonFirstAudio.click();

    // Second audio (new): should be blocked and open paywall
    await page.goto("/player/audio/audio-2", { waitUntil: "domcontentloaded" });
    const playButtonSecondAudio = page.locator("button.bg-green-500:visible");
    await expect(playButtonSecondAudio).toBeVisible({ timeout: 60_000 });
    await playButtonSecondAudio.click();

    await expect(page.getByText("Comece cada dia", { exact: false })).toBeVisible({
      timeout: 60_000,
    });
  });

  test("active_subscription: full access bypasses /api/free-plays/check", async ({ page }) => {
    test.skip(!hasSupabaseEnv, "Missing Supabase env vars for e2e auth");

    const permissions = {
      anonymous: { limit_enabled: true, max_free_audios_per_day: 0 },
      no_subscription: { limit_enabled: true, max_free_audios_per_day: 1 },
      active_subscription: { full_access_enabled: true },
      trial: { full_access_enabled: true },
    };

    await page.route("**/api/onboarding/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ pending: false, nextStep: null, steps: [] }),
      });
    });

    await page.route("**/rest/v1/profiles**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ role: null }),
        headers: { "access-control-allow-origin": "*" },
      });
    });

    await page.route("**/rest/v1/whatsapp_users**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ phone_number: "5511999999999" }),
        headers: { "access-control-allow-origin": "*" },
      });
    });

    await page.route("**/api/subscription/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          userType: "active_subscription",
          hasActiveSubscription: true,
          hasActiveTrial: false,
        }),
      });
    });

    let freePlaysHit = false;
    page.on("request", (req) => {
      if (req.url().includes("/api/free-plays/check")) freePlaysHit = true;
    });

    await mockAudioRoute(page);
    await mockSettingsRoute(page, permissions);

    await page.context().addCookies(
      sessionCookieChunks.map((chunk) => ({
        name: chunk.name,
        value: chunk.value,
        url: e2eBaseUrl,
      })),
    );

    await page.goto("/player/audio/audio-3", { waitUntil: "domcontentloaded" });
    const playButton = page.locator("button.bg-green-500:visible");
    await expect(playButton).toBeVisible({ timeout: 60_000 });
    await playButton.click();

    await expect.poll(() => freePlaysHit).toBe(false);
  });

  test("trial: full access bypasses /api/free-plays/check", async ({ page }) => {
    test.skip(!hasSupabaseEnv, "Missing Supabase env vars for e2e auth");

    const permissions = {
      anonymous: { limit_enabled: true, max_free_audios_per_day: 0 },
      no_subscription: { limit_enabled: true, max_free_audios_per_day: 1 },
      active_subscription: { full_access_enabled: true },
      trial: { full_access_enabled: true },
    };

    await page.route("**/api/onboarding/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ pending: false, nextStep: null, steps: [] }),
      });
    });

    await page.route("**/rest/v1/profiles**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ role: null }),
        headers: { "access-control-allow-origin": "*" },
      });
    });

    await page.route("**/rest/v1/whatsapp_users**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ phone_number: "5511999999999" }),
        headers: { "access-control-allow-origin": "*" },
      });
    });

    await page.route("**/api/subscription/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          userType: "trial",
          hasActiveSubscription: false,
          hasActiveTrial: true,
        }),
      });
    });

    let freePlaysHit = false;
    page.on("request", (req) => {
      if (req.url().includes("/api/free-plays/check")) freePlaysHit = true;
    });

    await mockAudioRoute(page);
    await mockSettingsRoute(page, permissions);

    await page.context().addCookies(
      sessionCookieChunks.map((chunk) => ({
        name: chunk.name,
        value: chunk.value,
        url: e2eBaseUrl,
      })),
    );

    await page.goto("/player/audio/audio-4", { waitUntil: "domcontentloaded" });
    const playButton = page.locator("button.bg-green-500:visible");
    await expect(playButton).toBeVisible({ timeout: 60_000 });
    await playButton.click();

    await expect.poll(() => freePlaysHit).toBe(false);
  });
});
