import { Check, ChevronDown, Globe } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCountries } from "../hooks/useCountries";
import { useRegionStore } from "../store/regionStore";

type CountrySelectorProps = {
  onNavigate?: () => void;
};

const GLOBAL_COUNTRY = {
  code: "GLOBAL",
  name: "Worldwide",
} as const;

export default function CountrySelector({ onNavigate }: CountrySelectorProps) {
  const [open, setOpen] = useState(false);
  const regionCode = useRegionStore((s) => s.regionCode || s.getRegion().code);
  const setRegion = useRegionStore((s) => s.setRegion);
  const { countries } = useCountries();
  const ref = useRef<HTMLDivElement>(null);

  const options = useMemo(
    () => [GLOBAL_COUNTRY, ...countries.map(({ code, name }) => ({ code, name }))],
    [countries],
  );

  const current = options.find((option) => option.code === regionCode) ?? GLOBAL_COUNTRY;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (code: string) => {
    setRegion(code);
    setOpen(false);
    onNavigate?.();
  };

  return (
    <div ref={ref} className="relative z-[100]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Current country: ${current.name}`}
        className="flex h-10 items-center gap-1.5 rounded-button px-2.5 text-sm font-medium text-charcoal ring-1 ring-inset ring-steel transition-colors hover:bg-cloud hover:text-ink"
      >
        <Globe className="h-[18px] w-[18px] shrink-0" strokeWidth={1.7} aria-hidden="true" />
        <span className="hidden sm:inline">{current.name}</span>
        <ChevronDown
          className={`h-4 w-4 text-slate transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Choose your country"
          className="absolute right-0 top-full z-[99999] mt-2 max-h-[360px] w-[232px] overflow-y-auto rounded-card bg-paper p-1.5 shadow-card-cloud"
        >
          {options.map((option) => {
            const selected = option.code === regionCode;
            return (
              <button
                key={option.code}
                type="button"
                role="menuitem"
                aria-selected={selected}
                onClick={() => handleSelect(option.code)}
                className={`flex w-full items-center gap-2.5 rounded-button px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  selected ? "bg-cloud text-ink" : "text-charcoal hover:bg-cloud hover:text-ink"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-[1px] ${selected ? "bg-aqua-relay ring-1 ring-ink/20" : "bg-transparent"}`}
                  aria-hidden="true"
                />
                <span className="flex-1 truncate">{option.name}</span>
                {selected && <Check className="h-4 w-4 shrink-0 text-ink" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
