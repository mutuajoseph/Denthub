import { CheckCircle2 } from "lucide-react";

import { useSiteContentStore } from "../../store/siteContentStore";
import { cn } from "../../utils/cn";
import { formatPrice } from "../../utils/formatCurrency";
import Badge from "../ui/Badge";
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
      <h2 id="subscription-heading" className="mb-2 font-display text-2xl font-semibold text-ink">
        {title}
      </h2>
      <p className="mb-8 text-slate">{subtitle}</p>

      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className={cn(
              "card-hover rounded-card border bg-paper p-6",
              tier.popular ? "border-ink" : "border-steel",
            )}
          >
            {tier.popular && <Badge variant="ink">Most Popular</Badge>}

            <h3 className="mt-2 font-heading text-xl font-semibold text-ink">{tier.name}</h3>

            <p className="mt-2 text-2xl font-semibold text-ink">
              {formatPrice(tier.price, currency)}
              <span className="text-sm font-normal text-slate">/mo</span>
            </p>

            <ul className="mt-4 space-y-2 text-sm text-charcoal">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-charcoal" aria-hidden="true" />
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
