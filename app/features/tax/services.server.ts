/**
 * Swiss tax engine: liability from marginal brackets + Safe-to-Spend (@see AI.md).
 * External data must flow through TaxRatesPort implementations (e.g. EstvJsonAdapter).
 */
import { CANTON_TAX_BRACKETS } from "./data/canton-tax-rates";
import type { TaxBracketRow } from "./tax-rates.port";
import type { SafeToSpendResult, SafeToSpendRiskBand } from "./tax.types";

export type { TaxBracketRow, TaxRatesLookup, TaxRatesPort } from "./tax-rates.port";
export { EstvJsonAdapter } from "./adapters/estv-json.adapter";
export type {
  EstvSeedBracketJson,
  EstvSeedDocumentJson,
  EstvSeedEntryJson,
} from "./adapters/estv-json.adapter";

/** 1 CHF = 100 Rappen (integer ledger unit). */
export const RAPPEN_PER_CHF = 100n;

export { calculate3aTaxSaving, clampPillar3aContributionRappen } from "./lib/pillar-3a-math";

export function chfWholeToRappen(chfWhole: bigint): bigint {
  return chfWhole * RAPPEN_PER_CHF;
}

function minBigint(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

/**
 * Progressive cantonal wealth tax (demo brackets). Unknown canton defaults to ZH.
 * Keeps slice sizes in BigInt; uses Number only for rate multiplication; single
 * Math.round on the accumulated tax to return whole Rappen.
 */
export function calculateCantonWealthTax(
  totalAssetsRappen: bigint,
  canton: string,
): bigint {
  const key = canton.trim().toUpperCase();
  const rows =
    key in CANTON_TAX_BRACKETS
      ? CANTON_TAX_BRACKETS[key as keyof typeof CANTON_TAX_BRACKETS]
      : CANTON_TAX_BRACKETS.ZH;

  const sorted = [...rows].sort((a, b) => {
    if (a.threshold < b.threshold) return -1;
    if (a.threshold > b.threshold) return 1;
    return 0;
  });

  if (totalAssetsRappen <= 0n) {
    return 0n;
  }

  let accrued = 0;
  for (let i = 0; i < sorted.length; i++) {
    const lower = sorted[i].threshold;
    if (totalAssetsRappen <= lower) {
      continue;
    }
    const nextUpper =
      i + 1 < sorted.length ? sorted[i + 1].threshold : null;
    const sliceEnd =
      nextUpper === null
        ? totalAssetsRappen
        : minBigint(totalAssetsRappen, nextUpper);
    const slice = sliceEnd - lower;
    if (slice > 0n) {
      accrued += Number(slice) * sorted[i].rate;
    }
  }

  return BigInt(Math.round(accrued));
}

/**
 * Progressive tax on taxable income using marginal slices (upper bound exclusive; null = unbounded).
 * Brackets need not be pre-sorted; overlapping definitions would double-count — keep seeds disjoint.
 */
export function computeTaxLiability(
  taxableIncomeRappen: bigint,
  brackets: TaxBracketRow[],
): bigint {
  if (taxableIncomeRappen <= 0n) {
    return 0n;
  }
  let tax = 0n;
  const sorted = [...brackets].sort((a, b) => {
    if (a.lowerBoundRappen === b.lowerBoundRappen) return 0;
    return a.lowerBoundRappen < b.lowerBoundRappen ? -1 : 1;
  });
  for (const b of sorted) {
    if (taxableIncomeRappen <= b.lowerBoundRappen) {
      continue;
    }
    const ceiling =
      b.upperBoundRappen === null
        ? taxableIncomeRappen
        : minBigint(taxableIncomeRappen, b.upperBoundRappen);
    const slice = ceiling - b.lowerBoundRappen;
    if (slice > 0n) {
      tax += (slice * BigInt(b.marginalRateBps)) / 10000n;
    }
  }
  return tax;
}

export type { SafeToSpendRiskBand, SafeToSpendResult } from "./tax.types";

/**
 * Safe-to-Spend = total assets − estimated tax debt − safety buffer (all Rappen).
 * Negative results indicate liquidity shortfall vs reserved tax ("Tax is Debt").
 *
 * Risk bands (UI): CRITICAL if spendable cash is negative; WARNING if estimated
 * tax debt exceeds 80% of liquid assets; otherwise SAFE.
 */
export function getSafeToSpend(input: {
  totalAssetsRappen: bigint;
  totalLiquidAssetsRappen: bigint;
  estimatedTaxDebtRappen: bigint;
  safetyBufferRappen: bigint;
}): SafeToSpendResult {
  const safeToSpendRappen =
    input.totalAssetsRappen -
    input.estimatedTaxDebtRappen -
    input.safetyBufferRappen;

  let riskBand: SafeToSpendRiskBand;
  if (safeToSpendRappen < 0n) {
    riskBand = "CRITICAL";
  } else if (
    input.estimatedTaxDebtRappen >
    (input.totalLiquidAssetsRappen * 80n) / 100n
  ) {
    riskBand = "WARNING";
  } else {
    riskBand = "SAFE";
  }

  return {
    safeToSpendRappen,
    riskBand,
    estimatedTaxDebtRappen: input.estimatedTaxDebtRappen,
    totalLiquidAssetsRappen: input.totalLiquidAssetsRappen,
  };
}

/**
 * Splits combined income-tax liability into federal / cantonal / municipal rows for the dashboard.
 * Remainder goes to municipal so the three parts sum exactly to `totalRappen`.
 *
 * Replace when ESTV seeds expose separate marginal tables per layer.
 */
export function splitIncomeTaxForDashboardStub(totalRappen: bigint): {
  federalRappen: bigint;
  cantonalRappen: bigint;
  municipalRappen: bigint;
} {
  const federalRappen = (totalRappen * 2000n) / 10000n;
  const cantonalRappen = (totalRappen * 5300n) / 10000n;
  const municipalRappen = totalRappen - federalRappen - cantonalRappen;
  return { federalRappen, cantonalRappen, municipalRappen };
}

export type TaxCategoryBreakdownItem = {
  category: "CASH" | "CRYPTO" | "STOCK";
  amount: bigint;
  taxWeight: number;
};

/**
 * Approximates tax pressure by asset category using current balances and
 * marginal-rate multiplier. `taxWeight` represents each category's share of
 * estimated tax-driving base (2-decimal percentage).
 */
export function getTaxCategoryBreakdown(
  balances: Record<string, bigint>,
  marginalRate: number,
): TaxCategoryBreakdownItem[] {
  const categories: Array<TaxCategoryBreakdownItem["category"]> = [
    "CASH",
    "CRYPTO",
    "STOCK",
  ];
  const boundedRate = Number.isFinite(marginalRate)
    ? Math.min(Math.max(marginalRate, 0), 1)
    : 0;
  const scaledRateBps = BigInt(Math.round(boundedRate * 10000));

  const rows = categories.map((category) => {
    const rawAmount = balances[category] ?? 0n;
    const amount = rawAmount > 0n ? rawAmount : 0n;
    const estimatedTaxImpact = (amount * scaledRateBps) / 10000n;
    return { category, amount, estimatedTaxImpact };
  });
  const totalEstimatedTaxImpact = rows.reduce(
    (sum, row) => sum + row.estimatedTaxImpact,
    0n,
  );

  if (totalEstimatedTaxImpact <= 0n) {
    return rows.map(({ category, amount }) => ({
      category,
      amount,
      taxWeight: 0,
    }));
  }

  return rows.map(({ category, amount, estimatedTaxImpact }) => ({
    category,
    amount,
    taxWeight: Number((estimatedTaxImpact * 10000n) / totalEstimatedTaxImpact) / 100,
  }));
}
