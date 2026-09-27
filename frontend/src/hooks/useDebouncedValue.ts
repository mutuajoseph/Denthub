import { useEffect, useState } from "react";

/**
 * Delay propagating `value` so rapid changes (typing in a search box, toggling
 * filters) collapse into one update.
 *
 * The source shop fired a request per keystroke; the debounce is what stops
 * that from becoming a request per keystroke here.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (delayMs <= 0) {
      setDebounced(value);
      return;
    }

    const timer = setTimeout(() => setDebounced(value), delayMs);

    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
