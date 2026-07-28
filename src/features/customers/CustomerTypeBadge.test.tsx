/**
 * CustomerTypeBadge (CUST-03): one token-mapped Badge per backend customer
 * type — label ALWAYS from i18n (FR default), raw enum strings never reach
 * the DOM (D-06). The style map is Record<CustomerType, string>, so a new
 * backend type value fails tsc before it can fail here.
 */
import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import i18n from "@/shared/i18n";
import type { CustomerType } from "@/types/customer";
import { CustomerTypeBadge } from "./CustomerTypeBadge";

const cases: Array<{ type: CustomerType; frLabel: string }> = [
  { type: "individual", frLabel: "Particulier" },
  { type: "company", frLabel: "Entreprise" },
];

describe("CustomerTypeBadge", () => {
  it.each(cases)(
    "renders the translated FR label for '$type'",
    ({ type, frLabel }) => {
      render(<CustomerTypeBadge type={type} />);

      const badge = screen.getByText(frLabel);
      expect(badge).toBeInTheDocument();
      // The raw backend enum value never reaches the DOM (D-06).
      expect(badge.textContent).not.toBe(type);
    },
  );

  it("renders the EN label after a locale switch", async () => {
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    render(<CustomerTypeBadge type="company" />);
    expect(screen.getByText("Company")).toBeInTheDocument();

    await act(async () => {
      await i18n.changeLanguage("fr");
    });
  });
});
