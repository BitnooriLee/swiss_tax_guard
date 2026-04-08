import type { Route } from "./+types/tax-dashboard";

import { FileDown } from "lucide-react";
import {
  data,
  redirect,
  useFetcher,
  useLoaderData,
  useNavigation,
} from "react-router";

import { Button } from "~/core/components/ui/button";
import { getSessionUser } from "~/core/lib/guards.server";
import makeServerClient from "~/core/lib/supa-client.server";
import { getAssetHistory } from "~/features/assets/queries.server";
import { getUserProfile } from "~/features/users/queries";

import AssetHistoryChart from "../components/asset-history-chart";
import SafeToSpendDial from "../components/safe-to-spend-dial";
import SafeToSpendHero from "../components/safe-to-spend-hero";
import AssetActionSheet from "../components/asset-action-sheet";
import Pillar3aOptimizer from "../components/pillar-3a-optimizer";
import TaxInsights from "../components/tax-insights";
import TaxSummaryCard from "../components/tax-summary-card";
import TimeRangePicker from "../components/time-range-picker";
import { formatCHF } from "../lib/format-chf";
import { parseCHFToRappen } from "../lib/parse-chf";
import {
  deserializeAssetHistory,
  deserializeTaxDashboardCalculation,
  serializeAssetHistory,
  serializeTaxDashboardCalculation,
} from "../lib/tax-dashboard-loader-json";
import { RESIDENCE_CANTON_OPTIONS } from "../data/tax-constants";
import {
  computeTaxDashboardCalculation,
  updatePillar3aContributionForUser,
  updateResidenceCantonForUser,
} from "../tax-dashboard.server";
import type { TaxDashboardCalculation } from "../tax.types";

export const meta: Route.MetaFunction = () => {
  return [{ title: `Tax dashboard | ${import.meta.env.VITE_APP_NAME}` }];
};

const ALLOWED_HISTORY_DAYS = [7, 30, 90] as const;
type HistoryDays = (typeof ALLOWED_HISTORY_DAYS)[number];

const LEDGER_CURRENCIES = ["CHF", "EUR", "USD", "GBP"] as const;
type LedgerCurrency = (typeof LEDGER_CURRENCIES)[number];

function isLedgerCurrency(value: string): value is LedgerCurrency {
  return (LEDGER_CURRENCIES as readonly string[]).includes(value);
}

function parseHistoryDaysFromUrl(requestUrl: string): HistoryDays {
  const rawDays = new URL(requestUrl).searchParams.get("days");
  const parsed = Number(rawDays);
  if (!Number.isInteger(parsed)) {
    return 30;
  }
  return ALLOWED_HISTORY_DAYS.includes(parsed as HistoryDays)
    ? (parsed as HistoryDays)
    : 30;
}

function zugWealthTaxOptimizationHint(
  selectedCanton: string,
  currentWealthTaxRappen: bigint,
  zugWealthTaxRappen: bigint,
): string | null {
  if (selectedCanton === "ZG") {
    return null;
  }
  const diff = currentWealthTaxRappen - zugWealthTaxRappen;
  if (diff === 0n) {
    return null;
  }
  const abs = diff < 0n ? -diff : diff;
  const formatted = formatCHF(abs);
  if (diff > 0n) {
    return `In Zug (ZG), your estimated wealth tax would be approximately CHF ${formatted} lower (demo brackets).`;
  }
  return `In Zug (ZG), your estimated wealth tax would be approximately CHF ${formatted} higher (demo brackets).`;
}

/**
 * Await tax + history in the loader so fetcher revalidation always replaces UI data.
 * (Deferred promises + <Await> can keep stale resolved values across revalidations.)
 */
