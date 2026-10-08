import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { type SpecialtyWire, fetchSpecialties } from "../lib/countryConfigApi";

export interface SpecialtyOption {
  code: string;
  name: string;
}

/** Display fallback while the list loads (or if it fails): `orthodontics` → "Orthodontics". */
function prettifyCode(code: string): string {
  return code
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * The market's specialisms for filter options and card labels.
 *
 * The endpoint reads no country (`list_specialties` is global), so the key
 * carries none — one list serves every region.
 */
export function useSpecialties() {
  const query = useQuery<SpecialtyWire[]>({
    queryKey: ["specialties"],
    queryFn: () => fetchSpecialties(),
    staleTime: 5 * 60 * 1000,
  });

  const options = useMemo<SpecialtyOption[]>(
    () => (query.data ?? []).map((row) => ({ code: row.code, name: row.name })),
    [query.data],
  );

  const nameOf = useMemo(() => {
    const byCode = new Map(options.map((option) => [option.code, option.name]));
    return (code: string) => byCode.get(code) ?? prettifyCode(code);
  }, [options]);

  return {
    options,
    nameOf,
    isLoading: query.isPending,
    error: query.error,
  };
}
