import { describe, expect, it } from "vitest";
import { initialsOf } from "./initials";

describe("initialsOf", () => {
  it("drops the Dr. title and keeps two uppercase initials", () => {
    expect(initialsOf("Dr. Wanjiku Kamau")).toBe("WK");
    expect(initialsOf("dr amina njeri wanjohi")).toBe("AN");
  });

  it("handles single names and stray whitespace", () => {
    expect(initialsOf("  SmileCare  ")).toBe("S");
  });
});
