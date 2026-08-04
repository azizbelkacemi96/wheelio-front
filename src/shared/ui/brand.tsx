/**
 * Wheelio brand assets. The mark is the real company logo (public/wheelio-logo.png,
 * a self-contained square lockup); `WheelioMark` renders it as an icon tile and
 * `WheelioLogo` pairs a small tile with the "Wheelio" wordmark for compact spots
 * (sidebar, sheet header) where the baked-in wordmark would be too small to read.
 */
import { cn } from "@/lib/utils";

const LOGO_SRC = "/wheelio-logo.png";
const TEAL = "#17b3c3";

/** The logo tile alone. Size + rounding/shadow come from `className`. */
export function WheelioMark({ className }: { className?: string }) {
  return (
    <img
      src={LOGO_SRC}
      alt="Wheelio"
      width={512}
      height={512}
      className={cn("object-contain", className)}
    />
  );
}

/** Compact lockup: a small logo tile + the "Wheelio" wordmark. `dark` renders
 * the wordmark white (for the dark brand panel); otherwise the foreground color. */
export function WheelioLogo({
  className,
  markClassName,
  dark = false,
}: {
  className?: string;
  markClassName?: string;
  dark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <WheelioMark className={cn("size-8 shrink-0 rounded-md", markClassName)} />
      <span
        className={cn(
          "font-heading text-lg font-bold tracking-tight",
          dark ? "text-white" : "text-foreground",
        )}
      >
        Wheel<span style={{ color: TEAL }}>io</span>
      </span>
    </span>
  );
}
