import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "database.types";

export type AssetBucketBalances = {
  CASH: bigint;
  CRYPTO: bigint;
  STOCK: bigint;
};

export type CurrentBalances = AssetBucketBalances & {
  /** True when any ledger row was booked in a non-CHF original currency. */
  hasForeignAssets: boolean;
  /** Distinct original currency codes (uppercase), excluding CHF. */
  foreignCurrencyCodes: string[];
};

function toBigIntAmount(raw: unknown): bigint {
  if (typeof raw === "bigint") {
    return raw;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return BigInt(Math.trunc(raw));
  }
  if (typeof raw === "string" && /^-?\d+$/.test(raw)) {
    return BigInt(raw);
  }
  return 0n;
}

const EMPTY_BALANCES: CurrentBalances = {
  CASH: 0n,
  CRYPTO: 0n,
  STOCK: 0n,
  hasForeignAssets: false,
  foreignCurrencyCodes: [],
};

function mapAssetTypeToBalanceKey(assetType: string): keyof AssetBucketBalances | null {
  if (assetType === "cash") return "CASH";
  if (assetType === "crypto") return "CRYPTO";
  if (assetType === "stock") return "STOCK";
  return null;
}

/**
 * Aggregate current balances per asset type from immutable ledger deltas.
 *
 * Regression guard: `e2e/tax-guard.spec.ts` exercises totals + history; do not reintroduce
 * PostgREST aggregate calls here (e.g. `sum:amount.sum()`) without updating tests.
 */
export async function getCurrentBalances(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<CurrentBalances> {
  const { data, error } = await client
    .from("asset_ledger")
    .select("asset_type,amount,original_currency")
    .eq("user_id", userId);

  if (error) {
    if (import.meta.env.DEV) {
      console.error("[getCurrentBalances]", error.message);
    }
    return { ...EMPTY_BALANCES };
  }

  const balances: CurrentBalances = { ...EMPTY_BALANCES };
  const foreignCodes = new Set<string>();
  for (const row of data ?? []) {
    const key = mapAssetTypeToBalanceKey(String(row.asset_type ?? ""));
    if (!key) continue;
    balances[key] += toBigIntAmount(row.amount);
    const oc = String(row.original_currency ?? "CHF").trim().toUpperCase();
    if (oc !== "CHF") {
      foreignCodes.add(oc);
    }
  }
  balances.foreignCurrencyCodes = [...foreignCodes].sort();
  balances.hasForeignAssets = balances.foreignCurrencyCodes.length > 0;

  return balances;
}

/**
 * Sum ledger amounts in Rappen for the authenticated user (RLS-scoped).
 */
export async function sumUserAssetLedgerRappen(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<bigint> {
  const balances = await getCurrentBalances(client, userId);
  return balances.CASH + balances.CRYPTO + balances.STOCK;
}

export type SwissTaxContextRow = {
  canton: string;
  municipality_id: string;
  pillar_3a_contribution_rappen: bigint;
};

function isMissingPillar3aColumnError(error: { message: string }): boolean {
  const m = error.message;
  return m.includes("pillar_3a_contribution_rappen") && m.includes("does not exist");
}

/**
 * Swiss residency context for bracket lookup (RLS-scoped).
 */
export async function getSwissTaxContextForUser(
  client: SupabaseClient<Database>,
  profileId: string,
): Promise<SwissTaxContextRow | null> {
  const { data, error } = await client
    .from("swiss_tax_contexts")
    .select("canton, municipality_id, pillar_3a_contribution_rappen")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!error && data) {
    return {
      canton: data.canton,
      municipality_id: data.municipality_id,
      pillar_3a_contribution_rappen: toBigIntAmount(
        data.pillar_3a_contribution_rappen,
      ),
    };
  }

  if (error && isMissingPillar3aColumnError(error)) {
    const { data: legacy, error: legacyError } = await client
      .from("swiss_tax_contexts")
      .select("canton, municipality_id")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (legacyError) {
      if (import.meta.env.DEV) {
        console.error("[getSwissTaxContextForUser]", legacyError.message);
      }
      return null;
    }
    if (!legacy) {
      return null;
    }
    return {
      canton: legacy.canton,
      municipality_id: legacy.municipality_id,
      pillar_3a_contribution_rappen: 0n,
    };
  }

  if (error && import.meta.env.DEV) {
    console.error("[getSwissTaxContextForUser]", error.message);
  }
  return null;
}

/**
 * Canonical canton for tax simulation: profile residence, then swiss_tax_contexts, then ZH.
 */
/** One ledger row for PDF / compliance export (RLS-scoped). */
export type AssetLedgerReportRow = {
  assetTypeKey: keyof AssetBucketBalances;
  description: string | null;
  originalCurrency: string;
  originalAmountMinor: bigint;
  fxRateDisplay: string;
  chfRappen: bigint;
};

/**
 * Ordered asset ledger lines with original currency and CHF booking (immutable ledger).
 */
export async function getAssetLedgerReportRows(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<AssetLedgerReportRow[]> {
  const { data, error } = await client
    .from("asset_ledger")
    .select(
      "asset_type,description,original_currency,original_amount,fx_rate,amount,created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const rows: AssetLedgerReportRow[] = [];
  for (const row of data ?? []) {
    const key = mapAssetTypeToBalanceKey(String(row.asset_type ?? ""));
    if (!key) continue;
    rows.push({
      assetTypeKey: key,
      description:
        row.description !== null && row.description !== undefined
          ? String(row.description).trim() || null
          : null,
      originalCurrency: String(row.original_currency ?? "CHF").trim().toUpperCase(),
      originalAmountMinor: toBigIntAmount(row.original_amount),
      fxRateDisplay: String(row.fx_rate ?? "1").trim(),
      chfRappen: toBigIntAmount(row.amount),
    });
  }
  return rows;
}

export async function getEffectiveResidenceCanton(
  client: SupabaseClient<Database>,
  profileId: string,
): Promise<string> {
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("residence_canton")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!profileError && profile?.residence_canton) {
    const c = String(profile.residence_canton).trim().toUpperCase();
    if (c.length >= 2) {
      return c.slice(0, 2);
    }
  }

  const ctx = await getSwissTaxContextForUser(client, profileId);
  return (ctx?.canton ?? "ZH").toUpperCase();
}
