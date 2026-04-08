/**
 * Swiss tax residency context (1:1 with profiles.profile_id).
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  date,
  pgEnum,
  pgPolicy,
  pgTable,
  smallint,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { authUid, authenticatedRole } from "drizzle-orm/supabase";

import { timestamps } from "~/core/db/helpers.server";
import { profiles } from "~/features/users/schema";

export const maritalStatusEnum = pgEnum("marital_status", [
  "single",
  "married",
  "registered_partnership",
  "divorced",
  "widowed",
]);

export const swiss_tax_contexts = pgTable(
  "swiss_tax_contexts",
  {
    profile_id: uuid("profile_id")
      .primaryKey()
      .references(() => profiles.profile_id, { onDelete: "cascade" }),
    canton: char("canton", { length: 2 }).notNull(),
    municipality_id: text("municipality_id").notNull().default(""),
    marital_status: maritalStatusEnum("marital_status").notNull(),
    church_tax: boolean("church_tax").notNull().default(false),
    children_count: smallint("children_count").notNull().default(0),
    moved_at: date("moved_at"),
    ...timestamps,
  },
  (table) => [
    pgPolicy("swiss-tax-contexts-select-policy", {
      for: "select",
      to: authenticatedRole,
      as: "permissive",
      using: sql`${authUid} = ${table.profile_id}`,
    }),
    pgPolicy("swiss-tax-contexts-insert-policy", {
      for: "insert",
      to: authenticatedRole,
      as: "permissive",
      withCheck: sql`${authUid} = ${table.profile_id}`,
    }),
    pgPolicy("swiss-tax-contexts-update-policy", {
      for: "update",
      to: authenticatedRole,
      as: "permissive",
      using: sql`${authUid} = ${table.profile_id}`,
      withCheck: sql`${authUid} = ${table.profile_id}`,
    }),
    pgPolicy("swiss-tax-contexts-delete-policy", {
      for: "delete",
      to: authenticatedRole,
      as: "permissive",
      using: sql`${authUid} = ${table.profile_id}`,
    }),
  ],
).enableRLS();
