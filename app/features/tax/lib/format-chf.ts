/**
 * Swiss-style CHF display from integer Rappen (1 CHF = 100 Rappen).
 * Uses BigInt arithmetic only — no floating-point currency math.
 */

function formatSwissIntegerPart(absoluteWhole: bigint): string {
  const digits = absoluteWhole.toString();
  const parts: string[] = [];
  let head = digits;
  while (head.length > 3) {
    parts.unshift(head.slice(-3));
    head = head.slice(0, -3);
  }
  parts.unshift(head);
  return parts.join("'");
}

/**
 * Format Rappen as de-CH style amount: thousands with apostrophe, two decimal places.
 * Example: 123456n → "1'234.56"
 */
export function formatCHF(rappen: bigint): string {
  const negative = rappen < 0n;
  const abs = negative ? -rappen : rappen;
  const whole = abs / 100n;
  const frac = abs % 100n;
  const fracStr = frac.toString().padStart(2, "0");
  const sign = negative ? "−" : "";
  return `${sign}${formatSwissIntegerPart(whole)}.${fracStr}`;
}
