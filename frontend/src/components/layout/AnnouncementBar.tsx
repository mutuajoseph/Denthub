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
      className="relative bg-orange-500 px-10 py-2 text-center text-sm leading-snug text-white"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-1.5">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          {region.announcement}{" "}
          <Link
            to="/dentists"
            className="font-semibold text-white underline underline-offset-2 hover:text-orange-100"
          >
            Find a dentist near you
          </Link>
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-white transition-colors hover:bg-white/20"
        aria-label="Dismiss announcement"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </aside>
  );
}
