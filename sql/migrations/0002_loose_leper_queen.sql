CREATE TYPE "public"."asset_type" AS ENUM('cash', 'crypto', 'stock');--> statement-breakpoint
CREATE TYPE "public"."marital_status" AS ENUM('single', 'married', 'registered_partnership', 'divorced', 'widowed');--> statement-breakpoint
CREATE TABLE "asset_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_type" "asset_type" NOT NULL,
	"amount" bigint NOT NULL,
	"external_api_id" text,
	"currency" text DEFAULT 'CHF' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_ledger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "swiss_tax_contexts" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"canton" char(2) NOT NULL,
	"municipality_id" text DEFAULT '' NOT NULL,
	"marital_status" "marital_status" NOT NULL,
	"church_tax" boolean DEFAULT false NOT NULL,
	"children_count" smallint DEFAULT 0 NOT NULL,
	"moved_at" date,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "swiss_tax_contexts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tax_rate_brackets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"seed_id" bigint NOT NULL,
	"lower_bound" bigint NOT NULL,
	"upper_bound" bigint,
	"marginal_rate_bps" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tax_rate_brackets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tax_rate_seeds" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tax_year" integer NOT NULL,
	"canton" text NOT NULL,
	"municipality_id" text DEFAULT '' NOT NULL,
	"payload" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tax_rate_seeds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "asset_ledger" ADD CONSTRAINT "asset_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swiss_tax_contexts" ADD CONSTRAINT "swiss_tax_contexts_profile_id_profiles_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("profile_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rate_brackets" ADD CONSTRAINT "tax_rate_brackets_seed_id_tax_rate_seeds_id_fk" FOREIGN KEY ("seed_id") REFERENCES "public"."tax_rate_seeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tax_rate_seeds_year_canton_muni_idx" ON "tax_rate_seeds" USING btree ("tax_year","canton","municipality_id");--> statement-breakpoint
CREATE POLICY "asset-ledger-select-policy" ON "asset_ledger" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "asset_ledger"."user_id");--> statement-breakpoint
CREATE POLICY "asset-ledger-insert-policy" ON "asset_ledger" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "asset_ledger"."user_id");--> statement-breakpoint
CREATE POLICY "asset-ledger-update-policy" ON "asset_ledger" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "asset_ledger"."user_id") WITH CHECK ((select auth.uid()) = "asset_ledger"."user_id");--> statement-breakpoint
CREATE POLICY "asset-ledger-delete-policy" ON "asset_ledger" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "asset_ledger"."user_id");--> statement-breakpoint
CREATE POLICY "swiss-tax-contexts-select-policy" ON "swiss_tax_contexts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "swiss_tax_contexts"."profile_id");--> statement-breakpoint
CREATE POLICY "swiss-tax-contexts-insert-policy" ON "swiss_tax_contexts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "swiss_tax_contexts"."profile_id");--> statement-breakpoint
CREATE POLICY "swiss-tax-contexts-update-policy" ON "swiss_tax_contexts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "swiss_tax_contexts"."profile_id") WITH CHECK ((select auth.uid()) = "swiss_tax_contexts"."profile_id");--> statement-breakpoint
CREATE POLICY "swiss-tax-contexts-delete-policy" ON "swiss_tax_contexts" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "swiss_tax_contexts"."profile_id");--> statement-breakpoint
CREATE POLICY "tax-rate-brackets-select-policy" ON "tax_rate_brackets" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "tax-rate-seeds-select-policy" ON "tax_rate_seeds" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);