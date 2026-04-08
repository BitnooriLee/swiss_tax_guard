import { desc, eq } from "drizzle-orm";
import { authUsers } from "drizzle-orm/supabase";

import db from "~/core/db/drizzle-client.server";
import { asset_ledger } from "~/features/assets/schema";

/**
 * Removes all ledger rows for the auth user with this email (server DB, bypasses RLS).
 * Use for E2E isolation when reusing TAX_GUARD_TEST_USER_EMAIL or before deleting a disposable user.
 */
export async function deleteAssetLedgerRowsForEmail(email: string) {
  const rows = await db
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(eq(authUsers.email, email))
    .limit(1);

  const userId = rows[0]?.id;
  if (!userId) {
    return;
  }

  await db.delete(asset_ledger).where(eq(asset_ledger.user_id, userId));
}

/**
 * Latest ledger row for E2E assertions (server DB, bypasses RLS).
 */
export async function getLatestAssetLedgerRowForEmail(email: string) {
  const rows = await db
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(eq(authUsers.email, email))
    .limit(1);

  const userId = rows[0]?.id;
  if (!userId) {
    return null;
  }

  const ledger = await db
    .select({
      original_currency: asset_ledger.original_currency,
      amount: asset_ledger.amount,
      original_amount: asset_ledger.original_amount,
      fx_rate: asset_ledger.fx_rate,
    })
    .from(asset_ledger)
    .where(eq(asset_ledger.user_id, userId))
    .orderBy(desc(asset_ledger.created_at))
    .limit(1);

  return ledger[0] ?? null;
}
