// Ensures src/routeTree.gen.ts exists before tsc/vitest/build run on a fresh
// clone. The @tanstack/router-plugin Vite plugin only regenerates this file
// as a side effect of running the Vite dev server or `vite build`; `tsc` (run
// standalone via `npx tsc --noEmit`, or as the first step of `npm run build`)
// never touches Vite at all, so a bare-clone checkout would fail to typecheck
// without this pregeneration step. Safe to run repeatedly (idempotent).
import { getConfig, Generator } from "@tanstack/router-generator";

const root = process.cwd();

const config = getConfig(
  {
    routesDirectory: "./src/routes",
    generatedRouteTree: "./src/routeTree.gen.ts",
    disableLogging: true,
    // Co-located vitest files (e.g. _authenticated/placeholders.test.tsx)
    // live inside src/routes; the generator has NO default ignore for
    // ".test." files, so without this it would treat them as route files.
    // MUST stay in sync with the tanstackRouter() plugin in vite.config.ts.
    routeFileIgnorePattern: "\\.test\\.",
  },
  root,
);

const generator = new Generator({ config, root });
await generator.run();