export async function loader({ request }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);
  const user = await getSessionUser(client);
  if (!user) {
    throw redirect("/login");
  }
  const uid = user.id;

  const profile = await getUserProfile(client, { userId: uid });
  const selectedHistoryDays = parseHistoryDaysFromUrl(request.url);

  const [taxCalculation, assetHistory, recentLedgerResult] = await Promise.all([
    computeTaxDashboardCalculation(client, uid),
    getAssetHistory(client, uid, selectedHistoryDays),
    client
      .from("asset_ledger")
      .select(
        "id, asset_type, action_type, description, amount, original_currency, created_at",
      )
      .eq("user_id", uid as never)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const recentLedger = (recentLedgerResult.data ?? []).map((row) => ({
    id: String((row as Record<string, unknown>).id ?? ""),
    assetType: String((row as Record<string, unknown>).asset_type ?? ""),
    actionType: String((row as Record<string, unknown>).action_type ?? ""),
    description:
      (row as Record<string, unknown>).description != null
        ? String((row as Record<string, unknown>).description)
        : null,
    amountRappenStr: String((row as Record<string, unknown>).amount ?? "0"),
    currency: String((row as Record<string, unknown>).original_currency ?? "CHF"),
    createdAt: String((row as Record<string, unknown>).created_at ?? ""),
  }));

  return {
    userDisplayName: profile?.name?.trim() || user?.email || "Account",
    userEmail: user?.email ?? null,
    selectedHistoryDays,
    taxCalculation: serializeTaxDashboardCalculation(taxCalculation),
    assetHistory: serializeAssetHistory(assetHistory),
    recentLedger,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const [client] = makeServerClient(request);
  const sessionUser = await getSessionUser(client);
  if (!sessionUser) {
    return data({ success: false, error: "Unauthorized request." }, { status: 401 });
  }
  const userId = sessionUser.id;

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "apply-pillar-3a") {
    const raw = formData.get("pillar_3a_contribution_rappen");
    let contributionRappen = 0n;
    if (typeof raw === "string" && /^-?\d+$/.test(raw.trim())) {
      contributionRappen = BigInt(raw.trim());
    }
    const taxYear = new Date().getFullYear();
    const result = await updatePillar3aContributionForUser(
      client,
      userId,
      contributionRappen,
      taxYear,
    );
    if (!result.ok) {
      return data({ success: false, error: result.error }, { status: 400 });
    }
    return { success: true };
  }

  if (intent === "update-canton") {
    const rawCanton = formData.get("canton");
    const result = await updateResidenceCantonForUser(
      client,
      userId,
      typeof rawCanton === "string" ? rawCanton : "",
    );
    if (!result.ok) {
      return data({ success: false, error: result.error }, { status: 400 });
    }
    return { success: true };
  }

  if (intent !== "upsert-asset") {
    return data({ success: false, error: "Unsupported action." }, { status: 400 });
  }

  const rawType = formData.get("assetType");
  const rawActionType = formData.get("actionType");
  const rawAmount = formData.get("amount");
  const rawDescription = formData.get("description");
  const rawOriginalCurrency = formData.get("original_currency");
  const rawFxRate = formData.get("fx_rate");

  const assetType = typeof rawType === "string" ? rawType.toLowerCase() : "";
  const actionType = typeof rawActionType === "string" ? rawActionType.toUpperCase() : "";
  const description = typeof rawDescription === "string" ? rawDescription.trim() : "";
  const originalCurrencyRaw =
    typeof rawOriginalCurrency === "string"
      ? rawOriginalCurrency.trim().toUpperCase()
      : "CHF";
  if (!isLedgerCurrency(originalCurrencyRaw)) {
    return data({ success: false, error: "Invalid currency." }, { status: 400 });
  }
  const originalCurrency = originalCurrencyRaw;

  if (!["cash", "crypto", "stock"].includes(assetType)) {
    return data({ success: false, error: "Invalid asset type." }, { status: 400 });
  }
  if (!["INFLOW", "OUTFLOW", "ADJUSTMENT"].includes(actionType)) {
    return data({ success: false, error: "Invalid action type." }, { status: 400 });
  }
  if (typeof rawAmount !== "string") {
    return data({ success: false, error: "Amount is required." }, { status: 400 });
  }

  const fxRateStr =
    originalCurrency === "CHF"
      ? "1.0000000000"
      : typeof rawFxRate === "string" && rawFxRate.trim().length > 0
        ? rawFxRate.trim()
        : "";
  if (originalCurrency !== "CHF" && fxRateStr.length === 0) {
    return data(
      { success: false, error: "FX rate is required for non-CHF currency." },
      { status: 400 },
    );
  }

  const fxRateNum = Number(fxRateStr);
  if (!Number.isFinite(fxRateNum) || fxRateNum <= 0) {
    return data({ success: false, error: "Invalid FX rate." }, { status: 400 });
  }

  const originalMinor = parseCHFToRappen(rawAmount);
  if (originalMinor === 0n) {
    return data(
      { success: false, error: "Amount must be non-zero." },
      { status: 400 },
    );
  }

  const absoluteMinor = originalMinor < 0n ? -originalMinor : originalMinor;
  const signedOriginalMinor =
    actionType === "INFLOW"
      ? absoluteMinor
      : actionType === "OUTFLOW"
        ? -absoluteMinor
        : originalMinor;

  const signedChfRappen =
    originalCurrency === "CHF"
      ? signedOriginalMinor
      : BigInt(Math.round(Number(signedOriginalMinor) * fxRateNum));

  const { error: insertError } = await client.from("asset_ledger").insert(
    {
      user_id: userId,
      asset_type: assetType,
      action_type: actionType,
      description: description.length > 0 ? description : null,
      amount: signedChfRappen.toString(),
      currency: originalCurrency,
      original_currency: originalCurrency,
      original_amount: signedOriginalMinor.toString(),
      fx_rate: fxRateStr,
    } as never,
  );
  if (insertError) {
    return data(
      { success: false, error: "Failed to record transaction." },
      { status: 500 },
    );
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// RecentLedgerEntry type (loader shape — amounts stay as strings from DB)
// ---------------------------------------------------------------------------
type RecentLedgerEntry = {
  id: string;
  assetType: string;
  actionType: string;
  description: string | null;
  amountRappenStr: string;
  currency: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Asset Allocation Doughnut (pure SVG — no external chart library)
// ---------------------------------------------------------------------------
function buildArcPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const x1 = cx + outerR * Math.cos(startAngle);
  const y1 = cy + outerR * Math.sin(startAngle);
  const x2 = cx + outerR * Math.cos(endAngle);
  const y2 = cy + outerR * Math.sin(endAngle);
  const ix1 = cx + innerR * Math.cos(startAngle);
  const iy1 = cy + innerR * Math.sin(startAngle);
  const ix2 = cx + innerR * Math.cos(endAngle);
  const iy2 = cy + innerR * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `L ${ix2.toFixed(2)} ${iy2.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function AssetDistributionPie({
  currentBalances,
}: {
  currentBalances: TaxDashboardCalculation["currentBalances"];
}) {
  const rawSegments = [
    { label: "Cash", valueRappen: currentBalances.CASH, color: "#10b981", dot: "bg-emerald-500" },
    { label: "Stocks", valueRappen: currentBalances.STOCK, color: "#3b82f6", dot: "bg-blue-500" },
    { label: "Crypto", valueRappen: currentBalances.CRYPTO, color: "#f59e0b", dot: "bg-amber-500" },
  ].filter((s) => s.valueRappen > 0n);

  const totalRappen = rawSegments.reduce((sum, s) => sum + s.valueRappen, 0n);
  const cx = 50;
  const cy = 50;
  const outerR = 42;
  const innerR = 27;

  const arcs: Array<{
    path: string;
    color: string;
    label: string;
    pct: number;
    dot: string;
    valueRappen: bigint;
  }> = [];
  let startAngle = -Math.PI / 2;

  for (const seg of rawSegments) {
    const fraction = Number(seg.valueRappen) / Number(totalRappen);
    const sweepAngle = fraction * 2 * Math.PI;
    const endAngle = startAngle + sweepAngle;
    arcs.push({
      path: buildArcPath(cx, cy, outerR, innerR, startAngle, endAngle),
      color: seg.color,
      label: seg.label,
      pct: Math.round(fraction * 100),
      dot: seg.dot,
      valueRappen: seg.valueRappen,
    });
    startAngle = endAngle;
  }

  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm dark:border-border dark:bg-card">
      <h2 className="mb-4 text-sm font-semibold tracking-tight text-slate-700 dark:text-foreground">
        Asset Allocation
      </h2>
      {totalRappen === 0n ? (
        <p className="text-sm text-muted-foreground">No assets recorded yet.</p>
      ) : (
        <div className="flex items-center gap-6">
          <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0" aria-hidden>
            {arcs.map((arc) => (
              <path key={arc.label} d={arc.path} fill={arc.color} />
            ))}
          </svg>
          <ul className="flex flex-1 flex-col gap-2.5">
            {arcs.map((arc) => (
              <li key={arc.label} className="flex items-center gap-2 text-xs">
                <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${arc.dot}`} />
                <span className="text-slate-500 dark:text-muted-foreground">{arc.label}</span>
                <span className="ml-auto font-semibold tabular-nums text-slate-800 dark:text-foreground">
                  {arc.pct}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Quick Actions card (Add Asset + Export PDF + Canton selector)
// ---------------------------------------------------------------------------
function QuickActionsCard({
  currentBalances,
  selectedCanton,
}: {
  currentBalances: TaxDashboardCalculation["currentBalances"];
  selectedCanton: string;
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm dark:border-border dark:bg-card">
      <h2 className="mb-4 text-sm font-semibold tracking-tight text-slate-700 dark:text-foreground">
        Quick Actions
      </h2>
      <div className="flex flex-col gap-2.5">
        <AssetActionSheet currentBalances={currentBalances} />
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-xs"
          asChild
        >
          <a href="/api/export-pdf" download>
            <FileDown className="size-3.5" aria-hidden />
            Export PDF Statement
          </a>
        </Button>
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <ResidenceCantonSelect selectedCanton={selectedCanton} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Recent Transactions mini-list
// ---------------------------------------------------------------------------
const ASSET_EMOJI: Record<string, string> = {
  cash: "💵",
  crypto: "₿",
  stock: "📈",
};

function formatEntryDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "short",
  });
}

function RecentTransactionsCard({ entries }: { entries: RecentLedgerEntry[] }) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm dark:border-border dark:bg-card">
      <h2 className="mb-3 text-sm font-semibold tracking-tight text-slate-700 dark:text-foreground">
        Recent Entries
      </h2>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">No ledger entries yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/60">
          {entries.map((entry) => {
            const amount = BigInt(entry.amountRappenStr);
            const isInflow = amount >= 0n;
            const absAmount = isInflow ? amount : -amount;
            return (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-2 py-2.5 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-base leading-none">
                    {ASSET_EMOJI[entry.assetType] ?? "📦"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium capitalize text-slate-800 dark:text-foreground">
                      {entry.description ??
                        `${entry.assetType} ${entry.actionType.toLowerCase()}`}
                    </p>
                    <p className="text-muted-foreground">{formatEntryDate(entry.createdAt)}</p>
                  </div>
                </div>
                <span
                  className={`shrink-0 font-semibold tabular-nums ${
                    isInflow ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {isInflow ? "+" : "−"}CHF {formatCHF(absAmount)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Command Center: 3-column responsive grid
// ---------------------------------------------------------------------------
function TaxDashboardBody({
  data,
  assetHistory,
  selectedHistoryDays,
  recentLedger,
}: {
  data: TaxDashboardCalculation;
  assetHistory: Array<{ date: string; totalAmount: bigint }>;
  selectedHistoryDays: HistoryDays;
  recentLedger: RecentLedgerEntry[];
}) {
  const navigation = useNavigation();
  const isRangePending = navigation.state !== "idle";
  const {
    safeToSpend,
    taxSummary,
    taxYear,
    canton,
    selectedCanton,
    totalLiquidAssetsRappen,
    marginalTaxRateBps,
    currentBalances,
    taxCategoryBreakdown,
    estimatedCantonTax,
    zugWealthTaxRappen,
    pillar3aContributionRappen,
  } = data;

  const taxOptimizationHint = zugWealthTaxOptimizationHint(
    selectedCanton,
    estimatedCantonTax,
    zugWealthTaxRappen,
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Command Center Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* ── Column A: Financial Core (4/12) ── */}
        <div className="flex flex-col gap-5 lg:col-span-4">
          <SafeToSpendHero
            safeToSpendRappen={safeToSpend.safeToSpendRappen}
            riskBand={safeToSpend.riskBand}
            estimatedTaxDebtRappen={safeToSpend.estimatedTaxDebtRappen}
          />
          <SafeToSpendDial
            estimatedTaxDebtRappen={safeToSpend.estimatedTaxDebtRappen}
            totalLiquidAssetsRappen={safeToSpend.totalLiquidAssetsRappen}
            riskBand={safeToSpend.riskBand}
          />
          <TaxSummaryCard
            federalRappen={taxSummary.federalRappen}
            cantonalRappen={taxSummary.cantonalRappen}
            municipalRappen={taxSummary.municipalRappen}
            taxYear={taxYear}
            canton={canton}
          />
          <Pillar3aOptimizer
            key={`${taxYear}-${pillar3aContributionRappen.toString()}`}
            marginalRateBps={marginalTaxRateBps}
            taxYear={taxYear}
            savedContributionRappen={pillar3aContributionRappen}
          />
        </div>

        {/* ── Column B: Growth & Allocation (5/12) ── */}
        <div className="flex flex-col gap-5 lg:col-span-5">
          <section>
            <div className="mb-3 flex items-center justify-end">
              <TimeRangePicker selectedDays={selectedHistoryDays} />
            </div>
            <AssetHistoryChart points={assetHistory} isPending={isRangePending} />
          </section>
          <AssetDistributionPie currentBalances={currentBalances} />
        </div>

        {/* ── Column C: Intelligence & Actions (3/12) ── */}
        <div className="flex flex-col gap-5 lg:col-span-3">
          <QuickActionsCard
            currentBalances={currentBalances}
            selectedCanton={selectedCanton}
          />
          <TaxInsights
            items={taxCategoryBreakdown}
            taxOptimizationHint={taxOptimizationHint}
          />
          <RecentTransactionsCard entries={recentLedger} />
        </div>
      </div>

      {/* Footnote */}
      <p className="text-xs text-muted-foreground">
        Liquid assets (ledger, CHF):{" "}
        <span className="font-medium text-foreground" data-testid="total-assets-value">
          {formatCHF(totalLiquidAssetsRappen)}
        </span>
        {currentBalances.hasForeignAssets ? (
          <span data-testid="foreign-assets-hint">
            {" "}
            Includes conversions from {currentBalances.foreignCurrencyCodes.join(", ")}.
          </span>
        ) : null}
        . Estimated income tax uses a demo taxable income until income is captured in-app;
        wealth tax uses the progressive canton simulator.
      </p>
    </div>
  );
}

function ResidenceCantonSelect({ selectedCanton }: { selectedCanton: string }) {
  const fetcher = useFetcher<typeof action>();

  return (
    <fetcher.Form
      method="post"
      className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2"
    >
      <input type="hidden" name="intent" value="update-canton" />
      <label
        htmlFor="residence-canton"
        className="text-xs font-medium tracking-wide text-muted-foreground"
      >
        Location
      </label>
      <select
        id="residence-canton"
        name="canton"
        key={selectedCanton}
        defaultValue={selectedCanton}
        disabled={fetcher.state !== "idle"}
        data-testid="residence-canton-select"
        onChange={(event) => {
          fetcher.submit(event.currentTarget.form);
        }}
        className="min-w-[10.5rem] cursor-pointer rounded-md border-0 bg-muted/50 py-1.5 pl-2 pr-8 text-sm text-foreground shadow-none outline-none ring-0 transition-[box-shadow,background-color] focus:bg-muted focus:ring-2 focus:ring-emerald-600/25 focus:ring-offset-0 dark:focus:ring-emerald-500/30"
      >
        {RESIDENCE_CANTON_OPTIONS.map(({ code, label }) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
      {fetcher.data && !fetcher.data.success ? (
        <p className="mt-1 text-xs text-destructive" data-testid="canton-update-error">
          {(fetcher.data as { success: false; error: string }).error}
        </p>
      ) : null}
    </fetcher.Form>
  );
}

export default function TaxDashboardScreen() {
  const {
    selectedHistoryDays,
    taxCalculation: taxCalculationJson,
    assetHistory: assetHistoryJson,
    recentLedger,
  } = useLoaderData<typeof loader>();

  const taxCalculation = deserializeTaxDashboardCalculation(taxCalculationJson);
  const assetHistory = deserializeAssetHistory(assetHistoryJson);

  return (
    <TaxDashboardBody
      data={taxCalculation}
      assetHistory={assetHistory}
      selectedHistoryDays={selectedHistoryDays}
      recentLedger={recentLedger}
    />
  );
}
