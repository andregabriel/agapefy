import { defineConfig } from "@playwright/test";
import fs from "fs";
import path from "path";

const envPath = path.resolve(__dirname, ".env.local");
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

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3100";
const baseURLParsed = new URL(baseURL);
const serverHost = baseURLParsed.hostname || "127.0.0.1";
const serverPort = Number(baseURLParsed.port || 3100);

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `pnpm exec next dev -H ${serverHost} -p ${serverPort}`,
    port: serverPort,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
