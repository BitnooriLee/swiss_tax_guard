/**
 * Authentication and Request Guards Module
 *
 * This module provides utility functions for protecting routes and API endpoints
 * by enforcing authentication and HTTP method requirements. These guards are designed
 * to be used in React Router loaders and actions to ensure proper access control
 * and request validation.
 *
 * This module includes:
 * - Session helpers that tolerate Supabase `getUser()` rejections (no spurious 500s)
 * - Authentication guard to ensure a user is logged in
 * - HTTP method guard to ensure requests use the correct HTTP method
 */
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { data } from "react-router";

import type { Database } from "database.types";

type AppSupabaseClient = SupabaseClient<Database>;

/**
 * Resolves the current session user, or null if unauthenticated or if Supabase
 * throws (e.g. AuthSessionMissingError). Never rejects — avoids 500s from raw getUser().
 */
export async function getSessionUser(
  client: AppSupabaseClient,
): Promise<User | null> {
  try {
    const { data, error } = await client.auth.getUser();
    if (error) return null;
    return data.user ?? null;
  } catch {
    return null;
  }
}

/**
 * Require user authentication for a route or action; returns the signed-in user.
 *
 * @throws {Response} 401 Unauthorized if no user is authenticated
 */
export async function requireUser(client: AppSupabaseClient): Promise<User> {
  const user = await getSessionUser(client);
  if (!user) {
    throw data(null, { status: 401 });
  }
  return user;
}

/**
 * Require user authentication for a route or action (void variant).
 *
 * @throws {Response} 401 Unauthorized if no user is authenticated
 */
export async function requireAuthentication(client: AppSupabaseClient) {
  await requireUser(client);
}

/**
 * Require a specific HTTP method for a route action
 *
 * This function returns a middleware that checks if the incoming request uses
 * the specified HTTP method. If not, it throws a 405 Method Not Allowed response.
 * This is useful for ensuring that endpoints only accept the intended HTTP methods.
 *
 * @param method - The required HTTP method (e.g., 'GET', 'POST', 'PUT', 'DELETE')
 * @returns A function that validates the request method
 * @throws {Response} 405 Method Not Allowed if the request uses an incorrect method
 */
export function requireMethod(method: string) {
  return (request: Request) => {
    if (request.method !== method) {
      throw data(null, { status: 405 });
    }
  };
}
