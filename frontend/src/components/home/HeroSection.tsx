import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, MapPin, Search, ShieldCheck, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import portraitAvif from "../../assets/home/dentist-portrait.avif";
import portraitPng from "../../assets/home/dentist-portrait.png";
import { useCountryConfig } from "../../hooks/useCountryConfig";
import { useRegion } from "../../hooks/useRegion";
import { type HeroCard, useSiteContentStore } from "../../store/siteContentStore";
import Button from "../ui/Button";
import StarRating from "../ui/StarRating";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

type Capability = { icon: LucideIcon; label: string };

function CapabilityRow({ items }: { items: Capability[] }) {
  return (
    <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-3" aria-label="What you can do">
      {items.map(({ icon: Icon, label }) => (
        <li key={label} className="flex items-center gap-2 text-sm font-medium text-ink">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-graphite"
            aria-hidden="true"
          >
            <Icon className="h-3 w-3 text-paper" strokeWidth={2} />
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}

/** The example dentist from the Site CMS, drawn as the Graphite tile. */
function MatchTile({ card, onBook }: { card: HeroCard; onBook: () => void }) {
  const initials = card.name
    .replace(/^Dr\.?\s+/i, "")
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2);

  return (
    <div className="rounded-card bg-graphite p-4 text-paper shadow-card-graphite">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-button bg-ink font-display text-base font-medium text-paper shadow-edge"
            aria-hidden="true"
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold leading-tight">{card.name}</p>
            <p className="mt-1 line-clamp-2 text-sm text-paper/60">{card.clinicLine}</p>
          </div>
        </div>
        <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-paper/60">
          Example
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <StarRating rating={card.rating} tone="inverse" />
        <ul className="flex flex-wrap gap-1.5" aria-label="Specialties">
          {card.specialties.map((spec) => (
            <li
              key={spec}
              className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-paper shadow-edge"
            >
              {spec}
            </li>
          ))}
        </ul>
      </div>
      <Button variant="translucent" size="md" className="mt-4 w-full" onClick={onBook}>
        Book Now
      </Button>
    </div>
  );
}

function SheetRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-t border-steel py-3 first:border-t-0">
      <dt className="font-mono text-xs uppercase tracking-[0.06em] text-slate">{label}</dt>
      <dd className="truncate text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

/** Cut-out dentist portrait (see assets/home/CREDITS.md). Decorative. */
function Portrait({ className }: { className: string }) {
  return (
    <picture>
      <source srcSet={portraitAvif} type="image/avif" />
      <img
        src={portraitPng}
        alt=""
        width={533}
        height={960}
        loading="lazy"
        decoding="async"
        className={`pointer-events-none w-auto select-none ${className}`}
      />
    </picture>
  );
}

/**
 * Phone version of the diagram: the portrait on its drafting panel, with the
 * match tile overlapping the panel's foot so the photo's straight crop never
 * shows.
 */
function MobileStage({ card, onBook }: { card: HeroCard; onBook: () => void }) {
  return (
    <div className="mx-auto mt-12 max-w-md lg:hidden">
      <div className="relative h-[280px]">
        <div
          className="construction-grid absolute inset-x-0 bottom-0 top-16 rounded-card bg-cloud ring-1 ring-inset ring-steel"
          aria-hidden="true"
        />
        <Portrait className="absolute bottom-0 right-[14%] h-[280px]" />
      </div>
      <div className="relative z-10 -mt-24 px-3">
        <MatchTile card={card} onBook={onBook} />
      </div>
    </div>
  );
}

/**
 * Layered drafting diagram (DESIGN.md "Layered Payment Diagram"), retold for
 * care: a search sheet routes, along a signal line, to a matched dentist.
 */
function RoutingDiagram({
  card,
  subdivisionLabel,
  insurer,
  countryName,
  onBook,
}: {
  card: HeroCard;
  subdivisionLabel: string;
  insurer: string | null;
  countryName: string;
  onBook: () => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative mx-auto h-[540px] w-full max-w-[560px]">
      {/* Back sheet: the drafting paper. */}
      <div
        className="construction-grid absolute left-2 right-10 top-16 bottom-16 -rotate-[2.5deg] rounded-card bg-cloud ring-1 ring-inset ring-steel"
        aria-hidden="true"
      />

      {/* Portrait stage; the dentist stands on it and rises above its top edge. */}
      <div
        className="absolute bottom-16 right-0 top-[110px] w-[300px] rounded-card bg-cloud ring-1 ring-inset ring-steel"
        aria-hidden="true"
      />
      <Portrait className="absolute bottom-16 right-5 h-[470px]" />

      {/* Search sheet. */}
      <div className="absolute left-0 top-10 z-10 w-[280px] rounded-card bg-paper p-4 shadow-card-cloud">
        <div className="flex items-center gap-2 pb-3">
          <Search className="h-4 w-4 text-ink" strokeWidth={1.8} aria-hidden="true" />
          <p className="text-sm font-semibold text-ink">Find a dentist</p>
          <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.06em] text-slate">
            {countryName}
          </span>
        </div>
        <dl>
          <SheetRow label="Specialty" value={card.specialties.join(", ")} />
          <SheetRow label={subdivisionLabel} value="Near you" />
          {insurer && <SheetRow label="Insurer" value={insurer} />}
        </dl>
      </div>

      {/* Signal route from the search sheet down to the match. */}
      <svg
        className="absolute left-[40px] top-[212px] z-10 h-[150px] w-[60px] overflow-visible"
        viewBox="0 0 60 150"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="signal-sweep" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.52" style={{ stopColor: "var(--color-signal-sweep)" }} />
            <stop offset="1" style={{ stopColor: "var(--color-signal-sweep-end)" }} />
          </linearGradient>
        </defs>
        <motion.path
          d="M2 2 V50 Q2 60 12 60 H36 Q46 60 46 70 V150"
          stroke="url(#signal-sweep)"
          strokeWidth="2"
          strokeLinecap="round"
          initial={reduceMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, delay: 0.25, ease: EASE_OUT_EXPO }}
        />
        <circle cx="2" cy="2" r="4" className="fill-ink" />
        <circle cx="2" cy="2" r="2" className="fill-aqua-relay" />
      </svg>

      {/* The match, floating in front of the stage. */}
      <motion.div
        className="absolute bottom-0 left-0 z-20 w-[320px]"
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.85, ease: EASE_OUT_EXPO }}
      >
        <MatchTile card={card} onBook={onBook} />
      </motion.div>
    </div>
  );
}

