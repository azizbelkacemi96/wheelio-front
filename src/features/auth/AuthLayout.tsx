/**
 * Two-panel auth layout (login + signup): a branded panel on the left (hidden
 * below lg) and the form on the right. Brand palette = Wheelio blue→violet
 * (--gradient-auth). All copy is i18n (auth.brand.*), FR default / EN.
 */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { WheelioMark } from "@/shared/ui/brand";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh">
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <MobileBrand />
          {children}
          <Footer />
        </div>
      </div>
    </div>
  );
}

function BrandPanel() {
  const { t } = useTranslation();
  const features = [
    t("auth.brand.feature1"),
    t("auth.brand.feature2"),
    t("auth.brand.feature3"),
  ];

  return (
    <div className="relative hidden overflow-hidden bg-slate-950 p-12 lg:flex lg:w-[45%] lg:flex-col lg:justify-center">
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* Blue glow top-left */}
      <div
        className="absolute -top-32 -left-32 size-96 rounded-full opacity-25 blur-3xl"
        aria-hidden="true"
        style={{ background: "#2563eb" }}
      />
      {/* Teal glow bottom-right (brand accent) */}
      <div
        className="absolute -right-32 -bottom-32 size-96 rounded-full opacity-20 blur-3xl"
        aria-hidden="true"
        style={{ background: "#17b3c3" }}
      />

      <div className="relative z-10 flex max-w-sm flex-col gap-8">
        <WheelioMark className="size-28 rounded-3xl shadow-2xl ring-1 ring-white/10" />

        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white">
            {t("auth.brand.tagline")}
          </h1>
          <p className="text-sm leading-relaxed text-slate-400">
            {t("auth.brand.subtitle")}
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-sm text-slate-300">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white">
                <Check className="size-3" aria-hidden="true" />
              </span>
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Compact brand mark shown above the form on narrow screens (brand panel hidden). */
function MobileBrand() {
  return (
    <div className="mb-8 flex justify-center lg:hidden">
      <WheelioMark className="size-20 rounded-2xl shadow-md" />
    </div>
  );
}

function Footer() {
  const { t } = useTranslation();
  return (
    <p className="mt-6 text-center text-xs text-muted-foreground">
      {t("auth.brand.copyright", { year: new Date().getFullYear() })}
    </p>
  );
}
