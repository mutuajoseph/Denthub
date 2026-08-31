import { Link } from "react-router-dom";
import { useCountryConfig } from "../../hooks/useCountryConfig";
import { useSiteContentStore } from "../../store/siteContentStore";
import { renderIcon } from "../../utils/iconMap";
import { searchBySubdivisionDesc } from "../../utils/subdivisionCopy";

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
    <section className="py-16 mx-auto max-w-7xl px-4 lg:px-6">
      <h2 className="font-display text-3xl font-bold text-center mb-12 text-slate-900 dark:text-white">
        {title}
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stepsWithLocale.map((step) => (
          <div
            key={step.title}
            className="text-center rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] card-hover dark:border-navy-600 dark:bg-navy-800"
          >
            <span className="inline-flex items-center justify-center rounded-full bg-orange-50 w-16 h-16 mx-auto text-orange-500 dark:bg-navy-900 dark:text-gold-400">
              {renderIcon(step.icon || step.emoji, { className: "w-7 h-7" })}
            </span>
            <h3 className="font-heading font-semibold mt-4 text-slate-900 dark:text-white">
              {step.title}
            </h3>
            <p className="text-sm text-slate-500 mt-2 dark:text-gray-400">{step.desc}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-4 mt-10 flex-wrap">
        <Link
          to="/dentists"
          className="text-orange-500 hover:underline text-sm font-medium dark:text-gold-400"
        >
          Explore Dentists →
        </Link>
        <Link
          to="/shop"
          className="text-orange-500 hover:underline text-sm font-medium dark:text-gold-400"
        >
          Browse Shop →
        </Link>
      </div>
    </section>
  );
}
