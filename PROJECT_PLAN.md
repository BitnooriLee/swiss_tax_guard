# Project Plan: SwissTax Guard (STG)
> **"Turning Tax Debt into Spending Confidence"**

## 1. Strategic Overview (The Vision)
* **Product Definition**: A real-time tax liability and "Safe-to-Spend" management platform for Swiss residents.
* **Problem**: "Money Illusion" and Year-end Liquidity Shocks caused by the absence of withholding tax.
* **Solution**: Real-time isolation of tax debt from liquid assets to define "Truly Spendable Income."
* **North Star Metric**: **Safe-to-Spend Accuracy** (Variance < 2% from official assessments).

## 2. Roadmap: The 3-Phase Execution

### **Phase 1: High-Precision Foundation (Week 1-2)**
*Goal: Ensure financial data integrity and build the Swiss-specific tax engine.*
* **[Task 1] Debt-Centric Schema (Drizzle/Postgres)**
    * `profiles`: Store variables like Canton (26 states), Marital Status, Religion, and Children.
    * `asset_ledger`: Snapshot-based tracking of Cash, Crypto, and Stocks for Wealth Tax.
    * **Strict Rule**: All currency handled as `BigInt (Rappen)`.
* **[Task 2] The "Swiss Engine" (Server-side)**
    * `services/tax.server.ts`: High-precision calculator for Federal/Cantonal/Municipal taxes.
    * `tax_config_seeds`: Hardcode 2025/2026 official tax rate data as JSON/Seeds.
* **[Task 3] Security & Privacy**
    * Apply Supabase RLS (Row Level Security) and encrypt sensitive assets via Vault.

### **Phase 2: Nordic UX & Smart Intelligence (Week 3-4)**
*Goal: High-readability UI and decision-support tools.*
* **[Task 4] Nordic Minimalist Dashboard**
    * **Safe-to-Spend Dial**: Focus on "What I can spend" rather than "What I earned."
    * Zero-Latency rendering via React Router 7 Server Loaders.
* **[Task 5] Scenario Simulator (The Optimizer)**
    * Real-time simulation of tax savings for Pillar 3a contributions.
    * Tax impact analysis for relocating between Cantons.

### **Phase 3: Automation & Ecosystem (Scaling)**
*Goal: Move from manual entry to automated asset compliance.*
* **[Task 6] Asset Integration**: CSV uploads and Mock API integration for Swiss b.link standards.
* **[Task 7] Compliance Reporting**: Automated PDF report generation for tax declaration reference.

## 3. Technical Justification (The Stack)
* **React Router 7**: Isolate complex logic in Server-side loaders to prevent client exposure.
* **Drizzle & Postgres**: Strict typing for financial data and precision-based integer math.
* **Supabase Vault**: Swiss-grade privacy and encryption for sensitive user assets.

## 4. Cursor AI Operating Protocol (Mandatory)
Cursor must pass through these **4 Gates** for every task:
1. **Context Check**: Reference `@AI.md` and `@Project_Plan.md` before starting.
2. **Architecture Interview**: Present **3 Design Options (MCQ)** and get approval.
3. **Logic First**: Submit **Pseudocode** and **Edge Case Analysis** (e.g., floating-point errors, missing data) before coding.
4. **Token Efficiency**: Use **Diff-based edits** only; avoid full file rewrites.