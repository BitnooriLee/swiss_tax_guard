import type { SafeToSpendRiskBand } from "../tax.types";
import { DashboardCard } from "./dashboard-card";

const RISK_ACCENT: Record<SafeToSpendRiskBand, string> = {
  SAFE: "#10b981",
  WARNING: "#f59e0b",
  CRITICAL: "#ef4444",
};

type Props = {
  estimatedTaxDebtRappen: bigint;
  totalLiquidAssetsRappen: bigint;
  riskBand: SafeToSpendRiskBand;
};

/**
 * Arc gauge: estimated tax debt as a share of liquid assets (cap 100%).
 */
export default function SafeToSpendDial({
  estimatedTaxDebtRappen,
  totalLiquidAssetsRappen,
  riskBand,
}: Props) {
  const accent = RISK_ACCENT[riskBand];
  let ratio = 0;
  if (totalLiquidAssetsRappen > 0n) {
    ratio = Number(
      (estimatedTaxDebtRappen * 10000n) / totalLiquidAssetsRappen,
    ) / 10000;
  } else if (estimatedTaxDebtRappen > 0n) {
    ratio = 1;
  }
  ratio = Math.min(1, Math.max(0, ratio));

  const radius = 52;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const dash = circumference * (1 - ratio);

  return (
    <DashboardCard
      className="flex min-h-[220px] flex-col items-center justify-center"
      aria-label="Tax debt versus liquid assets"
    >
      <div className="relative size-44">
        <svg
          width="176"
          height="176"
          viewBox="0 0 120 120"
          className="-rotate-90"
          role="img"
        >
          <title>Debt to liquidity ratio</title>
          <circle
            stroke="currentColor"
            className="text-muted"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx="60"
            cy="60"
          />
          <circle
            stroke={accent}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dash}
            strokeLinecap="round"
            r={normalizedRadius}
            cx="60"
            cy="60"
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-medium text-muted-foreground">
            Tax / liquidity
          </span>
          <span
            data-testid="tax-liquidity-ratio"
            className="text-xl font-semibold tabular-nums"
            style={{ color: accent }}
          >
            {Math.round(ratio * 100)}%
          </span>
        </div>
      </div>
      <p className="mt-4 max-w-xs text-center text-xs text-muted-foreground">
        Higher share means more of your liquid balance is earmarked for estimated
        income tax plus cantonal wealth tax (demo simulator).
      </p>
    </DashboardCard>
  );
}
