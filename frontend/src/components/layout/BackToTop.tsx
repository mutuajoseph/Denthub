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
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-3 z-50 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-gold-400/30 bg-navy-700 text-gold-400 shadow-lg shadow-navy-950/30 transition-colors hover:bg-navy-600 hover:text-gold-300 motion-reduce:animate-none sm:left-4 md:bottom-6"
    >
      <ArrowUp className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
