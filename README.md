# Swiss Tax Guard (STG)

![Swiss Tax Guard — command center dashboard]

> **Turning tax debt into spending confidence** — a real-time tax liability and liquidity dashboard for Swiss residents that separates estimated tax from spendable cash.

This repository extends the [Supaplate](https://supaplate.com/docs) stack (React Router 7, Supabase, Drizzle). Product vision and roadmap live in [`PROJECT_PLAN.md`](./PROJECT_PLAN.md). 


## UI examples

<figure>
  <img src="./images/dashboard_main_image.png" alt="Dashboard main view" width="960" />
  <figcaption>Main tax dashboard command center with Safe-to-Spend, trend, allocation, and action cards.</figcaption>
</figure>

<figure>
  <img src="./images/pillar%203a%20detail.png" alt="Pillar 3a optimizer detail" width="960" />
  <figcaption>Pillar 3a optimizer detail showing contribution simulation and estimated tax savings.</figcaption>
</figure>

<figure>
  <img src="./images/zug%20tax.png" alt="Zug tax comparison" width="960" />
  <figcaption>Canton-specific tax view example for Zug (ZG), including comparative insights.</figcaption>
</figure>

<figure>
  <img src="./images/zurich%20tax.png" alt="Zurich tax comparison" width="960" />
  <figcaption>Canton-specific tax view example for Zurich (ZH) for side-by-side scenario review.</figcaption>
</figure>


---

## Product thesis

| Pillar | What it means |
|--------|----------------|
| **Problem** | Without reliable withholding, people confuse **account balance** with **post-tax disposable liquidity**, which drives year-end cash shocks. |
| **Approach** | Combine ledger balances with **estimated** federal, cantonal, municipal (and optional church) tax to surface **Safe-to-Spend**. |
| **North star** | **Safe-to-Spend accuracy** vs. official assessments — target variance under **2%** (see `PROJECT_PLAN.md`). |


```text
Safe-to-Spend = Total Assets − (Estimated Tax Liability + Safety Buffer)
```

**Precision**: model CHF in **Rappen** (`bigint`, 1 CHF = 100). Format for display in the UI only. Do not use floating-point `number` types for tax or money aggregates.

---

## Architecture

Tax math and persistence run on the **server** (loaders and actions). The browser focuses on presentation and lightweight validation. The canonical tax engine entry point is `app/features/tax/services.server.ts`

### System diagram

```mermaid
flowchart TB
  subgraph Client["Browser (React 19 + RR7)"]
    UI["Tax dashboard UI\n`features/tax/components/*`"]
  end

  subgraph Edge["React Router 7 — Server"]
    R["Route module\n`features/tax/screens/tax-dashboard.tsx`"]
    TD["Orchestration\n`tax-dashboard.server.ts`"]
    SVC["Swiss tax engine\n`services.server.ts`"]
    Q["Data access\n`queries.server.ts`"]
    ADP["ESTV seed adapter\n`adapters/estv-json.adapter.ts`"]
    SEED["`db/seeds/tax_rates.json`"]
  end

  subgraph Data["Supabase Postgres"]
    AUTH["Auth (session / JWT)"]
    PROF["profiles"]
    CTX["swiss_tax_contexts (RLS)"]
    LED["asset_ledger (RLS)"]
  end

  UI -->|loader + action| R
  R --> TD
  TD --> SVC
  TD --> Q
  SVC --> ADP
  ADP --> SEED
  Q -->|Supabase client| PROF
  Q --> CTX
  Q --> LED
  AUTH --> Q
```

### Dashboard request flow

```mermaid
sequenceDiagram
  participant U as User
  participant RR as RR7 route (server)
  participant TD as tax-dashboard.server
  participant S as services.server
  participant DB as Supabase Postgres

  U->>RR: GET /dashboard/tax
  RR->>TD: load dashboard payload
  TD->>DB: read profile, tax context, ledger balances
  DB-->>TD: rows
  TD->>S: compute liability, wealth tax slices, 3a delta
  S-->>TD: bigint-safe numbers + breakdown
  TD-->>RR: serializable view model
  RR-->>U: HTML + hydrated UI
```

---

## Stack

| Layer | Choice |
|-------|--------|
| Framework | React Router 7 (framework mode), React 19 |
| UI | Tailwind CSS 4, Radix UI, Lucide |
| Data | Supabase (Postgres, Auth), Drizzle ORM, `sql/migrations/` |
| Quality | TypeScript, Playwright (`npm run test:e2e`) |
| Observability / misc | Sentry (when configured), `@react-pdf/renderer` (report paths exist in-repo) |

---

## Repository map (tax feature)

```text
app/features/tax/
  services.server.ts        # Liability, marginal slices, Safe-to-Spend core
  tax-dashboard.server.ts   # Loader orchestration, context sync
  queries.server.ts         # Supabase reads/writes
  schema.ts                 # swiss_tax_contexts (includes RLS policies)
  components/               # Dial, hero, Pillar 3a optimizer, etc.
  adapters/                 # ESTV-oriented seed JSON adapter
app/db/seeds/tax_rates.json
sql/migrations/             # Schema source of truth
sql/snippets/               # RLS reference snippets
```

---

## Implemented vs. planned

Aligned with **Phase 1 — High-precision foundation** and parts of **Phase 2 — Nordic UX and simulators** in `PROJECT_PLAN.md`:

| Area | Status |
|------|--------|
| Schema: `profiles`, `asset_ledger`, `swiss_tax_contexts` | In use with Drizzle and `sql/migrations/` |
| Tax engine (server) | Income (marginal slices), demo-style cantonal wealth tax, ESTV-oriented seeds |
| Dashboard UX | Safe-to-Spend hero and dial, tax breakdown, asset mix, skeleton-friendly flows (see **Tax dashboard UI** below) |
| Scenarios | Pillar **3a** contribution vs. marginal-rate savings estimate |
| Insights | Relocation-style hints (for example Zug wealth tax on the same asset base) |
| E2E | Playwright, including tax-guard flows |

**Still roadmap or partial**: Supabase Vault-style field encryption, full Phase 3 automation (CSV / b.link mocks), complete official assessment parity, and end-to-end compliance PDF reporting.

### Tax dashboard UI

The tax command center (`app/features/tax/screens/tax-dashboard.tsx` and `app/features/tax/components/*`) uses a small set of reusable card primitives (`app/features/tax/components/dashboard-card.tsx`) so surface, padding, and header rhythm stay consistent.

**Layout**

- **Hero row**: Safe-to-Spend hero (wide) and Quick Actions (narrow), with extra vertical space before the tax stack so Quick Actions does not crowd the cards below.
- **Middle band (large screens)**: Two columns share one row height. **Left**: Net Worth Trend (shorter chart, `3 / 1` aspect ratio) with the **7d / 30d / 90d** range control inside the card header, then **Asset Allocation** with a small fixed gap from the chart (no overlap). **Right**: Tax Category Insights and **Estimated income tax** with wider spacing between them; bottoms align with **Asset Allocation** and the tax summary card.
- **Below**: Pillar 3a collapsible and Safe-to-Spend dial on the same row pattern as before.

**Why not a single `gap-y` on the whole grid?** A uniform row gap also squeezes the right-hand stack (Quick Actions, insights, summary). The middle band is therefore a dedicated two-column block with its own vertical rhythm.

---

## Getting started

1. **Prerequisites**: Node.js compatible with the repo, a Supabase project, and a Postgres URL for Drizzle migrations.
2. **Environment**: Configure Supabase and database URLs per Supaplate / Supabase docs (local `.env` is gitignored).
3. **Database**: Apply `sql/migrations/`, then run `npm run db:typegen` if you use the Supabase CLI (replace the placeholder project id in `package.json`).
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

**Tax dashboard route**: `/dashboard/tax` — see [`app/routes.ts`](./app/routes.ts) and `features/tax/screens/tax-dashboard.tsx`.

---

## Security and privacy notes

- Production deployments should treat **RLS on all user-owned tables** as mandatory (`sql/snippets/`, Drizzle `pgPolicy` patterns).
- Prefer **zero-PII logging** for operational logs.

---

## Documentation

- **Product and roadmap**: [`PROJECT_PLAN.md`](./PROJECT_PLAN.md)

## License

See [`LICENSE.md`](./LICENSE.md).
