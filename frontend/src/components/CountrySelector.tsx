import { Check, ChevronDown, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_REGION_CODE, REGIONS, REGION_LIST, type Region } from "../config/regions";
import { useRegionStore } from "../store/regionStore";

type CountrySelectorProps = {
  onNavigate?: () => void;
};

export default function CountrySelector({ onNavigate }: CountrySelectorProps) {
  const [open, setOpen] = useState(false);
  const regionCode = useRegionStore((s) => s.regionCode);
  const setRegion = useRegionStore((s) => s.setRegion);
  const ref = useRef<HTMLDivElement>(null);

  const current: Region =
    REGION_LIST.find((r) => r.code === regionCode) || REGIONS[DEFAULT_REGION_CODE];

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
        aria-label={`Current country: ${current.countryName}`}
        className="
          flex
          h-10
          items-center
          gap-1.5
          rounded-full
          border
          border-slate-300
          bg-white
          px-3
          text-sm
          font-medium
          text-[#172b4d]
          transition
          hover:border-orange-500
          hover:text-orange-500
          dark:border-navy-600
          dark:bg-navy-800
          dark:text-white
          dark:hover:border-gold-400
          dark:hover:text-gold-400
        "
      >
        <Globe className="h-[18px] w-[18px] shrink-0" strokeWidth={1.7} aria-hidden="true" />
        <span className="hidden sm:inline">{current.countryName}</span>
        <ChevronDown
          className={`
            h-4
            w-4
            text-slate-400
            transition-transform
            duration-200
            dark:text-gray-400
            ${open ? "rotate-180" : ""}
          `}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Choose your country"
          className="
            absolute
            right-0
            top-full
            z-[99999]
            mt-2
            max-h-[360px]
            w-[230px]
            overflow-y-auto
            rounded-xl
            border
            border-slate-200
            bg-white
            py-1
            shadow-2xl
            dark:border-navy-600
            dark:bg-navy-800
          "
        >
          {REGION_LIST.map((region) => {
            const selected = region.code === regionCode;
            return (
              <button
                key={region.code}
                type="button"
                role="menuitem"
                aria-selected={selected}
                onClick={() => handleSelect(region.code)}
                className={`
                  flex
                  w-full
                  items-center
                  gap-3
                  px-4
                  py-2.5
                  text-left
                  text-sm
                  transition
                  ${
                    selected
                      ? "bg-orange-50 text-orange-600 dark:bg-navy-700 dark:text-gold-300"
                      : "text-[#172b4d] hover:bg-orange-50 hover:text-orange-600 dark:text-white dark:hover:bg-navy-700 dark:hover:text-gold-300"
                  }
                `}
              >
                <span className="flex-1 truncate">{region.countryName}</span>
                {selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
