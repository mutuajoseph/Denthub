import { type FormEvent, useState } from "react";

import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import {
  useCreateProduct,
  useCreateStore,
  useMyProducts,
  useMyStore,
  useUpdateProduct,
} from "../hooks/useSupplierStore";
import type { StoreScope, SupplierProduct, SupplierStore } from "../lib/supplierApi";
import { formatListingPrice } from "../utils/formatCurrency";

const FIELD_SHELL =
  "flex min-h-[44px] items-center gap-2 rounded-button border border-steel bg-cloud px-3 transition focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/10";
const INPUT =
  "min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-ink outline-none placeholder:text-slate";
const LABEL = "text-xs font-medium text-charcoal";
const SELECT =
  "min-h-[44px] w-full rounded-button border border-steel bg-cloud px-3 text-sm text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10";
const TEXTAREA =
  "min-h-[88px] w-full rounded-button border border-steel bg-cloud px-3 py-2 text-sm text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10";

const SCOPE_LABELS: Record<StoreScope, string> = {
  local: "Local",
  international: "International",
};

/**
 * The supplier's own storefront (#78). A supplier account lands here from the
 * account menu's "My store": with no store yet it shows the create form; once a
 * store exists it manages only its own products, and money renders from the
 * exact decimal strings the API returned.
 */
export function SupplierDashboard() {
  const { store, isLoading, isError, error, refetch } = useMyStore();

  if (isLoading) {
    return (
      <section className="app-container py-16 text-center text-ink">
        <p className="font-heading text-lg font-semibold text-charcoal" aria-busy="true">
          Loading your store…
        </p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="app-container py-16 text-center text-ink" role="alert">
        <p className="font-heading text-lg font-semibold text-red-600">
          Could not load your store.
        </p>
        <p className="mt-2 text-sm text-slate">{error?.message}</p>
        <Button variant="secondary" className="mt-4" onClick={() => void refetch()}>
          Try again
        </Button>
      </section>
    );
  }

  if (!store) {
    return <CreateStoreForm />;
  }

  return <StoreView store={store} />;
}

function CreateStoreForm() {
  const createStore = useCreateStore();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<StoreScope>("local");
  const [description, setDescription] = useState("");

  const error = createStore.error;

  return (
    <section className="app-container py-8 text-ink lg:py-12">
      <header className="mb-6">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-[-0.03em] text-ink">
          Set up your store
        </h1>
        <p className="mt-2 text-sm text-slate">
          Create your storefront to start listing dental supplies. You can add products next.
        </p>
      </header>

      <Card tone="white" hover={false} className="max-w-[560px]">
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            createStore.mutate({
              name: name.trim(),
              scope,
              description: description.trim() || null,
            });
          }}
        >
          <label htmlFor="store-name" className={LABEL}>
            Store name
          </label>
          <div className={FIELD_SHELL}>
            <input
              id="store-name"
              type="text"
              required
              maxLength={150}
              placeholder="e.g. Acme Dental Supplies"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={INPUT}
            />
          </div>

          <label htmlFor="store-scope" className={`${LABEL} mt-1.5`}>
            Scope
          </label>
          <select
            id="store-scope"
            value={scope}
            onChange={(event) => setScope(event.target.value as StoreScope)}
            className={SELECT}
          >
            <option value="local">Local — sell in one market</option>
            <option value="international">International — sell across markets</option>
          </select>

          <label htmlFor="store-description" className={`${LABEL} mt-1.5`}>
            Description <span className="font-normal text-slate">(optional)</span>
          </label>
          <textarea
            id="store-description"
            maxLength={2000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={TEXTAREA}
          />

          {error && (
            <p
              role="alert"
              className="mt-2 rounded-button border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {error.message}
            </p>
          )}

          <div className="mt-4">
            <Button
              type="submit"
              variant="primary"
              disabled={createStore.isPending || name.trim() === ""}
            >
              {createStore.isPending ? "Creating…" : "Create store"}
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}

