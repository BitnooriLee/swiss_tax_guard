/**
 * Parse Swiss CHF input into integer Rappen using BigInt only.
 * Supports delimiters like apostrophe and comma.
 *
 * Examples:
 * - "1'234.50" => 123450n
 * - "1234,50" => 123450n
 * - "-10.05" => -1005n
 */
export function parseCHFToRappen(value: string): bigint {
  const normalized = value.trim().replaceAll("'", "").replaceAll(",", ".");
  if (normalized.length === 0) {
    return 0n;
  }

  const sign = normalized.startsWith("-") ? -1n : 1n;
  const unsigned = normalized.replace(/^[+-]/, "");
  if (unsigned.length === 0) {
    return 0n;
  }

  const parts = unsigned.split(".");
  if (parts.length > 2) {
    return 0n;
  }

  const wholePartRaw = parts[0] ?? "0";
  const fracPartRaw = parts[1] ?? "";

  if (!/^\d+$/.test(wholePartRaw) && wholePartRaw !== "") {
    return 0n;
  }
  if (!/^\d*$/.test(fracPartRaw)) {
    return 0n;
  }

  const wholePart = wholePartRaw === "" ? "0" : wholePartRaw;
  const fracNormalized = (fracPartRaw + "00").slice(0, 2);

  try {
    const wholeRappen = BigInt(wholePart) * 100n;
    const fracRappen = BigInt(fracNormalized);
    return sign * (wholeRappen + fracRappen);
  } catch {
    return 0n;
  }
}
