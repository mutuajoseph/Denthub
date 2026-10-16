import { Building2 } from "lucide-react";

import Button from "../components/ui/Button";

/**
 * Public suppliers directory.
 *
 * Read-only catalogue page per PRD §2 (marketplace open to everyone). This is a
 * lightweight placeholder screen wired into the router so the footer link no
 * longer lands on NotFound; the full supplier listing comes from the API later.
 */
export default function Suppliers() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cloud text-charcoal">
        <Building2 className="h-8 w-8" aria-hidden="true" />
      </div>
      <h1 className="mt-6 font-display text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">
        Dental Supplier Marketplace
      </h1>
      <p className="mt-3 max-w-2xl text-base text-slate">
        Browse dental supplies and equipment from trusted suppliers. The full supplier directory is
        coming soon.
      </p>
      <div className="mt-8">
        <Button href="/" variant="graphite">
          Back to home
        </Button>
      </div>
    </div>
  );
}
