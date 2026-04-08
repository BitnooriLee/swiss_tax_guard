/**
 * Simplified progressive wealth-tax brackets for canton simulator (demo rates).
 * Thresholds are lower bounds in Rappen (1 CHF = 100 Rappen).
 * Rates multiply taxable CHF-equivalent per bracket slice (per-mille style decimals).
 *
 * ZH / ZG / GE tiers are tuned for existing e2e invariants (ZG lowest among the three).
 */
function w(
  r0: number,
  r1: number,
  secondThresholdRappen: bigint,
): readonly [{ threshold: bigint; rate: number }, { threshold: bigint; rate: number }] {
  return [
    { threshold: 0n, rate: r0 },
    { threshold: secondThresholdRappen, rate: r1 },
  ] as const;
}

export const CANTON_TAX_BRACKETS = {
  AG: w(0.000068, 0.00034, 50_000_000n),
  AI: w(0.000042, 0.00019, 60_000_000n),
  AR: w(0.000075, 0.00037, 50_000_000n),
  BE: w(0.000095, 0.00045, 50_000_000n),
  BL: w(0.00009, 0.00044, 50_000_000n),
  BS: w(0.0001, 0.00048, 55_000_000n),
  FR: w(0.000085, 0.00041, 50_000_000n),
  GE: [
    { threshold: 0n, rate: 0.00015 },
    { threshold: 80_000_000n, rate: 0.0003 },
  ],
  GL: w(0.000048, 0.00021, 70_000_000n),
  GR: w(0.000082, 0.0004, 45_000_000n),
  JU: w(0.000088, 0.00043, 50_000_000n),
  LU: w(0.000078, 0.00038, 50_000_000n),
  NE: w(0.000092, 0.00046, 50_000_000n),
  NW: w(0.000044, 0.0002, 65_000_000n),
  OW: w(0.000043, 0.000195, 65_000_000n),
  SG: w(0.000081, 0.000395, 50_000_000n),
  SH: w(0.000072, 0.000355, 50_000_000n),
  SO: w(0.000076, 0.000375, 50_000_000n),
  SZ: w(0.000046, 0.000205, 90_000_000n),
  TG: w(0.000074, 0.000365, 50_000_000n),
  TI: w(0.00011, 0.00052, 40_000_000n),
  UR: w(0.000045, 0.000198, 70_000_000n),
  VD: w(0.000098, 0.00047, 50_000_000n),
  VS: w(0.000105, 0.0005, 40_000_000n),
  ZG: [
    { threshold: 0n, rate: 0.00005 },
    { threshold: 100_000_000n, rate: 0.0002 },
  ],
  ZH: [
    { threshold: 0n, rate: 0.0001 },
    { threshold: 50_000_000n, rate: 0.0005 },
  ],
} as const;

export type CantonWealthTaxCode = keyof typeof CANTON_TAX_BRACKETS;
