import { CheckCircle2 } from "lucide-react";

import { useSiteContentStore } from "../../store/siteContentStore";
import { cn } from "../../utils/cn";
import { formatPrice } from "../../utils/formatCurrency";
import Button from "../ui/Button";

interface SubscriptionBoxProps {
  /** Currency the catalog is priced in, from the API. */
  currency: string;
}

/**
 * Monthly subscription tiers.
 *
 * The source version was hardcoded to the dark palette, so it rendered as a
 * dark slab on the light page. These tiers are theme-aware and read from the
 * site-content store, which is where they already lived.
 */
export default function SubscriptionBox({ currency }: SubscriptionBoxProps) {
  const title = useSiteContentStore((state) => state.shop.subscriptionTitle);
  const subtitle = useSiteContentStore((state) => state.shop.subscriptionSubtitle);
  const tiers = useSiteContentStore((state) => state.shop.subscriptionTiers);

  if (tiers.length === 0) return null;

  return (
    <section className="mt-16" aria-labelledby="subscription-heading">
      <h2
        id="subscription-heading"
        className="mb-2 font-display text-2xl font-bold text-[#172b4d] dark:text-white"
      >
        {title}
      </h2>
      <p className="mb-8 text-slate-600 dark:text-gray-400">{subtitle}</p>

      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className={cn(
              "card-hover rounded-xl border bg-white p-6 dark:bg-navy-800",
              tier.popular
                ? "border-gold-400 shadow-gold dark:border-gold-400"
                : "border-slate-200 dark:border-navy-600",
            )}
          >
            {tier.popular && (
              <span className="font-mono text-xs uppercase tracking-wider text-orange-500 dark:text-gold-400">
                Most Popular
              </span>
            )}

            <h3 className="mt-2 font-heading text-xl font-bold text-[#172b4d] dark:text-white">
              {tier.name}
            </h3>

            <p className="mt-2 text-2xl font-bold text-orange-500 dark:text-gold-400">
              {formatPrice(tier.price, currency)}
              <span className="text-sm font-normal text-slate-500 dark:text-gray-400">/mo</span>
            </p>

            <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-gray-300">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <CheckCircle2
                    className="h-4 w-4 shrink-0 text-orange-500 dark:text-gold-400"
                    aria-hidden="true"
                  />
                  {feature}
                </li>
              ))}
            </ul>

            <Button
              className="mt-6 w-full"
              variant={tier.popular ? "primary" : "secondary"}
              onClick={() => {
                window.alert(`Subscriptions are not available yet. Coming soon: ${tier.name}.`);
              }}
            >
              Subscribe
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
