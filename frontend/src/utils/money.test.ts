import { describe, expect, it } from "vitest";

import { addMoney, isMoneyAmount, multiplyMoney, sumMoney } from "./money";

describe("addMoney", () => {
  it("adds decimals exactly where IEEE754 drifts", () => {
    // 0.1 + 0.2 === 0.30000000000000004 as a float.
    expect(addMoney("0.10", "0.20")).toBe("0.30");
  });

  it("keeps the finer scale of the two operands", () => {
    expect(addMoney("1", "0.005")).toBe("1.005");
  });

  it("handles negatives", () => {
    expect(addMoney("10.00", "-3.25")).toBe("6.75");
  });

  it("treats unparseable input as zero rather than producing NaN", () => {
    expect(addMoney("not-money", "5.00")).toBe("5.00");
  });
});

describe("multiplyMoney", () => {
  it("multiplies by an integer quantity without a float round-trip", () => {
    expect(multiplyMoney("262.50", 4)).toBe("1050.00");
  });

  it("keeps the exact scale of the amount", () => {
    expect(multiplyMoney("350.00", 3)).toBe("1050.00");
  });

  it("rejects a non-integer factor rather than guessing", () => {
    expect(multiplyMoney("10.00", 1.5)).toBe("0.00");
  });
});

describe("sumMoney", () => {
  it("sums a whole cart exactly", () => {
    expect(sumMoney(["350.00", "262.50", "0.10"])).toBe("612.60");
  });

  it("is zero for an empty cart", () => {
    expect(sumMoney([])).toBe("0.00");
  });
});

describe("isMoneyAmount", () => {
  it("accepts what the API emits and rejects the rest", () => {
    expect(isMoneyAmount("1500.50")).toBe(true);
    expect(isMoneyAmount("0")).toBe(true);
    expect(isMoneyAmount("-12.34")).toBe(true);
    expect(isMoneyAmount("")).toBe(false);
    expect(isMoneyAmount("12,34")).toBe(false);
    expect(isMoneyAmount("NaN")).toBe(false);
  });
});
