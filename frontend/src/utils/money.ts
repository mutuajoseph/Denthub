/**
 * Exact decimal arithmetic on money strings.
 *
 * The backend prices with `Decimal` and serialises amounts as decimal strings
 * (`"350.00"`). The client keeps those strings and never round-trips them
 * through a float: multiplication by an integer quantity and summation are done
 * in scaled `bigint` arithmetic, so `0.1 + 0.2` is exactly `0.30` instead of
 * `0.30000000000000004`. This is the client half of the root `AGENTS.md`
 * "Money" rule ("integer minor units or a decimal library").
 */

interface ScaledAmount {
  units: bigint;
  scale: number;
}

const AMOUNT_PATTERN = /^(-?)(\d+)(?:\.(\d+))?$/;

/** Parse a decimal string into unscaled units plus its number of decimals. */
function parseAmount(value: string): ScaledAmount | null {
  const match = AMOUNT_PATTERN.exec(value.trim());
  if (match === null) return null;

  const [, sign, whole, fraction = ""] = match;

  return { units: BigInt(`${sign}${whole}${fraction}`), scale: fraction.length };
}

/** Render unscaled units back to a decimal string, preserving the scale. */
function stringify({ units, scale }: ScaledAmount): string {
  const negative = units < 0n;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, "0");
  const whole = scale === 0 ? digits : digits.slice(0, -scale);
  const fraction = scale === 0 ? "" : `.${digits.slice(-scale)}`;

  return `${negative ? "-" : ""}${whole}${fraction}`;
}

/** Scale unscaled units up to a common scale (never down, so nothing is lost). */
function rescale({ units, scale }: ScaledAmount, to: number): bigint {
  return units * 10n ** BigInt(to - scale);
}

/** Whether a string is a value this module can price exactly. */
export function isMoneyAmount(value: string): boolean {
  return parseAmount(value) !== null;
}

/** Add two amounts exactly, keeping the finer of the two scales. */
export function addMoney(a: string, b: string): string {
  const left = parseAmount(a) ?? { units: 0n, scale: 0 };
  const right = parseAmount(b) ?? { units: 0n, scale: 0 };
  const scale = Math.max(left.scale, right.scale);

  return stringify({ units: rescale(left, scale) + rescale(right, scale), scale });
}

/** Multiply an amount by an integer quantity exactly. */
export function multiplyMoney(amount: string, quantity: number): string {
  const parsed = parseAmount(amount);
  if (parsed === null || !Number.isInteger(quantity)) return "0.00";

  return stringify({ units: parsed.units * BigInt(quantity), scale: parsed.scale });
}

/** Sum amounts exactly. */
export function sumMoney(amounts: readonly string[]): string {
  return amounts.reduce(addMoney, "0.00");
}
