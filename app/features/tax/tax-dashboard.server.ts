/**
 * Server-only bundle for the tax dashboard: seeds, liability, Safe-to-Spend.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "database.types";

import type { TaxDashboardCalculation } from "./tax.types";
import {
  EstvJsonAdapter,
  type EstvSeedDocumentJson,
  calculateCantonWealthTax,
  chfWholeToRappen,
  computeTaxLiability,
  getTaxCategoryBreakdown,
  getSafeToSpend,
  splitIncomeTaxForDashboardStub,
} from "./services.server";
import {
  getCurrentBalances,
  getEffectiveResidenceCanton,
  getSwissTaxContextForUser,
} from "./queries.server";

const DEMO_TAXABLE_INCOME_RAPPEN = 120_000n * 100n;

const ALLOWED_RESIDENCE_CANTONS = new Set(["ZH", "ZG", "GE"]);

/**
 * Persists residence canton on the profile and keeps `swiss_tax_contexts` aligned for ESTV lookups.
 */
export async function updateResidenceCantonForUser(
  client: SupabaseClient<Database>,
  userId: string,
  rawCanton: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const canton = rawCanton.trim().toUpperCase().slice(0, 2);
  if (!ALLOWED_RESIDENCE_CANTONS.has(canton)) {
    return { ok: false, error: "Invalid canton." };
  }

  const { error: profileError } = await client
    .from("profiles")
    .update({ residence_canton: canton })
    .eq("profile_id", userId);
  if (profileError) {
    return { ok: false, error: "Failed to update profile." };
  }

  const { data: existingCtx, error: selectCtxError } = await client
    .from("swiss_tax_contexts")
    .select("profile_id")
    .eq("profile_id", userId)
    .maybeSingle();

  if (selectCtxError) {
    return { ok: false, error: "Failed to read tax context." };
  }

  if (existingCtx) {
    const { error: updateCtxError } = await client
      .from("swiss_tax_contexts")
      .update({ canton })
      .eq("profile_id", userId);
    if (updateCtxError) {
      return { ok: false, error: "Failed to sync tax context." };
    }
  } else {
    const { error: insertCtxError } = await client.from("swiss_tax_contexts").insert({
      profile_id: userId,
      canton,
      municipality_id: "",
      marital_status: "single",
      church_tax: false,
      children_count: 0,
    });
    if (insertCtxError) {
      return { ok: false, error: "Failed to create tax context." };
    }
  }

  return { ok: true };
}

function loadEstvDocument(): EstvSeedDocumentJson {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "..", "..", "db", "seeds", "tax_rates.json");
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as EstvSeedDocumentJson;
}

let cachedDocument: EstvSeedDocumentJson | null = null;

function getEstvDocument(): EstvSeedDocumentJson {
  cachedDocument ??= loadEstvDocument();
  return cachedDocument;
}

function resolveTaxYear(reference: Date): number {
  return reference.getFullYear();
}

function resolveMarginalRateBpsForIncome(
  incomeRappen: bigint,
  brackets: Array<{ lowerBoundRappen: bigint; upperBoundRappen: bigint | null; marginalRateBps: number }>,
): number {
  let matched = 0;
  for (const bracket of brackets) {
    const inLower = incomeRappen >= bracket.lowerBoundRappen;
    const inUpper =
      bracket.upperBoundRappen === null || incomeRappen < bracket.upperBoundRappen;
    if (inLower && inUpper) {
      matched = bracket.marginalRateBps;
    }
  }
  return matched;
}

/**
 * Deferred work: assets + context from Supabase, liability from in-memory ESTV seeds.
 */
export async function computeTaxDashboardCalculation(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<TaxDashboardCalculation> {
  const taxYear = resolveTaxYear(new Date());
  const [currentBalances, taxContext, residenceCanton] = await Promise.all([
    getCurrentBalances(client, userId),
    getSwissTaxContextForUser(client, userId),
    getEffectiveResidenceCanton(client, userId),
  ]);

  const canton = residenceCanton;
  const municipalityId = taxContext?.municipality_id ?? "";

  const adapter = new EstvJsonAdapter(getEstvDocument());
  const brackets = await adapter.getIncomeBrackets({
    taxYear,
    canton,
    municipalityId: municipalityId === "" ? null : municipalityId,
  });

  const taxableIncomeRappen = DEMO_TAXABLE_INCOME_RAPPEN;
  const estimatedIncomeTaxRappen =
    brackets.length > 0
      ? computeTaxLiability(taxableIncomeRappen, brackets)
      : 0n;
  const marginalTaxRateBps = resolveMarginalRateBpsForIncome(
    taxableIncomeRappen,
    brackets,
  );

  const taxSummary = splitIncomeTaxForDashboardStub(estimatedIncomeTaxRappen);
  const taxCategoryBreakdown = getTaxCategoryBreakdown(
    {
      CASH: currentBalances.CASH,
      CRYPTO: currentBalances.CRYPTO,
      STOCK: currentBalances.STOCK,
    },
    marginalTaxRateBps / 10000,
  );

  const totalLiquidAssetsRappen =
    currentBalances.CASH + currentBalances.CRYPTO + currentBalances.STOCK;
  const totalAssetsRappen = totalLiquidAssetsRappen;
  const safetyBufferRappen = chfWholeToRappen(5000n);

  const estimatedCantonTax = calculateCantonWealthTax(
    totalAssetsRappen,
    canton,
  );
  const zugWealthTaxRappen = calculateCantonWealthTax(
    totalAssetsRappen,
    "ZG",
  );
  const estimatedTotalTaxDebtRappen =
    estimatedIncomeTaxRappen + estimatedCantonTax;

  const safeToSpend = getSafeToSpend({
    totalAssetsRappen,
    totalLiquidAssetsRappen,
    estimatedTaxDebtRappen: estimatedTotalTaxDebtRappen,
    safetyBufferRappen,
  });

  return {
    taxYear,
    canton,
    selectedCanton: canton,
    municipalityId,
    marginalTaxRateBps,
    taxableIncomeRappen,
    totalLiquidAssetsRappen,
    totalAssetsRappen,
    safetyBufferRappen,
    estimatedIncomeTaxRappen,
    estimatedCantonTax,
    zugWealthTaxRappen,
    taxSummary,
    currentBalances,
    taxCategoryBreakdown,
    safeToSpend,
  };
}
