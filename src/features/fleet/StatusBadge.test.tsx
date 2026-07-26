/**
 * StatusBadge (D-02): one token-mapped Badge per backend status value,
 * label ALWAYS from i18n (FR default) — raw enum strings never reach the
 * DOM (D-07). The style map is Record<VehicleStatus, string>, so enum drift
 * fails tsc before it can fail here.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import i18n from "@/shared/i18n";
import type { VehicleStatus } from "@/types/fleet";
import { StatusBadge } from "./StatusBadge";

beforeEach(async () => {
  await act(async () => {
    await i18n.changeLanguage("fr");
  });
});

const cases: Array<{
  status: VehicleStatus;
  frLabel: string;
  className: string;
}> = [
  { status: "available", frLabel: "Disponible", className: "text-success" },
  { status: "rented", frLabel: "Loué", className: "text-primary" },
  {
    status: "maintenance",
    frLabel: "En maintenance",
    className: "text-warning",
  },
  {
    status: "retired",
    frLabel: "Retiré",
    className: "text-muted-foreground",
  },
];

describe("StatusBadge", () => {
  it.each(cases)(
    "renders the translated FR label and token classes for '$status'",
    ({ status, frLabel, className }) => {
      render(<StatusBadge status={status} />);

      const badge = screen.getByText(frLabel);
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain(className);
      // The raw backend enum value never reaches the DOM (D-07).
      expect(badge.textContent).not.toBe(status);
    },
  );

  it("renders the EN label after a locale switch", async () => {
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    render(<StatusBadge status="maintenance" />);
    expect(screen.getByText("Under maintenance")).toBeInTheDocument();
  });
});
