import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./mocks/server";

// jsdom has no `window.matchMedia` implementation. Only needed once a test
// renders the real app tree (routes/__root.tsx's <Toaster/> — the `sonner`
// package itself reads `prefers-color-scheme` via matchMedia when its theme
// prop is "system", ThemeProvider's own default) — added here (shared test
// infra) rather than per-file so any future test exercising __root.tsx
// doesn't have to rediscover this.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}

// Radix UI popper primitives (Select, DropdownMenu) probe pointer-capture and
// scroll APIs that jsdom does not implement; without these no-op polyfills a
// userEvent.click on a Select trigger/option throws instead of opening. Added
// here (shared infra) so any test exercising a Radix overlay works — feature
// tests shouldn't each rediscover the same jsdom gap.
if (typeof window !== "undefined") {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
}

// Every test file inherits this MSW bootstrap automatically via
// vitest.config.ts's `test.setupFiles`. `onUnhandledRequest: 'error'` ensures
// any request not covered by a handler fails the test loudly instead of
// silently hitting the network (no network escapes).
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
