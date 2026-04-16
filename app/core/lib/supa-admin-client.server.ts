/**
 * Supabase Admin Client Module
 *
 * This module creates a Supabase client with admin privileges using the service role key.
 * The admin client has elevated permissions and can bypass Row Level Security (RLS) policies,
 * allowing it to perform administrative operations that regular user clients cannot.
 *
 * SECURITY WARNING: This client should only be used in server-side code and never exposed to the client.
 * The service role key has full access to the database and can bypass all security rules.
 *
 * Use cases for the admin client include:
 * - User management operations (creating, updating, deleting users)
 * - Data migrations and seeding
 * - Administrative operations that need to bypass RLS
 * - Background jobs and scheduled tasks
 * - Server-side operations that need elevated permissions
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";

import { createClient } from "@supabase/supabase-js";

let cachedAdminClient: SupabaseClient<Database> | null = null;

function readRequiredEnv(
  name: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY",
): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`${name} is required.`);
  }
  return value;
}

/**
 * Returns a singleton Supabase admin client. Lazily created so importing this module
 * does not throw during build-time prerender when env vars are absent.
 */
export function getAdminClient(): SupabaseClient<Database> {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  cachedAdminClient = createClient<Database>(
    readRequiredEnv("SUPABASE_URL"),
    readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  return cachedAdminClient;
}
