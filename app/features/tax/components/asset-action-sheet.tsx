import { useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";

import { Button } from "~/core/components/ui/button";
import { Input } from "~/core/components/ui/input";
import { Label } from "~/core/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/core/components/ui/sheet";

import type { CurrentBalances } from "../queries.server";
import { formatCHF } from "../lib/format-chf";
import { parseCHFToRappen } from "../lib/parse-chf";

type AssetType = "cash" | "crypto" | "stock";
type ActionType = "INFLOW" | "OUTFLOW" | "ADJUSTMENT";
type LedgerCurrency = "CHF" | "EUR" | "USD" | "GBP";

type Props = {
  currentBalances: CurrentBalances;
  triggerClassName?: string;
};

const ACTION_COPY: Record<ActionType, { label: string; tone: string }> = {
  INFLOW: { label: "Deposit", tone: "text-emerald-600" },
  OUTFLOW: { label: "Withdrawal", tone: "text-red-600" },
  ADJUSTMENT: { label: "Market Adjustment", tone: "text-amber-600" },
};

type UpsertAssetResponse = { success?: boolean; error?: string };

type FxRatePayload = { rate?: string; from?: string; error?: string };

function readUpsertAssetResponse(data: unknown): UpsertAssetResponse | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if ("success" in record || "error" in record) {
    return record as UpsertAssetResponse;
  }
  for (const value of Object.values(record)) {
    if (
      value &&
      typeof value === "object" &&
      ("success" in value || "error" in value)
    ) {
      return value as UpsertAssetResponse;
    }
  }
  return null;
}

function signedOriginalMinorUnits(
  parsedMinor: bigint,
  actionType: ActionType,
): bigint {
  const absMinor = parsedMinor < 0n ? -parsedMinor : parsedMinor;
  if (actionType === "INFLOW") {
    return absMinor;
  }
  if (actionType === "OUTFLOW") {
    return -absMinor;
  }
  return parsedMinor;
}

function estimatedChfRappenPreview(
  signedOriginalMinor: bigint,
  currency: LedgerCurrency,
  fxRateStr: string,
): bigint | null {
  if (signedOriginalMinor === 0n) {
    return null;
  }
  if (currency === "CHF") {
    return signedOriginalMinor;
  }
  const fx = Number(fxRateStr);
  if (!Number.isFinite(fx) || fx <= 0) {
    return null;
  }
  return BigInt(Math.round(Number(signedOriginalMinor) * fx));
}

