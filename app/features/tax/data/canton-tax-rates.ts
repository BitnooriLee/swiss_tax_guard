/**
 * Simplified progressive wealth-tax brackets for canton simulator (demo rates).
 * Thresholds are lower bounds in Rappen (1 CHF = 100 Rappen).
 * Rates multiply taxable CHF-equivalent per bracket slice (per-mille style decimals).
 */
export const CANTON_TAX_BRACKETS = {
  ZH: [
    { threshold: 0n, rate: 0.0001 },
    { threshold: 50_000_000n, rate: 0.0005 },
  ],
  ZG: [
    { threshold: 0n, rate: 0.00005 },
    { threshold: 100_000_000n, rate: 0.0002 },
  ],
  GE: [
    { threshold: 0n, rate: 0.00015 },
    { threshold: 80_000_000n, rate: 0.0003 },
  ],
} as const;

export type CantonWealthTaxCode = keyof typeof CANTON_TAX_BRACKETS;
