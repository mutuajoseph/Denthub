import { beforeEach, describe, expect, it } from "vitest";

import { type AddCartItemInput, selectCartSubtotal, useCartStore } from "./cartStore";

function addLine(overrides: Partial<AddCartItemInput> = {}) {
  useCartStore.getState().addItem({
    productId: "p1",
    name: "Adult Medium Toothbrush",
    unitPrice: "350.00",
    purchaseMode: "retail",
    currency: "KES",
    ...overrides,
  });
}

describe("selectCartSubtotal", () => {
  beforeEach(() => useCartStore.getState().clearCart());

  it("sums lines exactly, without the IEEE754 drift of float arithmetic", () => {
    addLine({ productId: "p1", unitPrice: "0.10", quantity: 1 });
    addLine({ productId: "p2", unitPrice: "0.20", quantity: 1 });

    // 0.1 + 0.2 === 0.30000000000000004 as a float.
    expect(selectCartSubtotal(useCartStore.getState().items)).toBe("0.30");
  });

  it("multiplies each line by its quantity exactly", () => {
    addLine({ productId: "p1", unitPrice: "262.50", quantity: 4 });

    expect(selectCartSubtotal(useCartStore.getState().items)).toBe("1050.00");
  });

  it("is exactly zero for an empty cart", () => {
    expect(selectCartSubtotal(useCartStore.getState().items)).toBe("0.00");
  });
});
