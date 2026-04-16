/**
 * Resend Email Client Module
 *
 * Lazily creates a Resend client so importing this module does not throw during
 * build-time prerender when `RESEND_API_KEY` is unset (e.g. Vercel preview).
 *
 * Call `getResendClient()` only from server actions/loaders that send email.
 */
import { Resend } from "resend";

let cachedClient: Resend | null = null;

function readResendApiKey(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.trim() === "") {
    throw new Error("RESEND_API_KEY is required.");
  }
  return key;
}

/**
 * Returns a singleton Resend client configured with {@link process.env.RESEND_API_KEY}.
 */
export function getResendClient(): Resend {
  if (cachedClient) {
    return cachedClient;
  }
  cachedClient = new Resend(readResendApiKey());
  return cachedClient;
}
