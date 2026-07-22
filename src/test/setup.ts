import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./mocks/server";

// Every test file inherits this MSW bootstrap automatically via
// vitest.config.ts's `test.setupFiles`. `onUnhandledRequest: 'error'` ensures
// any request not covered by a handler fails the test loudly instead of
// silently hitting the network (no network escapes).
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
