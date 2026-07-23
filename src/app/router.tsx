import { createRouter } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { ensureSession } from "@/shared/auth/session";

export const router = createRouter({
  routeTree,
  context: {
    auth: { ensureSession },
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
