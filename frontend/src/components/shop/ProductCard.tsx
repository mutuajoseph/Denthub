import { motion } from "framer-motion";
import { Package, ShoppingCart } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

import { type Product, hasWholesale, unitPriceForMode } from "../../lib/productApi";
import type { PurchaseMode } from "../../store/cartStore";
import { useCartStore } from "../../store/cartStore";
import { cn } from "../../utils/cn";
import { formatPrice } from "../../utils/formatCurrency";
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
      className="card-hover group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-navy-600 dark:bg-navy-800"
    >
      <div className="relative h-40 overflow-hidden">
        <ProductImage src={product.imageUrl} alt={product.name} category={product.category} />

        {wholesaleAvailable && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md border border-orange-300 bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-orange-600 dark:border-gold-400/30 dark:bg-navy-900/80 dark:text-gold-300">
            <Package className="h-3 w-3" aria-hidden="true" />
            Wholesale
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.dentistRecommended && (
          <span className="self-start rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 font-mono text-xs font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            Dentist Recommended
          </span>
        )}

        {product.brand && (
          <p className="font-mono text-xs text-slate-500 dark:text-gray-400">{product.brand}</p>
        )}

        <h3 className="font-heading text-sm font-semibold leading-tight text-[#172b4d] dark:text-white">
          {product.name}
        </h3>

        {product.description && (
          <p className="line-clamp-2 text-xs text-slate-600 dark:text-gray-400">
            {product.description}
          </p>
        )}

        <p className="text-[11px] text-slate-500 dark:text-gray-400">
          Sold by <span className="font-medium">{product.supplier.name}</span>
        </p>

        {wholesaleAvailable && (
          <fieldset className="flex rounded-lg border border-slate-200 p-0.5 text-xs dark:border-navy-600">
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
                    "flex-1 rounded-md py-1.5 font-medium capitalize transition-colors",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold-400",
                    isActive
                      ? "bg-orange-100 text-orange-600 dark:bg-gold-400/20 dark:text-gold-300"
                      : "text-slate-500 hover:text-[#172b4d] dark:text-gray-400 dark:hover:text-white",
                  )}
                >
                  {option}
                </button>
              );
            })}
          </fieldset>
        )}

        <div className="mt-auto pt-1">
          <p className="text-lg font-bold text-orange-500 dark:text-gold-400">
            {formatPrice(activePrice, currency)}
          </p>

          {wholesaleAvailable && wholesalePrice !== null && (
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-gray-400">
              {mode === "wholesale"
                ? `Min order ${minQty} units · clinics & bulk buyers`
                : `Wholesale from ${formatPrice(wholesalePrice, currency)} · min ${minQty} units`}
            </p>
          )}
        </div>

        <div className="pt-2">
          <Button
            size="sm"
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
