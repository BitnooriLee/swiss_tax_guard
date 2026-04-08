export function parseFormattedChfToRappen(raw: string): bigint {
  // Asset chart aria-labels look like "2026-04-08 CHF 0.00" — take amount after CHF.
  const chfIdx = raw.toUpperCase().lastIndexOf("CHF");
  const amountSlice =
    chfIdx >= 0 ? raw.slice(chfIdx + 3).trim() : raw.trim();

  const normalized = amountSlice
    .replace(/[\s']/g, "")
    .replace(/[−-]/g, "-")
    .trim();

  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Unable to parse CHF amount: "${raw}"`);
  }

  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [wholePart, fractionPart = ""] = unsigned.split(".");
  const rappen = BigInt(wholePart) * 100n + BigInt(fractionPart.padEnd(2, "0"));
  return negative ? -rappen : rappen;
}

export function parsePercentValue(raw: string): number {
  const match = raw.match(/-?\d+(\.\d+)?/);
  if (!match) {
    throw new Error(`Unable to parse percent value: "${raw}"`);
  }
  return Number(match[0]);
}
