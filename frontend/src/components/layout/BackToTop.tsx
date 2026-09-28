import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function BackToTop() {
  const [visible, setVisible] = useState(() =>
    typeof window !== "undefined" ? window.scrollY > 300 : false,
  );

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 300);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleClick = () => {
    const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
    try {
      window.scrollTo({ top: 0, behavior });
    } catch {
      try {
        window.scrollTo(0, 0);
      } catch {
        return;
      }
    }
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Back to top"
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-3 z-50 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-button bg-paper text-ink shadow-card-cloud transition-colors hover:bg-cloud motion-reduce:animate-none sm:left-4 md:bottom-6"
    >
      <ArrowUp className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
