import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatCHF } from "../lib/format-chf";
import type { AssetLedgerReportRow } from "../queries.server";
import type { TaxDashboardCalculation } from "../tax.types";

const CATEGORY_ORDER = ["CASH", "STOCK", "CRYPTO"] as const;

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 40,
    color: "#111827",
  },
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9,
    color: "#6b7280",
    marginBottom: 16,
    lineHeight: 1.35,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 3,
  },
  tableHeader: {
    flexDirection: "row",
    marginBottom: 4,
    paddingBottom: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#d1d5db",
  },
  row: {
    flexDirection: "row",
    marginBottom: 3,
    lineHeight: 1.25,
  },
  colDesc: { width: "30%" },
  colOrig: { width: "22%" },
  colFx: { width: "20%" },
  colChf: { width: "28%", textAlign: "right" },
  headerText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: "#374151",
  },
  subtotalRow: {
    flexDirection: "row",
    marginTop: 4,
    marginBottom: 8,
    paddingTop: 3,
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
  },
  subtotalLabel: { width: "72%", textAlign: "right", fontFamily: "Helvetica-Bold" },
  subtotalValue: { width: "28%", textAlign: "right", fontFamily: "Helvetica-Bold" },
  liabilityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  liabilityLabel: { width: "65%" },
  liabilityValue: { width: "35%", textAlign: "right", fontFamily: "Helvetica" },
  grandTotalRow: {
    flexDirection: "row",
    marginTop: 10,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#111827",
  },
  grandLabel: {
    width: "72%",
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  grandValue: {
    width: "28%",
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  footer: {
    marginTop: 22,
    fontSize: 7,
    color: "#9ca3af",
    lineHeight: 1.45,
  },
});

export type TaxReportPdfDocumentProps = {
  calculation: TaxDashboardCalculation;
  userDisplayName: string;
  referenceDateLabel: string;
  assetRows: AssetLedgerReportRow[];
};

type DisplayLine = {
  description: string;
  originalDisplay: string;
  fxDisplay: string;
  chfDisplay: string;
};

function formatOriginalMinor(minor: bigint, currency: string): string {
  return `${formatCHF(minor)} ${currency}`;
}

function buildDisplayLines(
  calculation: TaxDashboardCalculation,
  assetRows: AssetLedgerReportRow[],
): Map<(typeof CATEGORY_ORDER)[number], DisplayLine[]> {
  const map = new Map<(typeof CATEGORY_ORDER)[number], DisplayLine[]>();
  for (const cat of CATEGORY_ORDER) {
    map.set(cat, []);
  }

  if (assetRows.length === 0) {
    for (const cat of CATEGORY_ORDER) {
      const bal = calculation.currentBalances[cat];
      map.get(cat)!.push({
        description: "Aggregated balance (no line-level ledger)",
        originalDisplay: `${formatCHF(bal)} CHF`,
        fxDisplay: "1.0000000000",
        chfDisplay: formatCHF(bal),
      });
    }
    return map;
  }

  for (const r of assetRows) {
    map.get(r.assetTypeKey)!.push({
      description: r.description ?? "Ledger entry",
      originalDisplay: formatOriginalMinor(
        r.originalAmountMinor,
        r.originalCurrency,
      ),
      fxDisplay: r.fxRateDisplay,
      chfDisplay: formatCHF(r.chfRappen),
    });
  }
  return map;
}

function categorySubtotalChf(
  cat: (typeof CATEGORY_ORDER)[number],
  assetRows: AssetLedgerReportRow[],
  calculation: TaxDashboardCalculation,
): bigint {
  if (assetRows.length === 0) {
    return calculation.currentBalances[cat];
  }
  let sum = 0n;
  for (const r of assetRows) {
    if (r.assetTypeKey === cat) {
      sum += r.chfRappen;
    }
  }
  return sum;
}

/**
 * React-PDF document tree for the Swiss Asset & Tax Statement.
 */
