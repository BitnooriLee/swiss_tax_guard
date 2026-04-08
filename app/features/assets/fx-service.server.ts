/**
 * Server-side FX quotes with a short-lived in-memory cache (1h TTL).
 * Rates are returned as decimal strings (10 fractional digits) so ledger code
 * can round to Rappen without passing through binary floats for the stored rate.
 */

const CACHE_TTL_MS = 60 * 60 * 1000;

type CacheEntry = {
  rate: string;
  expiresAt: number;
};

const rateCache = new Map<string, CacheEntry>();

/** CHF per one unit of `code` (e.g. USD → ~0.90 CHF per 1 USD). Dev fallback only. */
const MOCK_CHF_PER_UNIT: Record<string, string> = {
  CHF: "1.0000000000",
  EUR: "0.9600000000",
  USD: "0.9000000000",
  GBP: "1.1500000000",
};

function cacheKey(from: string, to: string): string {
  return `${from}:${to}`;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function formatRate(n: number): string {
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Invalid numeric rate");
  }
  return n.toFixed(10);
}

/**
 * CHF per one unit of `from` via Frankfurter, or mock table when offline.
 */
async function chfPerUnit(from: string): Promise<string> {
  const base = normalizeCode(from);
  if (base === "CHF") {
    return "1.0000000000";
  }

  const key = cacheKey(base, "CHF");
  const now = Date.now();
  const hit = rateCache.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.rate;
  }

  let rateStr: string;
  try {
    const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=CHF`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) {
      throw new Error(`Frankfurter HTTP ${res.status}`);
    }
    const body = (await res.json()) as { rates?: Record<string, number> };
    const raw = body.rates?.CHF;
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
      throw new Error("Missing or invalid CHF rate");
    }
    rateStr = formatRate(raw);
  } catch {
    rateStr = MOCK_CHF_PER_UNIT[base] ?? "1.0000000000";
  }

  rateCache.set(key, { rate: rateStr, expiresAt: now + CACHE_TTL_MS });
  return rateStr;
}

/**
 * Units of `to` per one unit of `from` (e.g. CHF per 1 USD when to=CHF).
 * Cached per (from,to) pair for one hour.
 */
export async function getExchangeRate(
  from: string,
  to: string = "CHF",
): Promise<string> {
  const base = normalizeCode(from);
  const quote = normalizeCode(to);

  if (base === quote) {
    return "1.0000000000";
  }

  const directKey = cacheKey(base, quote);
  const now = Date.now();
  const directHit = rateCache.get(directKey);
  if (directHit && directHit.expiresAt > now) {
    return directHit.rate;
  }

  if (quote === "CHF") {
    return chfPerUnit(base);
  }

  const chfPerFromStr = await chfPerUnit(base);
  const chfPerToStr = await chfPerUnit(quote);
  const chfPerFrom = Number(chfPerFromStr);
  const chfPerTo = Number(chfPerToStr);
  const cross = chfPerFrom / chfPerTo;
  const rateStr = formatRate(cross);
  rateCache.set(directKey, { rate: rateStr, expiresAt: now + CACHE_TTL_MS });
  return rateStr;
}
