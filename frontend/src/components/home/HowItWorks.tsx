import { ArrowRight } from "lucide-react";
import { useCountryConfig } from "../../hooks/useCountryConfig";
import { useSiteContentStore } from "../../store/siteContentStore";
import { renderIcon } from "../../utils/iconMap";
import { searchBySubdivisionDesc } from "../../utils/subdivisionCopy";
import Button from "../ui/Button";

/** Ink band: the steps drawn as one route, each stop a node on the line. */
export default function HowItWorks() {
  const title = useSiteContentStore((s) => s.home.howItWorksTitle);
  const steps = useSiteContentStore((s) => s.home.howItWorksSteps);
  const { subdivisionLabel, insuranceSchemeLabel, insuranceEnabled } = useCountryConfig();

  const stepsWithLocale = steps.map((step, i) =>
    i === 0
      ? {
          ...step,
          desc: searchBySubdivisionDesc(
            subdivisionLabel,
            insuranceEnabled ? insuranceSchemeLabel : null,
          ),
        }
      : step,
  );

  return (
    <section className="bg-ink text-paper" aria-labelledby="how-it-works-heading">
      <div className="mx-auto grid w-full max-w-7xl gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:gap-20 lg:px-8 lg:py-28">
        <div className="lg:sticky lg:top-40 lg:self-start">
          <h2
            id="how-it-works-heading"
            className="max-w-[10ch] font-display text-[2.5rem] font-medium leading-none tracking-[-0.04em] sm:text-display-section"
          >
            {title}
          </h2>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button to="/dentists" variant="translucent" size="lg" trailingIcon={ArrowRight}>
              Explore Dentists
            </Button>
            <Button to="/shop" variant="translucent" size="lg" trailingIcon={ArrowRight}>
              Browse Shop
            </Button>
          </div>
        </div>

        <ol className="relative">
          <span
            className="absolute bottom-8 left-[19px] top-8 w-px bg-white/15"
            aria-hidden="true"
          />
          {stepsWithLocale.map((step) => (
            <li key={step.title} className="relative flex gap-6 pb-10 last:pb-0">
              <span
                className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-button bg-graphite text-paper shadow-edge"
                aria-hidden="true"
              >
                {renderIcon(step.icon || step.emoji, { className: "h-[18px] w-[18px]" })}
              </span>
              <div className="min-w-0 pt-0.5">
                <h3 className="font-display text-feature-heading font-medium">{step.title}</h3>
                <p className="mt-2 max-w-[44ch] text-base leading-[1.5] text-paper/60">
                  {step.desc}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
