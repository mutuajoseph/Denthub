import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Search, ShoppingBag, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRegion } from "../../hooks/useRegion";
import { useSiteContentStore } from "../../store/siteContentStore";
import Button from "../ui/Button";
import StarRating from "../ui/StarRating";

function HeroHeadline({ headline }: { headline: string }) {
  const parts = headline.split(" Dental ");
  if (parts.length === 2) {
    return (
      <>
        {parts[0]} <span className="text-orange-500 dark:text-gold-400">Dental</span> {parts[1]}
      </>
    );
  }
  return <>{headline}</>;
}

export default function HeroSection() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { region } = useRegion();
  const heroCard = useSiteContentStore((s) => s.home.heroCard);
  const fade = reduceMotion
    ? {}
    : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

  return (
    <section
      className="relative min-h-[90vh] flex items-center overflow-hidden hero-bg text-slate-900 dark:text-white"
      aria-labelledby="hero-heading"
    >
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(245,166,35,0.08),transparent_60%)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-7xl px-4 py-16 lg:px-6 grid lg:grid-cols-2 gap-12 items-center w-full">
        <div>
          <motion.h1
            id="hero-heading"
            {...(reduceMotion
              ? {}
              : { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 } })}
            className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-tight"
          >
            <HeroHeadline headline={region.heroHeadline} />
          </motion.h1>
          <motion.p
            {...fade}
            transition={{ delay: 0.1 }}
            className="mt-4 text-lg text-slate-600 max-w-lg dark:text-gray-300"
          >
            {region.tagline}
          </motion.p>
          {region.logoTagline && (
            <p className="mt-3 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-orange-500/90 dark:text-gold-400/90">
              <span className="h-px w-6 bg-orange-500/60 dark:bg-gold-400/60" aria-hidden="true" />
              {region.logoTagline}
              <span className="h-px w-6 bg-gold-400/60" aria-hidden="true" />
            </p>
          )}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap gap-3 mt-8"
          >
            <Button to="/dentists" icon={Search}>
              Find a Dentist
            </Button>
            <Button to="/shop" variant="secondary" icon={ShoppingBag}>
              Shop
            </Button>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="flex flex-wrap gap-4 mt-8 text-xs text-slate-600 font-mono dark:text-gray-300"
          >
            {(region.trustBadges || []).map((b) => (
              <span key={b} className="flex items-center gap-1">
                <CheckCircle2
                  className="w-3.5 h-3.5 text-orange-500 dark:text-gold-400"
                  aria-hidden="true"
                />{" "}
                {b}
              </span>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="hidden lg:block"
        >
          <div className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.12)] card-hover dark:border-gold-400/30 dark:bg-navy-800 dark:shadow-gold-lg">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-gold-400 mx-auto flex items-center justify-center">
              <User className="w-12 h-12 text-white" aria-hidden="true" />
            </div>
            <h3 className="font-heading text-xl font-bold text-center mt-4 text-slate-900 dark:text-white">
              {heroCard.name}
            </h3>
            <p className="text-center text-slate-500 text-sm dark:text-gray-400">
              {heroCard.clinicLine}
            </p>
            <div className="flex justify-center mt-2">
              <StarRating rating={heroCard.rating} />
            </div>
            <div className="flex justify-center gap-2 mt-3">
              {heroCard.specialties.map((spec) => (
                <span
                  key={spec}
                  className="text-xs bg-orange-50 px-2 py-1 rounded-full text-orange-600 dark:bg-navy-700 dark:text-gold-300"
                >
                  {spec}
                </span>
              ))}
            </div>
            <Button className="w-full mt-6" onClick={() => navigate("/dentists")}>
              Book Now
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
