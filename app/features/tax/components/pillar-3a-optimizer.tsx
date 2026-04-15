import { useMemo, useState } from "react";
import { useFetcher } from "react-router";

import { Button } from "~/core/components/ui/button";
import { Input } from "~/core/components/ui/input";

import { maxPillar3aEmployeeContributionRappen } from "../data/tax-constants";
import { formatCHF } from "../lib/format-chf";
import { calculate3aTaxSaving, clampPillar3aContributionRappen } from "../lib/pillar-3a-math";
import { parseCHFToRappen } from "../lib/parse-chf";

type ActionData =
  | { success: true }
  | { success: false; error: string }
  | undefined;

type Props = {
  marginalRateBps: number;
  taxYear: number;
  savedContributionRappen: bigint;
  embedded?: boolean;
};

const RAPPEN_PER_CHF = 100n;

export default function Pillar3aOptimizer({
  marginalRateBps,
  taxYear,
  savedContributionRappen,
  embedded = false,
}: Props) {
  const fetcher = useFetcher<ActionData>();
  const maxRappen = maxPillar3aEmployeeContributionRappen(taxYear);
  const maxChfWholeNumber = Number(maxRappen / RAPPEN_PER_CHF);

  const [draftRappen, setDraftRappen] = useState(() =>
    clampPillar3aContributionRappen(savedContributionRappen, taxYear),
  );

  const savingsRappen = useMemo(
    () => calculate3aTaxSaving(draftRappen, marginalRateBps),
    [draftRappen, marginalRateBps],
  );

  const sliderWholeChf = useMemo(() => {
    const whole = draftRappen / RAPPEN_PER_CHF;
    const n = Number(whole);
    return Number.isFinite(n) ? n : 0;
  }, [draftRappen]);

  const chfInputString = useMemo(() => formatCHF(draftRappen), [draftRappen]);

  return (
    <section
      className={
        embedded
          ? "rounded-lg bg-gradient-to-b from-emerald-50/40 to-amber-50/30 p-5 dark:from-emerald-950/20 dark:to-amber-950/10"
          : "rounded-xl border border-emerald-600/20 bg-gradient-to-b from-emerald-50/40 to-amber-50/30 p-6 shadow-sm dark:border-emerald-500/20 dark:from-emerald-950/20 dark:to-amber-950/10"
      }
      data-testid="pillar-3a-optimizer"
    >
      <div className="space-y-1">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">
          Pillar 3a tax optimizer
        </h3>
        <p className="text-sm text-muted-foreground">
          Simulate your annual Pillar 3a contribution (max CHF {formatCHF(maxRappen)} for tax year{" "}
          {taxYear}
          ). Apply to refresh Safe-to-Spend with a lower estimated income-tax reserve.
        </p>
      </div>

      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="pillar-3a-slider"
            className="text-sm font-medium text-amber-800 dark:text-amber-200/90"
          >
            Contribution (CHF, whole francs)
          </label>
          <input
            id="pillar-3a-slider"
            type="range"
            min={0}
            max={maxChfWholeNumber}
            step={1}
            value={Math.min(sliderWholeChf, maxChfWholeNumber)}
            onChange={(event) => {
              const whole = Number.parseInt(event.target.value, 10);
              const safe = Number.isFinite(whole) ? Math.max(0, whole) : 0;
              setDraftRappen(
                clampPillar3aContributionRappen(BigInt(safe) * RAPPEN_PER_CHF, taxYear),
              );
            }}
            className="h-2 w-full cursor-pointer accent-emerald-600"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="pillar-3a-chf-input" className="text-sm font-medium text-foreground">
            Exact amount (CHF)
          </label>
          <Input
            id="pillar-3a-chf-input"
            inputMode="decimal"
            defaultValue={chfInputString}
            key={chfInputString}
            onBlur={(event) => {
              const parsed = parseCHFToRappen(event.target.value);
              const next = parsed < 0n ? 0n : parsed;
              setDraftRappen(clampPillar3aContributionRappen(next, taxYear));
            }}
            placeholder="e.g. 7'258.00"
          />
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-dashed border-emerald-600/35 bg-white/60 p-4 dark:border-emerald-500/30 dark:bg-background/40">
        <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300/90">
          Estimated tax saving
        </p>
        <p
          className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400"
          data-testid="pillar-3a-estimated-saving"
        >
          +CHF {formatCHF(savingsRappen)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Based on marginal rate {(marginalRateBps / 100).toFixed(2)}%. Not legal or financial
          advice; demo estimate only.
        </p>
      </div>

      <fetcher.Form method="post" className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input type="hidden" name="intent" value="apply-pillar-3a" />
        <input type="hidden" name="pillar_3a_contribution_rappen" value={draftRappen.toString()} />
        <Button
          type="submit"
          disabled={fetcher.state !== "idle"}
          className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          data-testid="pillar-3a-apply"
        >
          {fetcher.state !== "idle" ? "Saving…" : "Apply to dashboard"}
        </Button>
        {fetcher.data && !fetcher.data.success ? (
          <p className="text-sm text-destructive" data-testid="pillar-3a-apply-error">
            {fetcher.data.error}
          </p>
        ) : null}
      </fetcher.Form>
    </section>
  );
}
