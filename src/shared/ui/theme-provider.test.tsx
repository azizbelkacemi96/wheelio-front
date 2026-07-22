import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider, useTheme } from "./theme-provider";

const STORAGE_KEY = "wheelio-ui-theme";

function ThemeProbe() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button onClick={() => setTheme("dark")}>set-dark</button>
      <button onClick={() => setTheme("light")}>set-light</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("light", "dark");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("light", "dark");
  });

  it("setTheme('dark') adds the dark class to the document element and persists to localStorage", async () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(document.documentElement.classList.contains("dark")).toBe(false);

    await act(async () => {
      screen.getByText("set-dark").click();
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("persists the theme across a re-mount (simulated reload)", async () => {
    const { unmount } = render(
      <ThemeProvider defaultTheme="light">
        <ThemeProbe />
      </ThemeProvider>
    );

    await act(async () => {
      screen.getByText("set-dark").click();
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");

    unmount();
    document.documentElement.classList.remove("light", "dark");

    render(
      <ThemeProvider defaultTheme="light">
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByTestId("theme-value").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("setTheme('light') removes the dark class", async () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await act(async () => {
      screen.getByText("set-light").click();
    });

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
  });
});
