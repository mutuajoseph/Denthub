import { motion } from "framer-motion";
import { Package, ShoppingCart } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

import { type Product, hasWholesale, unitPriceForMode } from "../../lib/productApi";
import type { PurchaseMode } from "../../store/cartStore";
import { useCartStore } from "../../store/cartStore";
import { cn } from "../../utils/cn";
import { formatPrice } from "../../utils/formatCurrency";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import ProductImage from "./ProductImage";

interface ProductCardProps {
  product: Product;
}

const MODES: PurchaseMode[] = ["retail", "wholesale"];

/**
 * Catalog card.
 *
 * The retail/wholesale toggle picks between two prices the **server** already
 * returned; it applies no discount of its own. The chosen price is frozen into
 * the cart line on add, matching the source behaviour, and the wholesale
 * minimum stays advisory — the cart drawer is what warns about it.
 */
export default function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [mode, setMode] = useState<PurchaseMode>("retail");

  const wholesaleAvailable = hasWholesale(product);
  const currency = product.pricing.currency;
  const minQty = product.pricing.wholesaleMinQty;
  const activePrice = unitPriceForMode(product, mode);
  const wholesalePrice = product.pricing.wholesalePrice;

  const handleAdd = () => {
    addItem({
      productId: product.id,
      name: product.name,
      unitPrice: activePrice,
      purchaseMode: mode,
      // Freeze the API's currency on the line so the global drawer can label
      // the cart even when it is opened from a page with no catalog response.
      currency,
      ...(product.brand === null ? {} : { brand: product.brand }),
      ...(product.imageUrl === null ? {} : { image: product.imageUrl }),
      ...(wholesaleAvailable ? { wholesaleMinQty: minQty } : {}),
    });

    toast.success(mode === "wholesale" ? "Wholesale added to cart" : "Added to cart");
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-hover group relative flex flex-col overflow-hidden rounded-card border border-steel bg-paper"
    >
      <div className="relative h-40 overflow-hidden">
        <ProductImage src={product.imageUrl} alt={product.name} category={product.category} />

        {wholesaleAvailable && (
          <Badge variant="neutral" className="absolute left-2 top-2">
            <Package className="h-3 w-3" aria-hidden="true" />
            Wholesale
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.dentistRecommended && <Badge variant="success">Dentist Recommended</Badge>}

        {product.brand && <p className="font-mono text-xs text-slate">{product.brand}</p>}

        <h3 className="font-heading text-sm font-semibold leading-tight text-ink">
          {product.name}
        </h3>

        {product.description && (
          <p className="line-clamp-2 text-xs text-slate">{product.description}</p>
        )}

        <p className="text-[11px] text-slate">
          Sold by <span className="font-medium text-charcoal">{product.supplier.name}</span>
        </p>

        {wholesaleAvailable && (
          <fieldset className="flex rounded-button border border-steel bg-cloud p-0.5 text-xs">
            <legend className="sr-only">Purchase mode for {product.name}</legend>
            {MODES.map((option) => {
              const isActive = option === mode;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMode(option)}
                  aria-pressed={isActive}
                  className={cn(
                    "flex-1 rounded-button py-1.5 font-medium capitalize transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink",
                    isActive ? "bg-ink text-paper" : "text-slate hover:text-ink",
                  )}
                >
                  {option}
                </button>
              );
            })}
          </fieldset>
        )}

        <div className="mt-auto pt-1">
          <p className="text-lg font-semibold text-ink">{formatPrice(activePrice, currency)}</p>

          {wholesaleAvailable && wholesalePrice !== null && (
            <p className="mt-0.5 text-[11px] text-slate">
              {mode === "wholesale"
                ? `Min order ${minQty} units · clinics & bulk buyers`
                : `Wholesale from ${formatPrice(wholesalePrice, currency)} · min ${minQty} units`}
            </p>
          )}
        </div>

        <div className="pt-2">
          <Button
            size="sm"
            variant="graphite"
            icon={ShoppingCart}
            onClick={handleAdd}
            className="w-full"
            aria-label={
              mode === "wholesale"
                ? `Add wholesale: ${product.name}`
                : `Add to cart: ${product.name}`
            }
          >
            Add{mode === "wholesale" ? " wholesale" : " to cart"}
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
