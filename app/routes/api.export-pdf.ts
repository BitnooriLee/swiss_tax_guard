import type { LoaderFunctionArgs } from "react-router";

import { requireAuthentication } from "~/core/lib/guards.server";
import makeServerClient from "~/core/lib/supa-client.server";
import { getAssetLedgerReportRows } from "~/features/tax/queries.server";
import { generateTaxReportPDF } from "~/features/tax/services/report-generator.server";
import { computeTaxDashboardCalculation } from "~/features/tax/tax-dashboard.server";
import { getUserProfile } from "~/features/users/queries";

/**
 * Authenticated PDF export: Swiss Asset & Tax Statement (matches dashboard calculation).
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const [client] = makeServerClient(request);
  await requireAuthentication(client);

  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [profile, calculation, assetRows] = await Promise.all([
    getUserProfile(client, { userId: user.id }),
    computeTaxDashboardCalculation(client, user.id),
    getAssetLedgerReportRows(client, user.id),
  ]);

  const userDisplayName = profile?.name?.trim() || user.email || "Account";
  const buffer = await generateTaxReportPDF(calculation, {
    userDisplayName,
    assetRows,
  });

  const filename = `swiss-tax-guard-statement-${calculation.taxYear}.pdf`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
