import type { AssetHistoryPoint } from "~/features/assets/queries.server";

import type { TaxDashboardCalculation } from "../tax.types";

function rappenFromJson(value: string): bigint {
  return BigInt(value);
}

/** JSON-safe loader payload (React Router serializes loader data with `JSON.stringify`). */
export type TaxDashboardCalculationJSON = {
  taxYear: number;
  canton: string;
  selectedCanton: string;
  municipalityId: string;
  marginalTaxRateBps: number;
  taxableIncomeRappen: string;
  totalLiquidAssetsRappen: string;
  totalAssetsRappen: string;
  safetyBufferRappen: string;
  estimatedIncomeTaxRappen: string;
  pillar3aContributionRappen: string;
  pillar3aTaxSavingRappen: string;
  estimatedCantonTax: string;
  zugWealthTaxRappen: string;
  taxSummary: {
    federalRappen: string;
    cantonalRappen: string;
    municipalRappen: string;
  };
  currentBalances: {
    CASH: string;
    CRYPTO: string;
    STOCK: string;
    hasForeignAssets: boolean;
    foreignCurrencyCodes: string[];
  };
  taxCategoryBreakdown: Array<{
    category: "CASH" | "CRYPTO" | "STOCK";
    amount: string;
    taxWeight: number;
  }>;
  safeToSpend: {
    safeToSpendRappen: string;
    riskBand: "CRITICAL" | "WARNING" | "SAFE";
    estimatedTaxDebtRappen: string;
    totalLiquidAssetsRappen: string;
  };
};

export type AssetHistoryPointJSON = {
  date: string;
  totalAmount: string;
};

export function serializeTaxDashboardCalculation(
  calc: TaxDashboardCalculation,
): TaxDashboardCalculationJSON {
  return {
    taxYear: calc.taxYear,
    canton: calc.canton,
    selectedCanton: calc.selectedCanton,
    municipalityId: calc.municipalityId,
    marginalTaxRateBps: calc.marginalTaxRateBps,
    taxableIncomeRappen: calc.taxableIncomeRappen.toString(),
    totalLiquidAssetsRappen: calc.totalLiquidAssetsRappen.toString(),
    totalAssetsRappen: calc.totalAssetsRappen.toString(),
    safetyBufferRappen: calc.safetyBufferRappen.toString(),
    estimatedIncomeTaxRappen: calc.estimatedIncomeTaxRappen.toString(),
    pillar3aContributionRappen: calc.pillar3aContributionRappen.toString(),
    pillar3aTaxSavingRappen: calc.pillar3aTaxSavingRappen.toString(),
    estimatedCantonTax: calc.estimatedCantonTax.toString(),
    zugWealthTaxRappen: calc.zugWealthTaxRappen.toString(),
    taxSummary: {
      federalRappen: calc.taxSummary.federalRappen.toString(),
      cantonalRappen: calc.taxSummary.cantonalRappen.toString(),
      municipalRappen: calc.taxSummary.municipalRappen.toString(),
    },
    currentBalances: {
      CASH: calc.currentBalances.CASH.toString(),
      CRYPTO: calc.currentBalances.CRYPTO.toString(),
      STOCK: calc.currentBalances.STOCK.toString(),
      hasForeignAssets: calc.currentBalances.hasForeignAssets,
      foreignCurrencyCodes: calc.currentBalances.foreignCurrencyCodes,
    },
    taxCategoryBreakdown: calc.taxCategoryBreakdown.map((row) => ({
      category: row.category,
      amount: row.amount.toString(),
      taxWeight: row.taxWeight,
    })),
    safeToSpend: {
      safeToSpendRappen: calc.safeToSpend.safeToSpendRappen.toString(),
      riskBand: calc.safeToSpend.riskBand,
      estimatedTaxDebtRappen: calc.safeToSpend.estimatedTaxDebtRappen.toString(),
      totalLiquidAssetsRappen: calc.safeToSpend.totalLiquidAssetsRappen.toString(),
    },
  };
}

export function deserializeTaxDashboardCalculation(
  json: TaxDashboardCalculationJSON,
): TaxDashboardCalculation {
  return {
    taxYear: json.taxYear,
    canton: json.canton,
    selectedCanton: json.selectedCanton,
    municipalityId: json.municipalityId,
    marginalTaxRateBps: json.marginalTaxRateBps,
    taxableIncomeRappen: rappenFromJson(json.taxableIncomeRappen),
    totalLiquidAssetsRappen: rappenFromJson(json.totalLiquidAssetsRappen),
    totalAssetsRappen: rappenFromJson(json.totalAssetsRappen),
    safetyBufferRappen: rappenFromJson(json.safetyBufferRappen),
    estimatedIncomeTaxRappen: rappenFromJson(json.estimatedIncomeTaxRappen),
    pillar3aContributionRappen: rappenFromJson(json.pillar3aContributionRappen),
    pillar3aTaxSavingRappen: rappenFromJson(json.pillar3aTaxSavingRappen),
    estimatedCantonTax: rappenFromJson(json.estimatedCantonTax),
    zugWealthTaxRappen: rappenFromJson(json.zugWealthTaxRappen),
    taxSummary: {
      federalRappen: rappenFromJson(json.taxSummary.federalRappen),
      cantonalRappen: rappenFromJson(json.taxSummary.cantonalRappen),
      municipalRappen: rappenFromJson(json.taxSummary.municipalRappen),
    },
    currentBalances: {
      CASH: rappenFromJson(json.currentBalances.CASH),
      CRYPTO: rappenFromJson(json.currentBalances.CRYPTO),
      STOCK: rappenFromJson(json.currentBalances.STOCK),
      hasForeignAssets: json.currentBalances.hasForeignAssets,
      foreignCurrencyCodes: json.currentBalances.foreignCurrencyCodes,
    },
    taxCategoryBreakdown: json.taxCategoryBreakdown.map((row) => ({
      category: row.category,
      amount: rappenFromJson(row.amount),
      taxWeight: row.taxWeight,
    })),
    safeToSpend: {
      safeToSpendRappen: rappenFromJson(json.safeToSpend.safeToSpendRappen),
      riskBand: json.safeToSpend.riskBand,
      estimatedTaxDebtRappen: rappenFromJson(json.safeToSpend.estimatedTaxDebtRappen),
      totalLiquidAssetsRappen: rappenFromJson(json.safeToSpend.totalLiquidAssetsRappen),
    },
  };
}

export function serializeAssetHistory(
  points: AssetHistoryPoint[],
): AssetHistoryPointJSON[] {
  return points.map((p) => ({
    date: p.date,
    totalAmount: p.totalAmount.toString(),
  }));
}

export function deserializeAssetHistory(
  points: AssetHistoryPointJSON[],
): AssetHistoryPoint[] {
  return points.map((p) => ({
    date: p.date,
    totalAmount: rappenFromJson(p.totalAmount),
  }));
}
