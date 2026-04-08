-- Allow CASCADE deletes (e.g. auth.users cleanup) while keeping UPDATE blocked.
DROP TRIGGER IF EXISTS asset_ledger_block_delete ON public.asset_ledger;
