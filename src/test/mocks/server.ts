import { setupServer } from "msw/node";
import { handlers } from "./handlers";

// Shared MSW server for Node-based test runs (Vitest). Started/stopped in
// src/test/setup.ts; every test inherits the mocked wheelio-api contract.
export const server = setupServer(...handlers);
