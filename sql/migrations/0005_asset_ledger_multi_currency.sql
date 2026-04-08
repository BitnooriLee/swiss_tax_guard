ALTER TABLE "asset_ledger" ADD COLUMN "original_currency" text DEFAULT 'CHF' NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_ledger" ADD COLUMN "original_amount" bigint;--> statement-breakpoint
ALTER TABLE "asset_ledger" ADD COLUMN "fx_rate" numeric(18, 10) DEFAULT 1 NOT NULL;--> statement-breakpoint
-- Immutability trigger blocks UPDATE; allow this one-time backfill only.
ALTER TABLE "asset_ledger" DISABLE TRIGGER "asset_ledger_block_update";--> statement-breakpoint
UPDATE "asset_ledger"
SET
	"original_currency" = COALESCE("currency", 'CHF'),
	"original_amount" = "amount",
	"fx_rate" = 1
WHERE "original_amount" IS NULL;--> statement-breakpoint
ALTER TABLE "asset_ledger" ENABLE TRIGGER "asset_ledger_block_update";--> statement-breakpoint
ALTER TABLE "asset_ledger" ALTER COLUMN "original_amount" SET NOT NULL;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.asset_ledger_default_multi_currency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF NEW."original_amount" IS NULL THEN
		NEW."original_amount" := NEW."amount";
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER asset_ledger_default_multi_currency
BEFORE INSERT ON public.asset_ledger
FOR EACH ROW
EXECUTE FUNCTION public.asset_ledger_default_multi_currency();
