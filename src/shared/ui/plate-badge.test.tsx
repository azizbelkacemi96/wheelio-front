import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlateBadge } from "./plate-badge";

describe("PlateBadge", () => {
  it("renders the plate number as text and exposes it as the accessible label", () => {
    render(<PlateBadge plate="00123-116-16" />);
    expect(screen.getByText("00123-116-16")).toBeInTheDocument();
    expect(screen.getByLabelText("00123-116-16")).toBeInTheDocument();
  });

  it("renders the DZ euroband as decorative (aria-hidden)", () => {
    const { container } = render(<PlateBadge plate="00456-119-16" />);
    const band = container.querySelector('[aria-hidden="true"]');
    expect(band?.textContent).toBe("DZ");
  });
});
