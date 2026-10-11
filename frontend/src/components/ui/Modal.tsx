import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { cn } from "../../utils/cn";

type Size = "sm" | "md" | "lg" | "xl";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  size?: Size;
  /** Accessible name for the dialog, e.g. the item being viewed. */
  ariaLabel?: string;
}

const sizes: Record<Size, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export default function Modal({
  isOpen,
  onClose,
  children,
  className,
  size = "md",
  ariaLabel,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          >
            <dialog
              open
              aria-label={ariaLabel}
              className={cn(
                "pointer-events-auto relative max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-card border border-steel bg-paper p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink shadow-2xl outline-none sm:rounded-card sm:p-6 sm:pb-6",
                sizes[size],
                className,
              )}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Escape") onClose();
              }}
            >
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 rounded-button p-1 text-slate transition-colors hover:bg-cloud hover:text-ink"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
              {children}
            </dialog>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
