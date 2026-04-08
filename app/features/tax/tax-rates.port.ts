/**
 * Port for tax rate resolution — keeps services decoupled from ESTV/HTTP/DB.
 */

export type TaxBracketRow = {
  lowerBoundRappen: bigint;
  upperBoundRappen: bigint | null;
  marginalRateBps: number;
};

export type TaxRatesLookup = {
  taxYear: number;
  canton: string;
  municipalityId: string | null;
};

export interface TaxRatesPort {
  getIncomeBrackets(params: TaxRatesLookup): Promise<TaxBracketRow[]>;
}
