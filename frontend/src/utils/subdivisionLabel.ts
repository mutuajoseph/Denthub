/**
 * A subdivision code as a readable label, for the moment before a market's
 * name list is loaded: `UASIN_GISHU` → "Uasin Gishu". The API's
 * `Subdivision.name` always wins when it is known; this only reads the code.
 */
export function subdivisionLabel(code: string): string {
  return code
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
