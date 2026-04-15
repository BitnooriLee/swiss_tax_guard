import type { SafeToSpendRiskBand } from "../tax.types";

import { formatCHF } from "../lib/format-chf";
import { DashboardCard } from "./dashboard-card";

const RISK_ACCENT: Record<SafeToSpendRiskBand, string> = {
  SAFE: "#10b981",
  WARNING: "#f59e0b",
  CRITICAL: "#ef4444",
};

const RISK_LABEL: Record<SafeToSpendRiskBand, string> = {
  SAFE: "Comfortable buffer",
  WARNING: "Tax reserves tight vs liquidity",
  CRITICAL: "Liquidity shortfall vs tax debt",
};

type Props = {
  safeToSpendRappen: bigint;
  riskBand: SafeToSpendRiskBand;
  estimatedTaxDebtRappen: bigint;
};

export default function SafeToSpendHero({
  safeToSpendRappen,
  riskBand,
  estimatedTaxDebtRappen,
}: Props) {
  const accent = RISK_ACCENT[riskBand];

  return (
    <DashboardCard
      className="flex min-h-[220px] flex-col justify-between"
      aria-labelledby="safe-to-spend-heading"
    >
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          Safe to spend (after tax debt)
        </p>
        <h2
          id="safe-to-spend-heading"
          data-testid="safe-to-spend-value"
          className="mt-2 font-sans text-4xl font-semibold tracking-tight tabular-nums"
          style={{ color: accent }}
        >
          CHF {formatCHF(safeToSpendRappen)}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{RISK_LABEL[riskBand]}</p>
      </div>
      <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tax reserved (debt)
        </p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
          CHF {formatCHF(estimatedTaxDebtRappen)}
        </p>
      </div>
    </DashboardCard>
  );
}
