/**
 * Swiss third-pillar (Pillar 3a) statutory maxima for employed persons (Rappen).
 * @see PROJECT_PLAN.md Task 5 / 13 — scenario & deduction tooling.
 */

/**
 * All 26 Swiss cantons for residence selection (ISO 2-letter codes).
 * Keep in sync with `app/db/seeds/tax_rates.json` and `canton-tax-rates.ts`.
 * Labels are English exonyms + code for scanning in the dropdown.
 */
export const RESIDENCE_CANTON_OPTIONS = [
  { code: "AG", label: "Aargau (AG)" },
  { code: "AI", label: "Appenzell Innerrhoden (AI)" },
  { code: "AR", label: "Appenzell Ausserrhoden (AR)" },
  { code: "BE", label: "Bern (BE)" },
  { code: "BL", label: "Basel-Landschaft (BL)" },
  { code: "BS", label: "Basel-Stadt (BS)" },
  { code: "FR", label: "Fribourg (FR)" },
  { code: "GE", label: "Geneva (GE)" },
  { code: "GL", label: "Glarus (GL)" },
  { code: "GR", label: "Grisons (GR)" },
  { code: "JU", label: "Jura (JU)" },
  { code: "LU", label: "Lucerne (LU)" },
  { code: "NE", label: "Neuchâtel (NE)" },
  { code: "NW", label: "Nidwalden (NW)" },
  { code: "OW", label: "Obwalden (OW)" },
  { code: "SG", label: "St. Gallen (SG)" },
  { code: "SH", label: "Schaffhausen (SH)" },
  { code: "SO", label: "Solothurn (SO)" },
  { code: "SZ", label: "Schwyz (SZ)" },
  { code: "TG", label: "Thurgau (TG)" },
  { code: "TI", label: "Ticino (TI)" },
  { code: "UR", label: "Uri (UR)" },
  { code: "VD", label: "Vaud (VD)" },
  { code: "VS", label: "Valais (VS)" },
  { code: "ZG", label: "Zug (ZG)" },
  { code: "ZH", label: "Zurich (ZH)" },
] as const;

export type SwissResidenceCantonCode =
  (typeof RESIDENCE_CANTON_OPTIONS)[number]["code"];

/** @deprecated Use SwissResidenceCantonCode — kept for any external imports. */
export type DemoResidenceCantonCode = SwissResidenceCantonCode;

/** Set of ISO canton codes accepted by `updateResidenceCantonForUser`. */
export const DEMO_RESIDENCE_CANTON_CODES = new Set<string>(
  RESIDENCE_CANTON_OPTIONS.map((o) => o.code),
);

/** 2024 maximum employee Pillar 3a deduction: CHF 7'056.00 */
export const MAX_3A_EMPLOYEE_2024 = 705_600n;

/** 2025 maximum employee Pillar 3a deduction: CHF 7'258.00 */
export const MAX_3A_EMPLOYEE_2025 = 725_800n;

/**
 * Legal ceiling for simulated / stored employee Pillar 3a contributions by tax year.
 * Years from 2025 onward use the latest known cap until updated for future tax acts.
 */
export function maxPillar3aEmployeeContributionRappen(taxYear: number): bigint {
  if (taxYear < 2025) {
    return MAX_3A_EMPLOYEE_2024;
  }
  return MAX_3A_EMPLOYEE_2025;
}