export function TaxReportPdfDocument({
  calculation,
  userDisplayName,
  referenceDateLabel,
  assetRows,
}: TaxReportPdfDocumentProps) {
  const lineGroups = buildDisplayLines(calculation, assetRows);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View wrap>
          <Text style={styles.title}>Swiss Asset & Tax Statement</Text>
          <Text style={styles.subtitle}>
            {userDisplayName}
            {"\n"}
            Reference date: {referenceDateLabel} · Residence canton:{" "}
            {calculation.selectedCanton}
            {"\n"}
            Tax year: {calculation.taxYear}
          </Text>

          <Text style={styles.sectionTitle}>1. Asset inventory</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.colDesc, styles.headerText]}>Category / Description</Text>
            <Text style={[styles.colOrig, styles.headerText]}>Original amount</Text>
            <Text style={[styles.colFx, styles.headerText]}>FX rate</Text>
            <Text style={[styles.colChf, styles.headerText]}>CHF value</Text>
          </View>

          {CATEGORY_ORDER.map((cat) => {
            const lines = lineGroups.get(cat) ?? [];
            const sub = categorySubtotalChf(cat, assetRows, calculation);
            return (
              <View key={cat} wrap={false}>
                <Text
                  style={{
                    fontFamily: "Helvetica-Bold",
                    marginBottom: 2,
                    marginTop: 4,
                    fontSize: 8,
                    color: "#374151",
                  }}
                >
                  {cat}
                </Text>
                {lines.map((line, idx) => (
                  <View key={`${cat}-${idx}`} style={styles.row}>
                    <Text style={styles.colDesc}>{line.description}</Text>
                    <Text style={styles.colOrig}>{line.originalDisplay}</Text>
                    <Text style={styles.colFx}>{line.fxDisplay}</Text>
                    <Text style={styles.colChf}>{line.chfDisplay}</Text>
                  </View>
                ))}
                <View style={styles.subtotalRow}>
                  <Text style={styles.subtotalLabel}>Subtotal ({cat})</Text>
                  <Text style={styles.subtotalValue}>{formatCHF(sub)}</Text>
                </View>
              </View>
            );
          })}

          <View style={styles.grandTotalRow}>
            <Text style={styles.grandLabel}>Total liquid assets (CHF, dashboard)</Text>
            <Text style={styles.grandValue}>
              {formatCHF(calculation.totalLiquidAssetsRappen)}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>2. Tax liabilities (simulation)</Text>
          <View style={styles.liabilityRow}>
            <Text style={styles.liabilityLabel}>Estimated income tax (after 3a offset)</Text>
            <Text style={styles.liabilityValue}>
              CHF {formatCHF(calculation.estimatedIncomeTaxRappen)}
            </Text>
          </View>
          <View style={styles.liabilityRow}>
            <Text style={styles.liabilityLabel}>
              Progressive wealth tax ({calculation.selectedCanton}, demo brackets)
            </Text>
            <Text style={styles.liabilityValue}>
              CHF {formatCHF(calculation.estimatedCantonTax)}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>3. Deductions and optimizations</Text>
          <View style={styles.liabilityRow}>
            <Text style={styles.liabilityLabel}>Pillar 3a contributions (annual)</Text>
            <Text style={styles.liabilityValue}>
              CHF {formatCHF(calculation.pillar3aContributionRappen)}
            </Text>
          </View>
          <View style={styles.liabilityRow}>
            <Text style={styles.liabilityLabel}>Estimated income tax savings (3a, marginal)</Text>
            <Text style={styles.liabilityValue}>
              CHF {formatCHF(calculation.pillar3aTaxSavingRappen)}
            </Text>
          </View>

          <Text style={styles.footer}>
            Generated by STG - Swiss Tax Guard. This is an informative simulation for tax
            planning purposes. It is not tax advice, a binding assessment, or a filing
            document. Verify all figures with a qualified professional and official cantonal
            guidance.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
