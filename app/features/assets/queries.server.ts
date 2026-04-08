import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "database.types";

export type AssetHistoryPoint = {
  date: string;
  totalAmount: bigint;
};

function toBigIntAmount(raw: unknown): bigint {
  if (typeof raw === "bigint") return raw;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return BigInt(Math.trunc(raw));
  }
  if (typeof raw === "string" && /^-?\d+$/.test(raw)) {
    return BigInt(raw);
  }
  return 0n;
}

function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function addUtcDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dayKeyUtc(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Net-worth trend from immutable asset ledger.
 * Returns one point per UTC day with gap-filled cumulative balances in Rappen.
 *
 * Regression guard: `e2e/tax-guard.spec.ts` checks last chart point vs dashboard total;
 * keep baseline + in-window summation consistent with `getCurrentBalances` in tax queries.
 */
export async function getAssetHistory(
  client: SupabaseClient<Database>,
  userId: string,
  days: number = 30,
): Promise<AssetHistoryPoint[]> {
  const safeDays = Number.isFinite(days) ? Math.max(1, Math.trunc(days)) : 30;
  const endExclusive = addUtcDays(startOfUtcDay(new Date()), 1);
  const startInclusive = addUtcDays(endExclusive, -safeDays);

  const [{ data: baselineRows, error: baselineError }, { data: rows, error: rowsError }] =
    await Promise.all([
      client
        .from("asset_ledger")
        .select("amount")
        .eq("user_id", userId)
        .lt("created_at", startInclusive.toISOString()),
      client
        .from("asset_ledger")
        .select("amount,created_at")
        .eq("user_id", userId)
        .gte("created_at", startInclusive.toISOString())
        .lt("created_at", endExclusive.toISOString())
        .order("created_at", { ascending: true }),
    ]);

  if (baselineError || rowsError) {
    if (import.meta.env.DEV) {
      console.error("[getAssetHistory]", baselineError ?? rowsError);
    }
    const flat: AssetHistoryPoint[] = [];
    for (let i = 0; i < safeDays; i += 1) {
      const day = addUtcDays(startInclusive, i);
      flat.push({ date: dayKeyUtc(day), totalAmount: 0n });
    }
    return flat;
  }

  let baseline = 0n;
  for (const row of baselineRows ?? []) {
    baseline += toBigIntAmount(row.amount);
  }
  const dailyDelta = new Map<string, bigint>();

  for (const row of rows ?? []) {
    if (!row?.created_at) continue;
    const key = dayKeyUtc(new Date(row.created_at));
    const amount = toBigIntAmount(row.amount);
    dailyDelta.set(key, (dailyDelta.get(key) ?? 0n) + amount);
  }

  const history: AssetHistoryPoint[] = [];
  let running = baseline;
  for (let i = 0; i < safeDays; i += 1) {
    const day = addUtcDays(startInclusive, i);
    const key = dayKeyUtc(day);
    running += dailyDelta.get(key) ?? 0n;
    history.push({ date: key, totalAmount: running });
  }

  return history;
}
