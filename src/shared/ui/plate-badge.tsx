/**
 * Algerian license-plate badge — a small, self-contained SVG-free plate mock
 * (tabular digits + blue "DZ" euroband) so a vehicle is instantly recognizable
 * in lists/detail. THEME-AWARE (two variants): a white plate / black digits in
 * light mode, and a dark plate / light digits in dark mode, so it sits well on
 * either background. The blue euroband is constant in both.
 *
 * Zero external asset (no PNG): pure markup, offline/CSP-safe, crisp at any
 * DPI. `size` tunes it for dense table cells (sm) vs a detail header (md).
 */
import { cn } from "@/lib/utils";

export function PlateBadge({
  plate,
  size = "sm",
  className,
}: {
  plate: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex select-none items-stretch overflow-hidden rounded-[4px] border font-mono font-bold tracking-wider shadow-sm",
        // Light variant: white plate, black digits.
        "border-slate-900/70 bg-white text-slate-900",
        // Dark variant: dark plate, light digits.
        "dark:border-slate-300/40 dark:bg-slate-800 dark:text-slate-50",
        size === "sm" ? "text-xs" : "text-sm",
        className,
      )}
      aria-label={plate}
      title={plate}
    >
      <span
        className={cn(
          "flex items-center justify-center bg-blue-700 font-sans font-semibold leading-none text-white",
          size === "sm" ? "px-1 text-[9px]" : "px-1.5 text-[11px]",
        )}
        aria-hidden="true"
      >
        DZ
      </span>
      <span className={cn("tabular-nums", size === "sm" ? "px-1.5 py-0.5" : "px-2.5 py-1")}>
        {plate}
      </span>
    </span>
  );
}
