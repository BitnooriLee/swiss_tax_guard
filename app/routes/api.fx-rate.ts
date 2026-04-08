import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";

import { getExchangeRate } from "~/features/assets/fx-service.server";

const ALLOWED_FROM = new Set(["CHF", "EUR", "USD", "GBP"]);

/**
 * Resource route: CHF per one unit of `from` (Frankfurter-backed, cached).
 * Query: `?from=USD` → `{ rate: string }`.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const fromRaw = new URL(request.url).searchParams.get("from");
  const from = (fromRaw ?? "CHF").trim().toUpperCase();
  if (!ALLOWED_FROM.has(from)) {
    return data({ error: "Unsupported currency." }, { status: 400 });
  }

  const rate = await getExchangeRate(from, "CHF");
  return data({ rate, from });
}
