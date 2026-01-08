/**
 * PWA Service Worker (safe/minimal)
 * - Exists primarily to satisfy installability requirements (Android/Chrome).
 * - Does NOT cache routes/assets (avoids stale UI/auth issues).
 * - Does NOT intercept /api/* requests.
 */

self.addEventListener("install", () => {
  // Activate immediately on update
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET navigations, and keep it network-only (no caching).
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never touch APIs (avoid auth/data bugs).
  if (url.pathname.startsWith("/api/")) return;

  // Minimal handler: for navigations, just pass-through network.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request));
  }
});