function StoreView({ store }: { store: SupplierStore }) {
  const products = useMyProducts();
  const [formFor, setFormFor] = useState<SupplierProduct | "new" | null>(null);

  return (
    <section className="app-container py-8 text-ink lg:py-12">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[32px] leading-tight font-semibold tracking-[-0.03em] text-ink">
              {store.name}
            </h1>
            {store.isVerified ? (
              <Badge variant="success">Verified</Badge>
            ) : (
              <Badge variant="neutral">Pending verification</Badge>
            )}
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-slate">
            <span className="font-mono text-xs">{store.slug}</span>
            <span aria-hidden="true">·</span>
            <span>{SCOPE_LABELS[store.scope]}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-xs">{store.countryCode}</span>
          </p>
        </div>

        {formFor === null && (
          <Button variant="primary" onClick={() => setFormFor("new")}>
            Add product
          </Button>
        )}
      </header>

      {store.description && (
        <p className="mb-6 max-w-[680px] text-sm text-slate">{store.description}</p>
      )}

      {formFor !== null && (
        <ProductForm
          key={formFor === "new" ? "new" : formFor.id}
          product={formFor === "new" ? null : formFor}
          onClose={() => setFormFor(null)}
        />
      )}

      <div className="mt-8">
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-ink">
          Products{products.isLoading ? "" : ` (${products.total})`}
        </h2>

        {products.isLoading ? (
          <p className="mt-4 text-sm text-slate" aria-busy="true">
            Loading products…
          </p>
        ) : products.isError ? (
          <div className="mt-4" role="alert">
            <p className="text-sm text-red-600">Could not load your products.</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void products.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : products.products.length === 0 ? (
          <p className="mt-4 text-sm text-slate">
            No products yet. Use “Add product” to list your first one.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {products.products.map((product) => (
              <li key={product.id}>
                <Card
                  tone="white"
                  hover={false}
                  className="flex flex-wrap items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
                        {product.name}
                      </h3>
                      {product.inStock ? (
                        <Badge variant="success">In stock</Badge>
                      ) : (
                        <Badge variant="neutral">Out of stock</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate">
                      {product.category}
                      {product.brand ? ` · ${product.brand}` : ""}
                    </p>
                    <p className="mt-2 text-sm font-medium text-ink">
                      {formatListingPrice(product.retailPrice, product.currency)}
                      {product.wholesalePrice && (
                        <span className="text-slate">
                          {" · wholesale "}
                          {formatListingPrice(product.wholesalePrice, product.currency)}
                          {` from ${product.wholesaleMinQty} units`}
                        </span>
                      )}
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setFormFor(product)}>
                    Edit
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

interface ProductFormProps {
  /** The product being edited, or `null` to list a new one. */
  product: SupplierProduct | null;
  onClose: () => void;
}

function ProductForm({ product, onClose }: ProductFormProps) {
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const isEdit = product !== null;

  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [retailPrice, setRetailPrice] = useState(product?.retailPrice ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [wholesalePrice, setWholesalePrice] = useState(product?.wholesalePrice ?? "");
  const [wholesaleMinQty, setWholesaleMinQty] = useState(String(product?.wholesaleMinQty ?? 12));
  const [inStock, setInStock] = useState(product?.inStock ?? true);

  const error = isEdit ? updateProduct.error : createProduct.error;
  const isPending = isEdit ? updateProduct.isPending : createProduct.isPending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const input = {
      name: name.trim(),
      category: category.trim(),
      retailPrice: retailPrice.trim(),
      brand: brand.trim() || null,
      wholesalePrice: wholesalePrice.trim() || null,
      wholesaleMinQty: Number(wholesaleMinQty) || 0,
      inStock,
    };

    if (isEdit && product) {
      updateProduct.mutate({ id: product.id, changes: input }, { onSuccess: onClose });
    } else {
      createProduct.mutate(input, { onSuccess: onClose });
    }
  };

  return (
    <Card tone="cloud" hover={false} className="mt-2">
      <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
        {isEdit ? "Edit product" : "List a new product"}
      </h2>

      <form className="mt-4 flex max-w-[560px] flex-col gap-1.5" onSubmit={handleSubmit}>
        <label htmlFor="product-name" className={LABEL}>
          Product name
        </label>
        <div className={FIELD_SHELL}>
          <input
            id="product-name"
            type="text"
            required
            maxLength={200}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={INPUT}
          />
        </div>

        <label htmlFor="product-category" className={`${LABEL} mt-1.5`}>
          Category
        </label>
        <div className={FIELD_SHELL}>
          <input
            id="product-category"
            type="text"
            required
            maxLength={50}
            placeholder="e.g. Restorative"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className={INPUT}
          />
        </div>

        <label htmlFor="product-brand" className={`${LABEL} mt-1.5`}>
          Brand <span className="font-normal text-slate">(optional)</span>
        </label>
        <div className={FIELD_SHELL}>
          <input
            id="product-brand"
            type="text"
            maxLength={120}
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
            className={INPUT}
          />
        </div>

        <div className="mt-1.5 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="product-retail-price" className={LABEL}>
              Retail price
            </label>
            <div className={FIELD_SHELL}>
              <input
                id="product-retail-price"
                type="text"
                inputMode="decimal"
                required
                placeholder="350.00"
                value={retailPrice}
                onChange={(event) => setRetailPrice(event.target.value)}
                className={INPUT}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="product-wholesale-price" className={LABEL}>
              Wholesale price <span className="font-normal text-slate">(optional)</span>
            </label>
            <div className={FIELD_SHELL}>
              <input
                id="product-wholesale-price"
                type="text"
                inputMode="decimal"
                placeholder="260.00"
                value={wholesalePrice}
                onChange={(event) => setWholesalePrice(event.target.value)}
                className={INPUT}
              />
            </div>
          </div>
        </div>

        <label htmlFor="product-wholesale-min-qty" className={`${LABEL} mt-1.5`}>
          Wholesale minimum quantity
        </label>
        <div className={FIELD_SHELL}>
          <input
            id="product-wholesale-min-qty"
            type="number"
            min={0}
            value={wholesaleMinQty}
            onChange={(event) => setWholesaleMinQty(event.target.value)}
            className={INPUT}
          />
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-charcoal">
          <input
            type="checkbox"
            checked={inStock}
            onChange={(event) => setInStock(event.target.checked)}
            className="h-4 w-4 rounded-[4px] border border-steel accent-ink"
          />
          In stock
        </label>

        {error && (
          <p
            role="alert"
            className="mt-2 rounded-button border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
          >
            {error.message}
          </p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <Button
            type="submit"
            variant="primary"
            disabled={isPending || name.trim() === "" || category.trim() === ""}
          >
            {isPending ? "Saving…" : isEdit ? "Save changes" : "List product"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
