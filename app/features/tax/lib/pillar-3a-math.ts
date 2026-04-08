/**
 * Pure Pillar 3a deduction math (Rappen, bps). Safe for client and server bundles.
 */
import { maxPillar3aEmployeeContributionRappen } from "../data/tax-constants";

export function clampPillar3aContributionRappen(
  contributionRappen: bigint,
  taxYear: number,
): bigint {
  const max = maxPillar3aEmployeeContributionRappen(taxYear);
  if (contributionRappen < 0n) {
    return 0n;
  }
  return contributionRappen > max ? max : contributionRappen;
}

/**
 * Estimated income-tax reduction from a Pillar 3a deduction at the marginal rate (Rappen).
 */
export function calculate3aTaxSaving(
  contributionRappen: bigint,
  marginalRateBps: number,
): bigint {
  if (contributionRappen <= 0n) {
    return 0n;
  }
  const bps = Number.isFinite(marginalRateBps) ? Math.trunc(marginalRateBps) : 0;
  if (bps <= 0) {
    return 0n;
  }
  return (contributionRappen * BigInt(bps)) / 10000n;
}
