import type { TaxCategoryBreakdownItem } from "../tax.types";
import { formatCHF } from "../lib/format-chf";
import {
  DashboardCard,
  DashboardCardBody,
  DashboardCardDescription,
  DashboardCardHeader,
  DashboardCardTitle,
} from "./dashboard-card";

type Props = {
  items: TaxCategoryBreakdownItem[];
  /** Optional relocation / canton comparison (pre-rendered sentence). */
  taxOptimizationHint?: string | null;
};

function getImpactTextClass(taxWeight: number): string {
  if (taxWeight >= 50) return "text-[#ef4444]";
  if (taxWeight >= 25) return "text-[#f59e0b]";
  return "text-[#10b981]";
}

export default function TaxInsights({ items, taxOptimizationHint }: Props) {
  return (
    <DashboardCard>
      <DashboardCardHeader>
        <DashboardCardTitle>Tax Category Insights</DashboardCardTitle>
        <DashboardCardDescription>
          Approximate tax-driving share by asset category.
        </DashboardCardDescription>
      </DashboardCardHeader>

      <DashboardCardBody className="space-y-4">
        {taxOptimizationHint ? (
          <p
            className="rounded-lg bg-muted/40 px-3 py-2.5 text-sm text-foreground/90"
            data-testid="tax-optimization-hint"
          >
            {taxOptimizationHint}
          </p>
        ) : null}

        <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
          <span>Asset Category</span>
          <span className="text-right">Current Value</span>
          <span className="text-right">Estimated Tax Impact</span>
        </div>
        {items.map((item) => (
          <div
            key={item.category}
            data-testid={`tax-insight-${item.category.toLowerCase()}`}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md border border-border/60 bg-background/50 px-3 py-2.5"
          >
            <span className="text-sm font-medium text-foreground">{item.category}</span>
            <span className="text-right text-sm tabular-nums text-foreground/90">
              CHF {formatCHF(item.amount)}
            </span>
            <span
              data-testid={`tax-insight-weight-${item.category.toLowerCase()}`}
              className={`text-right text-sm font-semibold tabular-nums ${getImpactTextClass(item.taxWeight)}`}
            >
              {item.taxWeight.toFixed(2)}%
            </span>
          </div>
        ))}
      </DashboardCardBody>
    </DashboardCard>
  );
}
