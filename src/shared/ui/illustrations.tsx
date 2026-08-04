/**
 * Inline SVG illustrations (car-rental themed) — zero external asset, CSP/
 * offline-safe, crisp at any DPI, theme-aware (the body inherits `currentColor`
 * so a wrapping `text-primary` tints it). Used to warm up the dashboard header
 * and empty states so screens don't feel bare.
 */

/**
 * A finished rental "scene" tile — echoes the Wheelio logo (speedometer arc +
 * dashed route + location pin + car) in the brand teal/navy palette. Unlike
 * CarIllustration it is self-colored on a soft light card, so it reads as a
 * bright brand picture on any page theme. Used on the dashboard hero.
 */
export function RentalScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 220" className={className} role="img" aria-hidden="true">
      <defs>
        <linearGradient id="wheelio-scene-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e9f6f8" />
          <stop offset="1" stopColor="#eef3fb" />
        </linearGradient>
        <linearGradient id="wheelio-scene-car" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f4a7a" />
          <stop offset="1" stopColor="#173a63" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="360" height="220" rx="20" fill="url(#wheelio-scene-bg)" />

      {/* speedometer arc (logo motif) */}
      <path
        d="M46 120 A54 54 0 0 1 150 92"
        stroke="#17b3c3"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path d="M60 78 l7 9 M92 58 l3 11 M126 54 l-1 11" stroke="#17b3c3" strokeWidth="4" strokeLinecap="round" opacity="0.4" />

      {/* dashed route up to the pin */}
      <path
        d="M232 142 C 268 138, 292 112, 300 90"
        stroke="#173a63"
        strokeWidth="3"
        strokeDasharray="1 9"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />

      {/* road */}
      <rect x="40" y="176" width="280" height="7" rx="3.5" fill="#173a63" opacity="0.12" />

      {/* car */}
      <rect x="96" y="122" width="150" height="34" rx="14" fill="url(#wheelio-scene-car)" />
      <path d="M138 123 L160 94 Q164 90 171 90 L204 90 Q214 90 221 98 L236 123 Z" fill="url(#wheelio-scene-car)" />
      <path d="M164 120 L172 99 Q173 97 176 97 L188 97 L188 120 Z" fill="#dbeafe" fillOpacity="0.92" />
      <path d="M194 97 L206 97 Q212 97 216 102 L223 120 L194 120 Z" fill="#dbeafe" fillOpacity="0.92" />
      <rect x="238" y="130" width="8" height="9" rx="2" fill="#fbbf24" />
      <circle cx="128" cy="158" r="17" fill="#1f2937" />
      <circle cx="128" cy="158" r="6.5" fill="#e5e7eb" />
      <circle cx="216" cy="158" r="17" fill="#1f2937" />
      <circle cx="216" cy="158" r="6.5" fill="#e5e7eb" />

      {/* location pin */}
      <path d="M300 100 L289 78 L311 78 Z" fill="#0f9bad" />
      <circle cx="300" cy="70" r="15" fill="#17b3c3" />
      <circle cx="300" cy="70" r="6" fill="#fff" />
    </svg>
  );
}

/** A flat side-view car. Body inherits currentColor; wheels are neutral dark. */
export function CarIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 104"
      className={className}
      fill="none"
      role="img"
      aria-hidden="true"
    >
      {/* body */}
      <rect x="14" y="46" width="172" height="30" rx="12" fill="currentColor" />
      {/* cabin */}
      <path
        d="M52 47 L70 27 Q73 24 78 24 L118 24 Q126 24 133 31 L146 46 Z"
        fill="currentColor"
      />
      {/* windows */}
      <path d="M74 44 L82 31 Q83 29 86 29 L96 29 L96 44 Z" fill="#fff" fillOpacity="0.85" />
      <path d="M101 29 L114 29 Q120 29 124 33 L131 44 L101 44 Z" fill="#fff" fillOpacity="0.85" />
      {/* headlight */}
      <rect x="178" y="52" width="8" height="9" rx="2" fill="#fbbf24" />
      {/* wheels */}
      <circle cx="58" cy="80" r="15" fill="#1f2937" />
      <circle cx="58" cy="80" r="6" fill="#e5e7eb" />
      <circle cx="146" cy="80" r="15" fill="#1f2937" />
      <circle cx="146" cy="80" r="6" fill="#e5e7eb" />
    </svg>
  );
}
