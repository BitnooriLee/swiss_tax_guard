export type SafeToSpendRiskBand = "CRITICAL" | "WARNING" | "SAFE";

export type SafeToSpendResult = {
  safeToSpendRappen: bigint;
  riskBand: SafeToSpendRiskBand;
  estimatedTaxDebtRappen: bigint;
  totalLiquidAssetsRappen: bigint;
};

export type TaxCategoryBreakdownItem = {
  category: "CASH" | "CRYPTO" | "STOCK";
  amount: bigint;
  taxWeight: number;
};

/** Resolved deferred payload for the tax dashboard route (all monetary fields in Rappen). */
export type TaxDashboardCalculation = {
  taxYear: number;
  canton: string;
  /** Selected residence canton (same as `canton`; explicit for UI/contracts). */
  selectedCanton: string;
  municipalityId: string;
  marginalTaxRateBps: number;
  taxableIncomeRappen: bigint;
  totalLiquidAssetsRappen: bigint;
  totalAssetsRappen: bigint;
  safetyBufferRappen: bigint;
  estimatedIncomeTaxRappen: bigint;
  /** Annual Pillar 3a contribution persisted on tax context (Rappen, statutory cap applied). */
  pillar3aContributionRappen: bigint;
  /** Estimated income-tax reduction from 3a at marginal rate (Rappen). */
  pillar3aTaxSavingRappen: bigint;
  /** Progressive demo wealth tax for `selectedCanton` (Rappen). */
  estimatedCantonTax: bigint;
  /** Same asset base, demo ZG wealth tax (for relocation hint). */
  zugWealthTaxRappen: bigint;
  taxSummary: {
    federalRappen: bigint;
    cantonalRappen: bigint;
    municipalRappen: bigint;
  };
  currentBalances: {
    CASH: bigint;
    CRYPTO: bigint;
    STOCK: bigint;
    hasForeignAssets: boolean;
    foreignCurrencyCodes: string[];
  };
  taxCategoryBreakdown: TaxCategoryBreakdownItem[];
  safeToSpend: SafeToSpendResult;
};
