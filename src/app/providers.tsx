import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { ThemeProvider } from "@/shared/ui/theme-provider";
import { TooltipProvider } from "@/shared/ui/tooltip";
import "@/shared/i18n";
import { router } from "./router";

const queryClient = new QueryClient();

/**
 * Composition root: QueryClientProvider (agency list, later feature-phase
 * data fetching) -> ThemeProvider (plan 02, dark mode from day one, D-02)
 * -> the i18n runtime is a side-effect import (plan 04) rather than a
 * provider (i18next initialises itself once at module load) -> the guarded
 * router (this plan).
 */
export function Providers() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
