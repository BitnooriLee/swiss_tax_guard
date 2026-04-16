/**
 * Public site origin for auth redirects (magic link, OAuth, etc.).
 *
 * Prefer {@link process.env.SITE_URL} when set so it matches Supabase Dashboard
 * "Site URL" / "Redirect URL" allow list. Otherwise use the incoming request origin
 * (correct for Vercel previews when SITE_URL is unset).
 */
export function getPublicOrigin(request: Request): string {
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
