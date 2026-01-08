"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    // Avoid service worker surprises during local development.
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    async function register() {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // Silent: SW registration must never block UX.
      }
    }

    if (!cancelled) void register();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

