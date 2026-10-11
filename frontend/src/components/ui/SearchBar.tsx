import { Search } from "lucide-react";
import { cn } from "../../utils/cn";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  className,
}: SearchBarProps) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-button border border-steel bg-paper py-3 pl-12 pr-4 text-ink transition-colors placeholder:text-slate focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
      />
    </div>
  );
}