export default function HeroSection() {
  const navigate = useNavigate();
  const { region } = useRegion();
  const heroCard = useSiteContentStore((s) => s.home.heroCard);
  const { subdivisionLabel, insuranceEnabled, insuranceSchemeLabel } = useCountryConfig();
  const areaLabel = subdivisionLabel || "Area";
  const insurer = insuranceEnabled ? insuranceSchemeLabel : null;
  const goToDentists = () => navigate("/dentists");

  const capabilities: Capability[] = [
    { icon: MapPin, label: `Search by ${areaLabel.toLowerCase()} & specialty` },
    insurer
      ? { icon: ShieldCheck, label: `Filter by ${insurer}` }
      : { icon: ShieldCheck, label: "Compare ratings & reviews" },
    { icon: ShoppingBag, label: "Retail & wholesale oral care" },
  ];

  return (
    <section className="relative overflow-hidden bg-paper" aria-labelledby="hero-heading">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="min-w-0">
          <h1
            id="hero-heading"
            className="max-w-[12ch] font-display text-[2.75rem] font-normal leading-[0.95] tracking-[-0.04em] text-ink sm:text-6xl lg:text-display-hero"
          >
            {region.heroHeadline}
          </h1>
          <p className="mt-6 max-w-[46ch] text-base leading-[1.5] text-slate sm:text-lg">
            {region.tagline}
          </p>
          {region.logoTagline && (
            <p className="mt-2 max-w-[46ch] text-base leading-[1.5] text-slate">
              {region.logoTagline}
            </p>
          )}

          <CapabilityRow items={capabilities} />

          <div className="mt-10 flex flex-wrap gap-3">
            <Button to="/dentists" size="lg" trailingIcon={ArrowRight}>
              Find a Dentist
            </Button>
            <Button to="/shop" variant="secondary" size="lg" icon={ShoppingBag}>
              Shop
            </Button>
          </div>

          <MobileStage card={heroCard} onBook={goToDentists} />
        </div>

        <div className="hidden lg:block">
          <RoutingDiagram
            card={heroCard}
            subdivisionLabel={areaLabel}
            insurer={insurer}
            countryName={region.countryName}
            onBook={goToDentists}
          />
        </div>
      </div>
    </section>
  );
}
