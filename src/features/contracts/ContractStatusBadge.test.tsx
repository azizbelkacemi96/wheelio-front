/**
 * ContractStatusBadge (D-01): one token-mapped Badge per backend contract
 * status, label ALWAYS from i18n (FR default) — raw enum strings never reach
 * the DOM. The style map is Record<ContractStatus, string>, so enum drift
 * fails tsc before it can fail here. Mirrors fleet/StatusBadge.test.tsx.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import i18n from "@/shared/i18n";
import type { ContractStatus } from "@/types/rental";
import { ContractStatusBadge } from "./ContractStatusBadge";

beforeEach(async () => {
  await act(async () => {
    await i18n.changeLanguage("fr");
  });
});

const cases: Array<{
  status: ContractStatus;
  frLabel: string;
  enLabel: string;
  className: string;
}> = [
  {
    status: "reserved",
    frLabel: "Réservé",
    enLabel: "Reserved",
    className: "text-primary",
  },
  {
    status: "active",
    frLabel: "En cours",
    enLabel: "Active",
    className: "text-warning",
  },
  {
    status: "closed",
    frLabel: "Clôturé",
    enLabel: "Closed",
    className: "text-success",
  },
  {
    status: "cancelled",
    frLabel: "Annulé",
    enLabel: "Cancelled",
    className: "text-muted-foreground",
  },
];

describe("ContractStatusBadge", () => {
  it.each(cases)(
    "renders the translated FR label and token classes for '$status'",
    ({ status, frLabel, className }) => {
      render(<ContractStatusBadge status={status} />);

      const badge = screen.getByText(frLabel);
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain(className);
      // The raw backend enum value never reaches the DOM (D-01).
      expect(badge.textContent).not.toBe(status);
    },
  );

  it.each(cases)(
    "switches to the EN label for '$status' after a locale change",
    async ({ status, enLabel }) => {
      await act(async () => {
        await i18n.changeLanguage("en");
      });
      render(<ContractStatusBadge status={status} />);
      expect(screen.getByText(enLabel)).toBeInTheDocument();
    },
  );
});
