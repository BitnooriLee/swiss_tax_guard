/**
 * Tax rate seed tables: Hybrid Gateway — normalized brackets + raw ESTV-shaped payload.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

import { timestamps } from "~/core/db/helpers.server";

export const tax_rate_seeds = pgTable(
  "tax_rate_seeds",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    tax_year: integer("tax_year").notNull(),
    canton: text("canton").notNull(),
    /** Empty string = canton-default (no municipality override). */
    municipality_id: text("municipality_id").notNull().default(""),
    payload: jsonb("payload").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("tax_rate_seeds_year_canton_muni_idx").on(
      table.tax_year,
      table.canton,
      table.municipality_id,
    ),
    pgPolicy("tax-rate-seeds-select-policy", {
      for: "select",
      to: authenticatedRole,
      as: "permissive",
      using: sql`true`,
    }),
  ],
).enableRLS();

export const tax_rate_brackets = pgTable(
  "tax_rate_brackets",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    seed_id: bigint("seed_id", { mode: "bigint" })
      .notNull()
      .references(() => tax_rate_seeds.id, { onDelete: "cascade" }),
    /** Income slice lower bound inclusive (Rappen). */
    lower_bound: bigint("lower_bound", { mode: "bigint" }).notNull(),
    /** Income slice upper bound exclusive; null = unbounded. */
    upper_bound: bigint("upper_bound", { mode: "bigint" }),
    marginal_rate_bps: integer("marginal_rate_bps").notNull(),
    ...timestamps,
  },
  (table) => [
    pgPolicy("tax-rate-brackets-select-policy", {
      for: "select",
      to: authenticatedRole,
      as: "permissive",
      using: sql`true`,
    }),
  ],
).enableRLS();
