import { Search } from "lucide-react";
import { Link } from "react-router-dom";
import Button from "../components/ui/Button";

export default function NotFound() {
  return (
    <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-4 py-16 text-center">
      <div className="relative mx-auto max-w-lg">
        <p className="font-display text-[96px] font-medium leading-none tracking-[-0.04em] text-ink">
          404
        </p>
        <h1 className="mt-4 font-heading text-2xl font-semibold text-ink">Page not found</h1>
        <p className="mt-3 text-slate">
          The page you're looking for doesn't exist or has been moved. Let's get you back on track.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button to="/" icon={Search}>
            Back to Home
          </Button>
          <Link
            to="/dentists"
            className="rounded-button border border-steel px-7 py-2.5 font-heading text-sm font-semibold text-ink transition hover:bg-cloud"
          >
            Find a Dentist
          </Link>
        </div>
      </div>
    </section>
  );
}
