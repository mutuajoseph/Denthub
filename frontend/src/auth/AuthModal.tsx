import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { AuthPanel, type AuthView } from "./AuthPanel";

import type { AuthResponse } from "../lib/auth";
import { cn } from "../utils/cn";

type AuthModalProps = {
  onClose: () => void;
  onLoginSuccess?: (auth: AuthResponse) => void;
};

export function AuthModal({ onClose, onLoginSuccess }: AuthModalProps) {
  const [view, setView] = useState<AuthView>("signin");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const handleLoginSuccess = (auth: AuthResponse) => {
    onLoginSuccess?.(auth);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-ink/60 p-4 backdrop-blur-[6px]"
      role="presentation"
      onMouseDown={onClose}
    >
      <dialog
        open
        className={cn(
          "relative max-h-[90vh] w-full overflow-y-auto overscroll-contain rounded-card border border-steel bg-paper px-6 py-5 text-ink shadow-card-cloud",
          view === "register" ? "max-w-[560px]" : "max-w-[400px]",
        )}
        aria-labelledby="auth-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          aria-label="Close authentication"
          onClick={onClose}
          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-button text-slate transition hover:bg-cloud hover:text-ink"
        >
          <X className="h-5 w-5" strokeWidth={1.8} />
        </button>

        {/* Brand */}
        <div className="mb-5 flex justify-center">
          <h1
            id="auth-title"
            className="m-0 font-display text-[27px] leading-none font-semibold tracking-[-0.03em] text-ink"
          >
            Dent
            <span className="font-normal text-charcoal">Hub Kenya</span>
          </h1>
        </div>

        <AuthPanel
          view={view}
          onViewChange={setView}
          onSuccess={handleLoginSuccess}
          onClose={onClose}
        />
      </dialog>
    </div>
  );
}
