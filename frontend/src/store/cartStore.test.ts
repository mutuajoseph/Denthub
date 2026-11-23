import { beforeEach, describe, expect, it } from "vitest";

import { type AddCartItemInput, selectCartSubtotal, useCartStore } from "./cartStore";

function addLine(overrides: Partial<AddCartItemInput> = {}) {
  useCartStore.getState().addItem({
    productId: "p1",
    name: "Adult Medium Toothbrush",
    supplierId: "s1",
    supplierName: "Nairobi Dental Supplies",
    supplierUserId: "user-s1",
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

  it("keeps one line per product when it is added in both modes", () => {
    addLine({
      retailUnitPrice: "350.00",
      wholesaleUnitPrice: "262.50",
      wholesaleMinQty: 12,
    });
    addLine({
      purchaseMode: "wholesale",
      unitPrice: "262.50",
      retailUnitPrice: "350.00",
      wholesaleUnitPrice: "262.50",
      quantity: 12,
      wholesaleMinQty: 12,
    });

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      cartLineId: "p1",
      purchaseMode: "wholesale",
      quantity: 12,
      unitPrice: "262.50",
    });
  });

  it("reprices from the API strings when quantity crosses the threshold", () => {
    addLine({
      purchaseMode: "wholesale",
      unitPrice: "262.50",
      retailUnitPrice: "350.00",
      wholesaleUnitPrice: "262.50",
      quantity: 12,
      wholesaleMinQty: 12,
    });

    useCartStore.getState().updateQuantity("p1", 11);
    expect(useCartStore.getState().items[0]).toMatchObject({
      purchaseMode: "retail",
      unitPrice: "350.00",
    });

    useCartStore.getState().updateQuantity("p1", 12);
    expect(useCartStore.getState().items[0]).toMatchObject({
      purchaseMode: "wholesale",
      unitPrice: "262.50",
    });
  });
});
