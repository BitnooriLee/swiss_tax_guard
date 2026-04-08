import { useMemo, useState } from "react";

import { Input } from "~/core/components/ui/input";

import { formatCHF } from "../lib/format-chf";
import { parseCHFToRappen } from "../lib/parse-chf";

type Props = {
  marginalRateBps: number;
};

export default function ScenarioSimulator({ marginalRateBps }: Props) {
  const [contributionInput, setContributionInput] = useState<string>("7056");

  const { contributionRappen, estimatedSavingsRappen } = useMemo(() => {
    const parsed = parseCHFToRappen(contributionInput);
    const safeContribution = parsed < 0n ? 0n : parsed;
    const savings = (safeContribution * BigInt(marginalRateBps)) / 10000n;
    return {
      contributionRappen: safeContribution,
      estimatedSavingsRappen: savings,
    };
  }, [contributionInput, marginalRateBps]);

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold tracking-tight">Scenario simulator</h3>
        <p className="text-sm text-muted-foreground">
          Estimate tax impact from your 3rd Pillar (Pillar 3a) contribution.
        </p>
      </div>

      <div className="mt-5 space-y-2">
        <label
          htmlFor="pillar3a-contribution"
          className="text-sm font-medium text-foreground"
        >
          Annual Pillar 3a Contribution (CHF)
        </label>
        <Input
          id="pillar3a-contribution"
          inputMode="decimal"
          value={contributionInput}
          onChange={(event) => setContributionInput(event.target.value)}
          placeholder="e.g. 7'056.00"
        />
      </div>

      <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/30 p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Potential tax savings
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-[#10b981]">
          CHF {formatCHF(estimatedSavingsRappen)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Based on your estimated marginal tax rate of {(marginalRateBps / 100).toFixed(2)}%.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Contribution entered: CHF {formatCHF(contributionRappen)}
        </p>
      </div>
    </section>
  );
}
