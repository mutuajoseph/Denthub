import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Button from "./Button";

describe("Button focus ring", () => {
  it("uses an ink outline on light surfaces", () => {
    render(<Button>Find a Dentist</Button>);

    expect(screen.getByRole("button").className).toContain("focus-visible:outline-ink");
  });

  it("switches to a paper outline for the dark-surface variant", () => {
    render(<Button variant="translucent">Explore Dentists</Button>);
    const { className } = screen.getByRole("button");

    expect(className).toContain("focus-visible:outline-paper");
    expect(className).not.toContain("focus-visible:outline-ink");
  });
});
