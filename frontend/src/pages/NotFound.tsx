import { Search } from "lucide-react";
import { Link } from "react-router-dom";
import Button from "../components/ui/Button";

export default function NotFound() {
  return (
    <section className="hero-bg relative flex min-h-[70vh] items-center justify-center overflow-hidden px-4 py-16 text-center">
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(245,166,35,0.08),transparent_60%)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-lg">
        <p className="font-display text-[96px] font-bold leading-none text-orange-500 dark:text-gold-400">
          404
        </p>
        <h1 className="mt-4 font-heading text-2xl font-bold text-slate-900 dark:text-white">
          Page not found
        </h1>
        <p className="mt-3 text-slate-600 dark:text-gray-300">
          The page you're looking for doesn't exist or has been moved. Let's get you back on track.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button to="/" icon={Search}>
            Back to Home
          </Button>
          <Link
            to="/dentists"
            className="rounded-lg border-2 border-orange-500 px-7 py-2.5 font-heading text-sm font-semibold text-orange-500 transition hover:bg-orange-50 dark:border-gold-400 dark:text-gold-300 dark:hover:bg-gold-400/10"
          >
            Find a Dentist
          </Link>
        </div>
      </div>
    </section>
  );
}
