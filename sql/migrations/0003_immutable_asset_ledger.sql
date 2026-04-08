CREATE TYPE "public"."asset_action_type" AS ENUM('INFLOW', 'OUTFLOW', 'ADJUSTMENT');--> statement-breakpoint
CREATE TABLE "asset_ledger_next" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_type" "asset_type" NOT NULL,
	"action_type" "asset_action_type" NOT NULL,
	"description" text,
	"amount" bigint NOT NULL,
	"external_api_id" text,
	"currency" text DEFAULT 'CHF' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "asset_ledger_next" (
	"user_id",
	"asset_type",
	"action_type",
	"description",
	"amount",
	"currency"
)
SELECT
	"user_id",
	"asset_type",
	'ADJUSTMENT'::"asset_action_type",
	'Migration adjustment from snapshot balance',
	SUM("amount"),
	COALESCE(MAX("currency"), 'CHF')
FROM "asset_ledger"
GROUP BY "user_id", "asset_type";--> statement-breakpoint
ALTER TABLE "asset_ledger_next" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "asset_ledger_next" ADD CONSTRAINT "asset_ledger_next_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP TABLE "asset_ledger";--> statement-breakpoint
ALTER TABLE "asset_ledger_next" RENAME TO "asset_ledger";--> statement-breakpoint
CREATE POLICY "asset-ledger-select-policy" ON "asset_ledger" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "asset_ledger"."user_id");--> statement-breakpoint
CREATE POLICY "asset-ledger-insert-policy" ON "asset_ledger" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "asset_ledger"."user_id");--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.asset_ledger_block_mutations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'asset_ledger is immutable; use INSERT only';
END;
$$;--> statement-breakpoint
CREATE TRIGGER asset_ledger_block_update
BEFORE UPDATE ON public.asset_ledger
FOR EACH ROW
EXECUTE FUNCTION public.asset_ledger_block_mutations();--> statement-breakpoint
CREATE TRIGGER asset_ledger_block_delete
BEFORE DELETE ON public.asset_ledger
FOR EACH ROW
EXECUTE FUNCTION public.asset_ledger_block_mutations();--> statement-breakpoint
