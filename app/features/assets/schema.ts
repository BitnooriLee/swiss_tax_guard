/**
 * Immutable asset ledger for append-only transaction logs.
 * `amount` is always CHF in Rappen (smallest unit). Multi-currency rows store
 * the user-entered face value in `original_amount` (that currency's minor unit)
 * and the applied spot rate in `fx_rate` at insert time (atomic record rule).
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { authUid, authUsers, authenticatedRole } from "drizzle-orm/supabase";

import { timestamps } from "~/core/db/helpers.server";

export const assetTypeEnum = pgEnum("asset_type", ["cash", "crypto", "stock"]);
export const assetActionTypeEnum = pgEnum("asset_action_type", [
  "INFLOW",
  "OUTFLOW",
  "ADJUSTMENT",
]);

export const asset_ledger = pgTable(
  "asset_ledger",
  {
    id: uuid("id").notNull().defaultRandom().primaryKey(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    asset_type: assetTypeEnum("asset_type").notNull(),
    action_type: assetActionTypeEnum("action_type").notNull(),
    description: text("description"),
    /** CHF value in Rappen at transaction time (never recomputed from FX). */
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    external_api_id: text("external_api_id"),
    /** Legacy display column; keep aligned with `original_currency` on writes. */
    currency: text("currency").notNull().default("CHF"),
    original_currency: text("original_currency").notNull().default("CHF"),
    /** Minor units of `original_currency` (Rappen for CHF, cents for USD/EUR, etc.). */
    original_amount: bigint("original_amount", { mode: "bigint" }).notNull(),
    /** Units of `to` per one unit of `from` (e.g. CHF per 1 USD), min 6 decimal places stored. */
    fx_rate: numeric("fx_rate", { precision: 18, scale: 10 }).notNull().default("1"),
    ...timestamps,
  },
  (table) => [
    pgPolicy("asset-ledger-select-policy", {
      for: "select",
      to: authenticatedRole,
      as: "permissive",
      using: sql`${authUid} = ${table.user_id}`,
    }),
    pgPolicy("asset-ledger-insert-policy", {
      for: "insert",
      to: authenticatedRole,
      as: "permissive",
      withCheck: sql`${authUid} = ${table.user_id}`,
    }),
  ],
).enableRLS();
