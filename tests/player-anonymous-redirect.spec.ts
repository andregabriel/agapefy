import { test, expect } from "@playwright/test";

test("anonymous clicking play on audio page redirects to /login", async ({ page }) => {
  // Intercept Supabase REST call for the audio record so the page can render.
  await page.route("**/rest/v1/audios**", async (route) => {
    const url = route.request().url();
    // Only mock GETs; allow others through if they ever happen.
    if (route.request().method() !== "GET") return route.fallback();

    // Minimal audio record compatible with src/app/player/audio/[audioId]/page.tsx usage.
    const audioId = "test-audio";
    const body = JSON.stringify({
      id: audioId,
      title: "Teste de Oração",
      subtitle: "Subtítulo de teste",
      description: "Descrição de teste",
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

    // Supabase returns 200 with JSON object for .single()
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body,
      headers: {
        "access-control-allow-origin": "*",
      },
    });
  });

  // App settings query can happen on mount; safe mock to avoid flakiness if DB isn't reachable.
  await page.route("**/rest/v1/app_settings**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
      headers: { "access-control-allow-origin": "*" },
    });
  });

  // Anonymous subscription status should be anonymous
  await page.route("**/api/subscription/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        userType: "anonymous",
        hasActiveSubscription: false,
        hasActiveTrial: false,
      }),
    });
  });

  await page.goto("/player/audio/test-audio", { waitUntil: "domcontentloaded" });

  const playButton = page.locator("button.bg-green-500");
  await expect(playButton).toBeVisible({ timeout: 60_000 });
  await playButton.click();

  await page.waitForURL(/\/login(\?|$)/, { timeout: 60_000 });
  await expect(page).toHaveURL(/\/login(\?|$)/);
});



