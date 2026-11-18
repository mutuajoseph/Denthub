import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CountryConfig } from "../lib/countryConfigApi";
import { useCountryConfigStore } from "../store/countryConfigStore";
import { useRegionStore } from "../store/regionStore";
import { AuthModal } from "./AuthModal";

vi.mock("../lib/auth", () => ({
  login: vi.fn(),
  register: vi.fn(),
}));

const ukConfig: CountryConfig = {
  code: "GB",
  name: "United Kingdom",
  currency: "GBP",
  currencySymbol: "£",
  locale: "en-GB",
  geography: { subdivisionLabel: "County", subdivisionPlural: "Counties", cityLabel: "City" },
  features: {},
  featureConfigs: {},
  featureContexts: {},
  insuranceProviders: [],
  regions: [],
};

function WithQueryClient({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

type StyleRule = { selector: string; className: string };

function collectStyledElements(container: HTMLElement): StyleRule[] {
  return Array.from(container.querySelectorAll<HTMLElement>("*"))
    .filter((element) => element.className.length > 0)
    .map((element) => ({ selector: element.tagName.toLowerCase(), className: element.className }));
}

function readGlobalCss(): string {
  // `import.meta.url` is not a file: URL under the jsdom environment.
  return readFileSync(resolve(process.cwd(), "src/global.css"), "utf8");
}

function blockOf(css: string, header: string): string {
  // Anchor on a real `header {` block so a bare substring match cannot pick up
  // `@custom-variant dark (&:where(.dark, ...))` instead of the `.dark` block.
  const pattern = new RegExp(
    `(?:^|\\n)\\s*${header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
    "m",
  );
  const match = pattern.exec(css);

  expect(match, `expected to find a "${header} { ... }" block in global.css`).not.toBeNull();

  return match?.[1] ?? "";
}

describe("AuthModal theming", () => {
  it("renders every auth view with theme tokens instead of hardcoded colours", async () => {
    const user = userEvent.setup();
    const { container } = render(<AuthModal onClose={vi.fn()} />, { wrapper: WithQueryClient });

    expect(container.querySelector("dialog")).not.toBeNull();
    expect(screen.getByText("Welcome back to DentHub")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /forgot password/i }));
    expect(screen.getByText("Forgot your password?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /back to sign in/i }));
    await user.click(screen.getByRole("button", { name: /continue with phone number/i }));
    expect(screen.getByText(/sign in with phone/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /back to sign in/i }));
    await user.click(screen.getByRole("button", { name: /^register$/i }));
    expect(screen.getByText("Join DentHub")).toBeInTheDocument();

    const styled = collectStyledElements(container);

    expect(styled.length).toBeGreaterThan(10);

    for (const { selector, className } of styled) {
      // A raw hex in a className is a light-mode-only colour by definition.
      expect(className, `${selector} uses a hardcoded hex: ${className}`).not.toMatch(/\[#/);
      expect(className, `${selector} hardcodes the light surface: ${className}`).not.toMatch(
        /\bbg-white\b/,
      );
    }
  });

  it("paints the modal surfaces with design tokens", () => {
    const { container } = render(<AuthModal onClose={vi.fn()} />, { wrapper: WithQueryClient });
    const dialog = container.querySelector("dialog");

    expect(dialog?.className).toContain("bg-paper");
    expect(container.firstElementChild?.className).toContain("bg-ink/60");
  });

  it("uses the design tokens and leaves no interim auth-theming shim behind", () => {
    const css = readGlobalCss();
    const theme = blockOf(css, "@theme");

    for (const token of [
      "paper",
      "ink",
      "graphite",
      "cloud",
      "steel",
      "slate",
      "charcoal",
      "aqua-relay",
    ]) {
      const declared = new RegExp(`--color-${token}:\\s*([^;]+);`).exec(theme);
      expect(declared?.[1], `--color-${token} should be a hex colour`).toMatch(/^#[0-9a-f]{3,8}$/i);
    }
    // The auth revamp moved off the interim auth-* tokens (#11 phase 4).
    expect(theme).not.toMatch(/--color-auth-/);
    // Light-only (docs/design/DESIGN.md): no dark palette to fall out of sync.
    expect(css).not.toMatch(/^\.dark\s*\{/m);
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<AuthModal onClose={onClose} />, { wrapper: WithQueryClient });
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reflects the active region brand and contains no hardcoded country names", () => {
    act(() => {
      useRegionStore.setState({ regionCode: "GB", hasManualSelection: true });
      useCountryConfigStore.setState({ config: ukConfig, regions: [], lastCountry: "GB" });
    });

    const { container } = render(<AuthModal onClose={vi.fn()} />, { wrapper: WithQueryClient });
    const heading = screen.getByRole("heading", { level: 1 });

    expect(heading).toHaveTextContent("DentHub");
    expect(container.textContent).not.toMatch(/Kenya/i);

    act(() => {
      useRegionStore.setState({ regionCode: null, hasManualSelection: false });
      useCountryConfigStore.setState({ config: null });
    });
  });
});
