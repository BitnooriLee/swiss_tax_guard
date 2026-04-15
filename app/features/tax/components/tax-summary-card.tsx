import { Building2Icon, LandmarkIcon, ScaleIcon } from "lucide-react";

import { Separator } from "~/core/components/ui/separator";

import { formatCHF } from "../lib/format-chf";
import { DashboardCard, DashboardCardBody } from "./dashboard-card";

type Props = {
  federalRappen: bigint;
  cantonalRappen: bigint;
  municipalRappen: bigint;
  taxYear: number;
  canton: string;
};

function Row({
  icon: Icon,
  label,
  rappen,
}: {
  icon: typeof ScaleIcon;
  label: string;
  rappen: bigint;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 shrink-0 text-foreground/70" aria-hidden />
        <span>{label}</span>
      </div>
      <span className="text-sm font-semibold tabular-nums text-foreground">
        CHF {formatCHF(rappen)}
      </span>
    </div>
  );
}

/**
 * Federal / cantonal / municipal breakdown (stub split until layered seeds exist).
 */
export default function TaxSummaryCard({
  federalRappen,
  cantonalRappen,
  municipalRappen,
  taxYear,
  canton,
}: Props) {
  const total = federalRappen + cantonalRappen + municipalRappen;

  return (
    <DashboardCard aria-labelledby="tax-summary-heading">
      <div className="min-h-[52px]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="tax-summary-heading" className="text-lg font-semibold tracking-tight">
            Estimated income tax
          </h2>
          <p className="text-sm text-muted-foreground" data-testid="tax-summary-canton">
            {taxYear} · {canton}
          </p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Illustrative layer split for display; combined model uses canton marginal
          brackets until federal/municipal tables are wired.
        </p>
      </div>
      <DashboardCardBody>
        <Separator className="my-4" />
        <Row icon={ScaleIcon} label="Federal (stub share)" rappen={federalRappen} />
        <Row icon={LandmarkIcon} label="Cantonal (stub share)" rappen={cantonalRappen} />
        <Row
          icon={Building2Icon}
          label="Municipal (stub share)"
          rappen={municipalRappen}
        />
        <Separator className="my-4" />
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Total estimated</span>
          <span className="text-base font-semibold tabular-nums text-[#f59e0b]">
            CHF {formatCHF(total)}
          </span>
        </div>
      </DashboardCardBody>
    </DashboardCard>
  );
}
