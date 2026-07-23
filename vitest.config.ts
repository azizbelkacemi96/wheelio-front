import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    // e2e/ specs are Playwright tests — importing @playwright/test under
    // Vitest throws "did not expect test.describe() to be called here".
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
    setupFiles: ["src/test/setup.ts"],
    reporters: "default",
    // Node 22+ ships an experimental global `localStorage`/`sessionStorage`
    // (on by default) whose inert getter shadows jsdom's own window.localStorage
    // implementation inside the worker process, breaking any test that touches
    // localStorage (e.g. theme-provider.test.tsx). Disabling it lets jsdom's
    // environment populate the real Storage implementation instead.
    execArgv: ["--no-experimental-webstorage"],
  },
});
