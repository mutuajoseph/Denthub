import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AuthModal } from "./AuthModal";

vi.mock("../lib/auth", () => ({
  login: vi.fn(),
  register: vi.fn(),
}));

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

describe("AuthModal dark mode", () => {
  it("renders every auth view with theme tokens instead of hardcoded colours", async () => {
    const user = userEvent.setup();
    const { container } = render(<AuthModal onClose={vi.fn()} />);

    expect(container.querySelector("dialog")).not.toBeNull();
    expect(screen.getByText("Welcome back to DentHub Kenya")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /forgot password/i }));
    expect(screen.getByText("Forgot your password?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /back to sign in/i }));
    await user.click(screen.getByRole("button", { name: /continue with phone number/i }));
    expect(screen.getByText(/sign in with phone/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /back to sign in/i }));
    await user.click(screen.getByRole("button", { name: /^register$/i }));
    expect(screen.getByText("Join DentHub Kenya")).toBeInTheDocument();

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

  it("paints the modal surfaces with theme-aware tokens", () => {
    const { container } = render(<AuthModal onClose={vi.fn()} />);
    const dialog = container.querySelector("dialog");

    expect(dialog?.className).toContain("bg-auth-surface");
    expect(container.firstElementChild?.className).toContain("bg-auth-scrim");
  });

  it("defines every auth token in both the light and dark blocks", () => {
    const css = readGlobalCss();
    const theme = blockOf(css, "@theme");
    const light = blockOf(css, ":root");
    const dark = blockOf(css, ".dark");

    const declared = [...theme.matchAll(/--color-auth-([a-z-]+):/g)].map((match) => match[1]);

    expect(declared.length).toBeGreaterThan(0);

    for (const token of declared) {
      expect(light, `light block is missing --auth-${token}`).toMatch(
        new RegExp(`--auth-${token}:\\s*(#[0-9a-f]{3,8})`, "i"),
      );
      expect(dark, `dark block is missing --auth-${token}`).toMatch(
        new RegExp(`--auth-${token}:\\s*(#[0-9a-f]{3,8})`, "i"),
      );
    }
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<AuthModal onClose={onClose} />);
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
