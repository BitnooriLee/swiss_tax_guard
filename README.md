# SwissTax Guard (STG)

> **Turning tax debt into spending confidence** — real-time tax liability and Safe-to-Spend guidance for Swiss residents.

This repository extends the [Supaplate](https://supaplate.com/docs) stack (React Router 7, Supabase, Drizzle). Product scope and roadmap live in [`PROJECT_PLAN.md`](./PROJECT_PLAN.md); Swiss rules and engineering constraints live in [`AI.md`](./AI.md).

## What it does

- **Safe-to-Spend** isolates estimated tax from liquid assets so day-to-day spending reflects what is actually disposable (see formula in `AI.md`).
- **Precision**: monetary amounts are modeled in **Rappen** (`bigint`); UI formats CHF for display.
- **Dashboard** (`/tax`): Nordic-style layout with Safe-to-Spend hero/dial, tax breakdown, and asset mix (cash, crypto, stock) from the ledger.

## Currently implemented (vs. plan)

Aligned with **Phase 1 — High-precision foundation** and parts of **Phase 2 — Nordic UX** in `PROJECT_PLAN.md`:

| Area | Status |
|------|--------|
| Schema: `profiles`, `asset_ledger`, `swiss_tax_contexts` | In use (Drizzle + migrations under `sql/migrations/`) |
| Tax math server-side (`app/features/tax/services.server.ts`, `tax-dashboard.server.ts`) | Income (marginal slices), demo progressive cantonal wealth tax, ESTV-oriented seeds (`app/db/seeds/tax_rates.json`) |
| Currency / ledger | CHF Rappen; multi-currency ledger fields with FX toward CHF (see migrations) |
| Security | RLS reference patterns in `sql/snippets/`; treat production RLS as mandatory before shipping sensitive data |
| Dashboard UX | Server loaders + actions, Safe-to-Spend dial/hero, skeleton-friendly flows |
| Scenario simulator | Pillar **3a** contribution vs. marginal rate (estimated tax savings) |
| Relocation hint | Server-side Zug wealth tax comparison on same asset base (data for UI hints) |
| E2E | Playwright (`npm run test:e2e`), including tax-guard flows |

**Not claimed here** (still roadmap or partial): Supabase Vault-style field encryption, full Phase 3 automation (CSV / b.link mocks, PDF compliance reports), and full official assessment parity — the north-star is accuracy vs. assessments (`PROJECT_PLAN.md`).

## Stack

- **Framework**: React Router 7 (framework mode)
- **UI**: Tailwind CSS 4, Radix UI, Lucide
- **Data**: Supabase (Postgres, Auth), Drizzle ORM
- **Tax logic location**: `app/features/tax/services.server.ts` (per `AI.md`)

## Getting started

1. **Prerequisites**: Node.js compatible with the repo, Supabase project, Postgres URL for Drizzle migrations.

2. **Environment**: Configure Supabase and database URLs per Supaplate / Supabase docs (local `.env` is gitignored).

3. **Database**: Apply migrations (`sql/migrations/`), run type generation if you use Supabase CLI (`package.json` → `db:typegen` — replace placeholder project id).

4. **Seed tax data** (when needed):

   ```bash
   npm run db:seed-tax
   ```

5. **Dev server**:

   ```bash
   npm install
   npm run dev
   ```

6. **Quality gates**:

   ```bash
   npm run typecheck
   npm run test:e2e
   ```

**Tax dashboard route**: `/tax` (see `app/routes.ts`).

## Documentation

- **Product & roadmap**: [`PROJECT_PLAN.md`](./PROJECT_PLAN.md)
- **Swiss domain + engineering rules**: [`AI.md`](./AI.md)
- **Base template docs**: [supaplate.com/docs](https://supaplate.com/docs)

## License

See [LICENSE.md](./LICENSE.md).
