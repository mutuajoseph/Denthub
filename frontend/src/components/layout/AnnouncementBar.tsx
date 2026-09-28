import { Flag, Globe, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useRegion } from "../../hooks/useRegion";
import { useAnnouncementStore } from "../../store/announcementStore";

export function AnnouncementBar() {
  const { region } = useRegion();
  const dismissed = useAnnouncementStore((state) => state.dismissed);
  const dismiss = useAnnouncementStore((state) => state.dismiss);

  if (dismissed) return null;

  const Icon = region.code === "GLOBAL" ? Globe : Flag;

  return (
    <aside
      aria-label="Site announcement"
      className="relative bg-lime-notice px-11 py-2 text-center text-sm font-medium leading-[1.5] text-ink/80"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-1.5">
        <Icon className="h-4 w-4 shrink-0 text-ink" strokeWidth={1.8} aria-hidden="true" />
        <p>
          {region.announcement}{" "}
          <Link
            to="/dentists"
            className="rounded-link font-semibold text-ink underline decoration-ink/40 underline-offset-[3px] transition-colors hover:decoration-ink"
          >
            Find a dentist near you
          </Link>
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-link text-ink/70 transition-colors hover:bg-ink/10 hover:text-ink"
        aria-label="Dismiss announcement"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </aside>
  );
}
