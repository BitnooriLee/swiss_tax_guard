/**
 * Adapter: in-memory ESTV-shaped seed document → normalized marginal brackets.
 */
import type { TaxBracketRow, TaxRatesLookup, TaxRatesPort } from "../tax-rates.port";

export type EstvSeedBracketJson = {
  lowerBoundRappen: string;
  upperBoundRappen: string | null;
  marginalRateBps: number;
};

export type EstvSeedEntryJson = {
  taxYear: number;
  canton: string;
  municipalityId: string | null;
  payload: unknown;
  brackets: EstvSeedBracketJson[];
};

export type EstvSeedDocumentJson = {
  meta?: { source?: string; schemaVersion?: number };
  seeds: EstvSeedEntryJson[];
};

function normalizeMunicipalityId(id: string | null): string {
  return id ?? "";
}

function toRows(brackets: EstvSeedBracketJson[]): TaxBracketRow[] {
  return brackets.map((b) => ({
    lowerBoundRappen: BigInt(b.lowerBoundRappen),
    upperBoundRappen:
      b.upperBoundRappen === null || b.upperBoundRappen === undefined
        ? null
        : BigInt(b.upperBoundRappen),
    marginalRateBps: b.marginalRateBps,
  }));
}

export class EstvJsonAdapter implements TaxRatesPort {
  constructor(private readonly document: EstvSeedDocumentJson) {}

  async getIncomeBrackets(params: TaxRatesLookup): Promise<TaxBracketRow[]> {
    const wantMuni = normalizeMunicipalityId(params.municipalityId);
    const exact = this.document.seeds.find(
      (s) =>
        s.taxYear === params.taxYear &&
        s.canton.toUpperCase() === params.canton.toUpperCase() &&
        normalizeMunicipalityId(s.municipalityId) === wantMuni,
    );
    if (exact) {
      return sortBrackets(toRows(exact.brackets));
    }
    const cantonWide = this.document.seeds.find(
      (s) =>
        s.taxYear === params.taxYear &&
        s.canton.toUpperCase() === params.canton.toUpperCase() &&
        normalizeMunicipalityId(s.municipalityId) === "",
    );
    if (cantonWide) {
      return sortBrackets(toRows(cantonWide.brackets));
    }
    return [];
  }
}

function sortBrackets(rows: TaxBracketRow[]): TaxBracketRow[] {
  return [...rows].sort((a, b) => {
    if (a.lowerBoundRappen === b.lowerBoundRappen) return 0;
    return a.lowerBoundRappen < b.lowerBoundRappen ? -1 : 1;
  });
}
