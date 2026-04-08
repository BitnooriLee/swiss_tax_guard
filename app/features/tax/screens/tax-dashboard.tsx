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

  const [taxCalculation, assetHistory] = await Promise.all([
    computeTaxDashboardCalculation(client, uid),
    getAssetHistory(client, uid, selectedHistoryDays),
  ]);

  return {
    userDisplayName: profile?.name?.trim() || user?.email || "Account",
    userEmail: user?.email ?? null,
    selectedHistoryDays,
    taxCalculation: serializeTaxDashboardCalculation(taxCalculation),
    assetHistory: serializeAssetHistory(assetHistory),
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

function TaxDashboardBody({
  data,
  assetHistory,
  selectedHistoryDays,
}: {
  data: TaxDashboardCalculation;
  assetHistory: Array<{ date: string; totalAmount: bigint }>;
  selectedHistoryDays: HistoryDays;
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <AssetActionSheet currentBalances={currentBalances} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
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
      </div>
      <section className="space-y-3">
        <div className="flex items-center justify-end">
          <TimeRangePicker selectedDays={selectedHistoryDays} />
        </div>
        <AssetHistoryChart points={assetHistory} isPending={isRangePending} />
      </section>
      <TaxInsights
        items={taxCategoryBreakdown}
        taxOptimizationHint={taxOptimizationHint}
      />
      <Pillar3aOptimizer
        key={`${taxYear}-${pillar3aContributionRappen.toString()}`}
        marginalRateBps={marginalTaxRateBps}
        taxYear={taxYear}
        savedContributionRappen={pillar3aContributionRappen}
      />
      <TaxSummaryCard
        federalRappen={taxSummary.federalRappen}
        cantonalRappen={taxSummary.cantonalRappen}
        municipalRappen={taxSummary.municipalRappen}
        taxYear={taxYear}
        canton={canton}
      />
      <p className="text-xs text-muted-foreground">
        Liquid assets (ledger, CHF):{" "}
        <span className="font-medium text-foreground" data-testid="total-assets-value">
          {formatCHF(totalLiquidAssetsRappen)}
        </span>
        {currentBalances.hasForeignAssets ? (
          <span data-testid="foreign-assets-hint">
            {" "}
            Includes conversions from{" "}
            {currentBalances.foreignCurrencyCodes.join(", ")}.
          </span>
        ) : null}
        . Estimated income tax uses a demo taxable income until income is
        captured in-app; wealth tax uses the progressive canton simulator.
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
    userDisplayName,
    userEmail,
    selectedHistoryDays,
    taxCalculation: taxCalculationJson,
    assetHistory: assetHistoryJson,
  } = useLoaderData<typeof loader>();

  const taxCalculation = deserializeTaxDashboardCalculation(taxCalculationJson);
  const assetHistory = deserializeAssetHistory(assetHistoryJson);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            SwissTax Guard
          </h1>
          <p className="text-sm text-muted-foreground">
            {userDisplayName}
            {userEmail ? (
              <span className="text-muted-foreground"> · {userEmail}</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Button variant="outline" size="sm" asChild>
            <a href="/api/export-pdf" download>
              <FileDown className="size-4" aria-hidden />
              Download Statement
            </a>
          </Button>
          <ResidenceCantonSelect selectedCanton={taxCalculation.selectedCanton} />
        </div>
      </div>

      <TaxDashboardBody
        data={taxCalculation}
        assetHistory={assetHistory}
        selectedHistoryDays={selectedHistoryDays}
      />
    </div>
  );
}