export default function AssetActionSheet({ currentBalances, triggerClassName }: Props) {
  const submitFetcher = useFetcher();
  const fxFetcher = useFetcher<FxRatePayload>();
  const [open, setOpen] = useState(false);
  const [assetType, setAssetType] = useState<AssetType>("cash");
  const [actionType, setActionType] = useState<ActionType>("INFLOW");
  const [currency, setCurrency] = useState<LedgerCurrency>("CHF");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const currentBalance =
    assetType === "cash"
      ? currentBalances.CASH
      : assetType === "crypto"
        ? currentBalances.CRYPTO
        : currentBalances.STOCK;

  const effectiveFxRateStr =
    currency === "CHF"
      ? "1.0000000000"
      : fxFetcher.state === "idle" &&
          typeof fxFetcher.data?.from === "string" &&
          fxFetcher.data.from === currency &&
          typeof fxFetcher.data.rate === "string"
        ? fxFetcher.data.rate
        : "";

  const fxReady = currency === "CHF" || effectiveFxRateStr.length > 0;

  useEffect(() => {
    if (currency === "CHF") {
      return;
    }
    fxFetcher.load(`/api/fx-rate?from=${encodeURIComponent(currency)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when currency changes only
  }, [currency]);

  const parsedMinor = useMemo(() => parseCHFToRappen(amount), [amount]);
  const signedOriginalPreview = useMemo(
    () => signedOriginalMinorUnits(parsedMinor, actionType),
    [parsedMinor, actionType],
  );
  const estimatedChfPreview = useMemo(
    () =>
      estimatedChfRappenPreview(signedOriginalPreview, currency, effectiveFxRateStr),
    [signedOriginalPreview, currency, effectiveFxRateStr],
  );

  useEffect(() => {
    if (submitFetcher.state !== "idle" || !submitFetcher.data) return;

    const response = readUpsertAssetResponse(submitFetcher.data);
    if (!response) return;

    if (response.success) {
      toast.success("Transaction recorded. Balance updated.");
      setOpen(false);
      setAmount("");
      setAssetType("cash");
      setActionType("INFLOW");
      setCurrency("CHF");
      setDescription("");
      return;
    }
    if (response.error) {
      toast.error(response.error);
    }
  }, [submitFetcher.state, submitFetcher.data]);

  const canSubmit =
    submitFetcher.state !== "submitting" &&
    amount.trim().length > 0 &&
    fxReady &&
    parsedMinor !== 0n;

  const rateDisplay =
    currency === "CHF"
      ? "1"
      : effectiveFxRateStr.length > 0
        ? Number(effectiveFxRateStr).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6,
          })
        : "…";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="default"
          className={triggerClassName}
          data-testid="asset-action-trigger"
        >
          Record Transaction
        </Button>
      </SheetTrigger>
      <SheetContent side="right" onPointerDownOutside={() => setOpen(false)}>
        <SheetHeader>
          <SheetTitle>Record Asset Transaction</SheetTitle>
          <SheetDescription>
            Add a new immutable ledger entry. Existing balances are never overwritten.
          </SheetDescription>
        </SheetHeader>

        <submitFetcher.Form
          method="post"
          className="space-y-4 px-4"
          data-testid="asset-action-form"
        >
          <input type="hidden" name="intent" value="upsert-asset" />
          <input type="hidden" name="original_currency" value={currency} />
          <input type="hidden" name="fx_rate" value={effectiveFxRateStr || "1.0000000000"} />

          <div className="space-y-2">
            <Label htmlFor="assetType">Asset Type</Label>
            <select
              id="assetType"
              name="assetType"
              data-testid="asset-type-select"
              value={assetType}
              onChange={(event) => setAssetType(event.target.value as AssetType)}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            >
              <option value="cash">Cash</option>
              <option value="crypto">Crypto</option>
              <option value="stock">Stock</option>
            </select>
          </div>

          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
            Current Balance: <span className="font-semibold">CHF {formatCHF(currentBalance)}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="actionType">Action Type</Label>
            <select
              id="actionType"
              name="actionType"
              data-testid="action-type-select"
              value={actionType}
              onChange={(event) => setActionType(event.target.value as ActionType)}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            >
              <option value="INFLOW">Deposit</option>
              <option value="OUTFLOW">Withdrawal</option>
              <option value="ADJUSTMENT">Market Adjustment</option>
            </select>
            <p className={`text-xs ${ACTION_COPY[actionType].tone}`}>
              {ACTION_COPY[actionType].label} will be added as a new transaction log.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <select
              id="currency"
              data-testid="currency-select"
              value={currency}
              onChange={(event) => setCurrency(event.target.value as LedgerCurrency)}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            >
              <option value="CHF">CHF</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount ({currency})</Label>
            <Input
              id="amount"
              name="amount"
              data-testid="amount-input"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={currency === "CHF" ? "e.g. 12'500.00" : "e.g. 10'000.00"}
              required
            />
          </div>

          {currency !== "CHF" && fxFetcher.state === "loading" ? (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Loading exchange rate…
            </div>
          ) : null}

          {currency !== "CHF" && fxFetcher.state === "idle" && fxFetcher.data?.error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              Could not load FX rate. Try again or pick CHF.
            </div>
          ) : null}

          {fxReady && estimatedChfPreview !== null ? (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Rate: 1 {currency} = {rateDisplay} CHF. Conversion:{" "}
              <span className="font-medium text-foreground">
                CHF {formatCHF(estimatedChfPreview)}
              </span>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              name="description"
              data-testid="description-input"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="e.g. Monthly savings"
              maxLength={140}
            />
          </div>

          <SheetFooter className="px-0">
            <Button
              type="submit"
              disabled={!canSubmit}
              data-testid="asset-action-submit"
            >
              {submitFetcher.state === "submitting" ? "Recording..." : "Record Transaction"}
            </Button>
          </SheetFooter>
        </submitFetcher.Form>
      </SheetContent>
    </Sheet>
  );
}
