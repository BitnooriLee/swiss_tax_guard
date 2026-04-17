/**
 * Public site origin for auth redirects (magic link, OAuth, etc.).
 *
 * Prefers the **incoming request origin** when it is not localhost, so
 * `emailRedirectTo` matches the deployment the user is on (production, preview,
 * or custom domain). Falls back to {@link process.env.SITE_URL}, then the request.
 *
 * Supabase rejects unknown redirect origins with `requested path is invalid` unless
 * the URL matches **Authentication → URL Configuration → Redirect URLs** (use
 * `https://your-domain.com/**` and for Vercel previews `https://*-.vercel.app/**`).
 *
 * Note: Do not use a `.server.ts` filename here — route modules that also export
 * `meta` / components cannot top-level-import `.server` modules (React Router client/server split).
 */
export function getPublicOrigin(request: Request): string {
  let requestOrigin: string | null = null;
  try {
    const u = new URL(request.url);
    const isLocal =
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname === "[::1]";
    if (!isLocal && u.origin && u.origin !== "null") {
      requestOrigin = u.origin;
    }
  } catch {
    // ignore
  }

  if (requestOrigin) {
    return requestOrigin;
  }

  const raw = process.env.SITE_URL?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      // Invalid SITE_URL; fall back to request URL.
    }
  }

  return new URL(request.url).origin;
}
