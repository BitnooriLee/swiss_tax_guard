/**
 * PKCE auth callback (magic link, email OTP link, etc.).
 *
 * Supabase redirects here with `?code=` or OAuth-style error query params.
 * Exchanges the code for a session on the server so auth cookies are set.
 */
import type { Route } from "./+types/auth-callback";

import { data, redirect } from "react-router";
import { z } from "zod";

import makeServerClient from "~/core/lib/supa-client.server";

export const meta: Route.MetaFunction = () => [
  { title: `Signing in | ${import.meta.env.VITE_APP_NAME}` },
];

const searchParamsSchema = z.object({
  code: z.string(),
});

const errorSchema = z.object({
  error: z.string(),
  error_code: z.string().optional(),
  error_description: z.string().optional(),
});

export async function loader({ request }: Route.LoaderArgs) {
  const { searchParams } = new URL(request.url);

  const parsedOk = searchParamsSchema.safeParse(
    Object.fromEntries(searchParams),
  );
  if (parsedOk.success) {
    const [client, headers] = makeServerClient(request);
    const { error } = await client.auth.exchangeCodeForSession(
      parsedOk.data.code,
    );
    if (error) {
      return data({ error: error.message }, { status: 400 });
    }
    return redirect("/dashboard/tax", { headers });
  }

  const parsedErr = errorSchema.safeParse(Object.fromEntries(searchParams));
  if (parsedErr.success) {
    const desc =
      parsedErr.data.error_description ??
      parsedErr.data.error ??
      "Sign-in failed";
    return data({ error: desc }, { status: 400 });
  }

  return data({ error: "Invalid sign-in link" }, { status: 400 });
}

export default function AuthCallback({ loaderData }: Route.ComponentProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 px-4 py-16">
      <h1 className="text-2xl font-semibold">Sign-in failed</h1>
      <p className="text-muted-foreground max-w-md text-center text-sm">
        {loaderData.error}
      </p>
      <p className="text-muted-foreground max-w-md text-center text-xs">
        If you see “requested path is invalid”, add this URL under Supabase
        Authentication → URL Configuration → Redirect URLs:{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">
          /auth/callback
        </code>{" "}
        on your site (or a wildcard like{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">
          https://your-domain.com/**
        </code>
        ).
      </p>
    </div>
  );
}
