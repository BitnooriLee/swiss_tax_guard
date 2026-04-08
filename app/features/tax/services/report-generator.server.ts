import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";

import type { AssetLedgerReportRow } from "../queries.server";
import type { TaxDashboardCalculation } from "../tax.types";

import { TaxReportPdfDocument } from "./tax-report-pdf-document";

export type TaxReportPdfOptions = {
  userDisplayName: string;
  assetRows: AssetLedgerReportRow[];
};

/**
 * Renders a Swiss Asset & Tax Statement PDF on the server using the same Rappen strings
 * as the tax dashboard (`formatCHF` on `TaxDashboardCalculation` fields).
 *
 * @param data - Latest `TaxDashboardCalculation` for the authenticated user.
 * @param options - Display name and ledger lines from the same request session.
 */
export async function generateTaxReportPDF(
  data: TaxDashboardCalculation,
  options: TaxReportPdfOptions,
): Promise<Buffer> {
  const referenceDateLabel = `${data.taxYear}-12-31`;
  const tree = React.createElement(TaxReportPdfDocument, {
    calculation: data,
    userDisplayName: options.userDisplayName,
    referenceDateLabel,
    assetRows: options.assetRows,
  });
  // Root renders `<Document>`; upstream typings require a direct `<Document>` element.
  return renderToBuffer(
    tree as Parameters<typeof renderToBuffer>[0],
  );
}
