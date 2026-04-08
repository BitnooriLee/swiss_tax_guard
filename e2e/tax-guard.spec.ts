/**
 * Tax Guard "golden chain" E2E — regression surface for ledger aggregation:
 * - `app/features/tax/queries.server.ts` (`getCurrentBalances`)
 * - `app/features/assets/queries.server.ts` (`getAssetHistory` baseline + window sums)
 *
 * Data: dedicated `testEmail` per run (or `TAX_GUARD_TEST_USER_EMAIL`); ledger rows are wiped
 * before the suite and after (or user deleted when disposable).
 *
 * Perf: set `TAX_GUARD_ACTION_UI_BUDGET_MS` (e.g. 12000) to fail if click→total-assets poll exceeds budget.
 */
import { type Page, expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import {
  deleteAssetLedgerRowsForEmail,
  ensureProfileRowForEmail,
  ensureProfileRowForUserId,
  getLatestAssetLedgerRowForEmail,
} from "e2e/utils/tax-guard-cleanup";
import { deleteUser } from "e2e/utils/test-helpers";
import { parseFormattedChfToRappen, parsePercentValue } from "e2e/utils/chf";

/** React Router single-fetch payload for `routes/api.fx-rate` loader (see `text/x-script` responses). */
const TURBO_FX_USD_09_MOCK = `[{"_1":2},"routes/api.fx-rate",{"_3":4},"data",{"_5":6,"_7":8},"rate","0.9000000000","from","USD"]`;

const ACTION_UI_BUDGET_MS_RAW = process.env.TAX_GUARD_ACTION_UI_BUDGET_MS?.trim();
const ACTION_UI_BUDGET_MS =
  ACTION_UI_BUDGET_MS_RAW !== undefined && ACTION_UI_BUDGET_MS_RAW !== ""
    ? Number(ACTION_UI_BUDGET_MS_RAW)
    : null;

const TEST_PASSWORD = process.env.TAX_GUARD_TEST_USER_PASSWORD ?? "password";
const PROVIDED_TEST_EMAIL = process.env.TAX_GUARD_TEST_USER_EMAIL?.trim() ?? "";

let testEmail = "";
let testUserId: string | undefined;
let shouldCleanupUser = false;

async function provisionConfirmedUser(
  email: string,
  password: string,
): Promise<string | undefined> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for E2E user provisioning.",
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error && !/already/i.test(error.message)) {
    throw new Error(`Failed to provision E2E user: ${error.message}`);
  }
  return data?.user?.id;
}

async function assertSupabaseReachable() {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is required for tax dashboard E2E tests.");
  }

  try {
    await fetch(`${supabaseUrl}/auth/v1/health`, {
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    throw new Error(
      `Cannot reach Supabase from test runner. Check DNS/network/Supabase URL. ${(error as Error).message}`,
    );
  }
}

async function loginAndOpenTaxDashboard(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(testEmail);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/($|dashboard)/);
  await page.goto("/dashboard/tax");
  await expect(page).toHaveURL("/dashboard/tax");
  await expect(page.getByRole("heading", { name: "SwissTax Guard" })).toBeVisible();
}

async function captureTaxDashboardState(page: Page) {
  const totalAssetsText = await page.getByTestId("total-assets-value").innerText();
  const ratioText = await page.getByTestId("tax-liquidity-ratio").innerText();
  const stockImpactText = await page.getByTestId("tax-insight-weight-stock").innerText();
  const lastHistoryPointAria = await page
    .getByTestId("asset-history-point")
    .last()
    .getAttribute("aria-label");

  if (!lastHistoryPointAria) {
    throw new Error("Asset history point aria-label is missing");
  }

  return {
    totalAssetsRappen: parseFormattedChfToRappen(totalAssetsText),
    taxLiquidityRatio: parsePercentValue(ratioText),
    stockImpactPercent: parsePercentValue(stockImpactText),
    lastHistoryRappen: parseFormattedChfToRappen(lastHistoryPointAria),
  };
}

async function submitAssetTransaction({
  page,
  assetType,
  actionType,
  amount,
  description,
  expectedTotalAssetsRappen,
  currency = "CHF",
}: {
  page: Page;
  assetType: "cash" | "crypto" | "stock";
  actionType: "INFLOW" | "OUTFLOW" | "ADJUSTMENT";
  amount: string;
  description: string;
  expectedTotalAssetsRappen: bigint;
  currency?: "CHF" | "EUR" | "USD" | "GBP";
}) {
  await page.getByTestId("asset-action-trigger").click();
  await expect(page.getByTestId("asset-action-form")).toBeVisible();

  await page.getByTestId("asset-type-select").selectOption(assetType);
  await page.getByTestId("action-type-select").selectOption(actionType);
  if (currency !== "CHF") {
    const fxResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        /\/api\/fx-rate(\.data)?/.test(response.url()) &&
        response.ok(),
    );
    await page.getByTestId("currency-select").selectOption(currency);
    await fxResponsePromise;
  } else {
    await page.getByTestId("currency-select").selectOption(currency);
  }
  await page.getByTestId("amount-input").fill(amount);
  await page.getByTestId("description-input").fill(description);

  const postResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/dashboard/tax") &&
      response.url().includes(".data"),
  );

  const actionStartMs = Date.now();
  await page.getByTestId("asset-action-submit").click();
  const postResponse = await postResponsePromise;
  const postDecodeMs = Date.now() - actionStartMs;
  if (!postResponse.ok()) {
    const body = await postResponse.text();
    throw new Error(
      `Asset POST failed ${postResponse.status()} ${postResponse.url()}: ${body.slice(0, 800)}`,
    );
  }

  await expect
    .poll(
      async () =>
        parseFormattedChfToRappen(
          await page.getByTestId("total-assets-value").innerText(),
        ),
      { timeout: 25000 },
    )
    .toBe(expectedTotalAssetsRappen);

  const actionToUiMs = Date.now() - actionStartMs;
  test.info().annotations.push(
    {
      type: "performance",
      description: `useFetcher POST+.data round-trip: ${postDecodeMs}ms`,
    },
    {
      type: "performance",
      description: `click → total-assets UI match (action+revalidate+render): ${actionToUiMs}ms`,
    },
  );
  if (
    ACTION_UI_BUDGET_MS !== null &&
    Number.isFinite(ACTION_UI_BUDGET_MS) &&
    ACTION_UI_BUDGET_MS > 0
  ) {
    expect(
      actionToUiMs,
      `Exceeded TAX_GUARD_ACTION_UI_BUDGET_MS=${ACTION_UI_BUDGET_MS}`,
    ).toBeLessThanOrEqual(ACTION_UI_BUDGET_MS);
  }

  if (await page.getByTestId("asset-action-form").isVisible()) {
    await page.keyboard.press("Escape");
  }
  await expect(page.getByTestId("asset-action-form")).not.toBeVisible({
    timeout: 5000,
  });
}

test.describe.serial("Tax Guard dashboard E2E", () => {
  test.beforeAll(async ({ browserName }) => {
    await assertSupabaseReachable();

    if (PROVIDED_TEST_EMAIL.length > 0) {
      testEmail = PROVIDED_TEST_EMAIL;
      shouldCleanupUser = false;
      testUserId = undefined;
    } else {
      testEmail = `tax-guard-${browserName}-${Date.now()}@example.com`;
      shouldCleanupUser = true;
      testUserId = await provisionConfirmedUser(testEmail, TEST_PASSWORD);
    }

    await deleteAssetLedgerRowsForEmail(testEmail);

    // Admin-provisioned users bypass the sign-up trigger → profile row may not exist.
    // Upsert it so canton update action can succeed (RLS UPDATE requires existing row).
    if (testUserId) {
      await ensureProfileRowForUserId(testUserId);
    } else {
      await ensureProfileRowForEmail(testEmail);
    }
  });

  test.afterAll(async () => {
    if (shouldCleanupUser) {
      await deleteUser(testEmail);
    } else if (testEmail.length > 0) {
      await deleteAssetLedgerRowsForEmail(testEmail);
    }
  });

  test("zero state renders gracefully on empty ledger", async ({ page }) => {
    await loginAndOpenTaxDashboard(page);

    await expect(page.getByTestId("asset-history-chart")).toBeVisible();
    await expect(page.getByTestId("asset-history-point").last()).toHaveAttribute(
      "aria-label",
      /CHF 0\.00$/,
    );
    await expect(page.getByTestId("tax-insight-weight-stock")).toHaveText("0.00%");
    await expect(page.getByTestId("total-assets-value")).toHaveText("0.00");

    const zero = await captureTaxDashboardState(page);
    expect(zero.lastHistoryRappen).toBe(zero.totalAssetsRappen);
  });

  test("tax statement PDF export returns attachment with PDF magic bytes", async ({ page }) => {
    await loginAndOpenTaxDashboard(page);

    const res = await page.request.get("/api/export-pdf");
    if (!res.ok()) {
      const errSnippet = await res.text().catch(() => "(binary or empty)");
      throw new Error(`PDF export HTTP ${res.status()}: ${errSnippet.slice(0, 300)}`);
    }

    const contentType = res.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/pdf");

    const disposition = (res.headers()["content-disposition"] ?? "").toLowerCase();
    expect(disposition).toContain("attachment");

    const body = await res.body();
    expect(body.byteLength).toBeGreaterThan(200);
    expect(String.fromCharCode(body[0], body[1], body[2], body[3], body[4])).toBe("%PDF-");
  });

  test("golden asset chain: stock inflow ripples through dashboard and survives refresh", async ({
    page,
  }) => {
    await test.step("Login and capture baseline (aggregation-sensitive)", async () => {
      await loginAndOpenTaxDashboard(page);
    });

    const before = await captureTaxDashboardState(page);

    await test.step("Submit inflow; fail if tax/assets queries.server aggregation breaks", async () => {
      await submitAssetTransaction({
        page,
        assetType: "stock",
        actionType: "INFLOW",
        amount: "100'000.00",
        description: "e2e-golden-stock-inflow",
        expectedTotalAssetsRappen: before.totalAssetsRappen + 10_000_000n,
      });
    });

    await expect
      .poll(async () => captureTaxDashboardState(page), { timeout: 15000 })
      .toMatchObject({
        totalAssetsRappen: 10_000_000n,
        stockImpactPercent: expect.any(Number),
      });

    const after = await captureTaxDashboardState(page);
    expect(after.totalAssetsRappen).toBe(before.totalAssetsRappen + 10_000_000n);
    expect(after.taxLiquidityRatio).toBeLessThan(before.taxLiquidityRatio);
    expect(after.stockImpactPercent).toBeGreaterThan(before.stockImpactPercent);
    expect(after.lastHistoryRappen).toBeGreaterThan(before.lastHistoryRappen);
    // getAssetHistory last point vs getCurrentBalances sum (queries.server.ts regression guard)
    expect(after.lastHistoryRappen).toBe(after.totalAssetsRappen);

    await page.reload();
    const afterReload = await captureTaxDashboardState(page);
    expect(afterReload.totalAssetsRappen).toBe(after.totalAssetsRappen);
    expect(afterReload.stockImpactPercent).toBeCloseTo(after.stockImpactPercent, 2);
    expect(afterReload.lastHistoryRappen).toBe(after.lastHistoryRappen);
    expect(afterReload.lastHistoryRappen).toBe(afterReload.totalAssetsRappen);
  });

  test("negative amount with outflow is normalized and decreases total assets", async ({
    page,
  }) => {
    await loginAndOpenTaxDashboard(page);

    const before = await captureTaxDashboardState(page);

    await submitAssetTransaction({
      page,
      assetType: "stock",
      actionType: "OUTFLOW",
      amount: "-1'000.00",
      description: "e2e-negative-outflow",
      expectedTotalAssetsRappen: before.totalAssetsRappen - 100_000n,
    });

    await expect
      .poll(async () => (await captureTaxDashboardState(page)).totalAssetsRappen, {
        timeout: 15000,
      })
      .toBe(before.totalAssetsRappen - 100_000n);

    const final = await captureTaxDashboardState(page);
    expect(final.lastHistoryRappen).toBe(final.totalAssetsRappen);
  });

  test("USD stock inflow uses FX preview and persists original currency", async ({
    page,
  }) => {
    await page.route("**/api/fx-rate**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("from") === "USD") {
        await route.fulfill({
          status: 200,
          headers: {
            "Content-Type": "text/x-script",
            "X-Remix-Response": "yes",
          },
          body: TURBO_FX_USD_09_MOCK,
        });
        return;
      }
      await route.continue();
    });

    await loginAndOpenTaxDashboard(page);
    const before = await captureTaxDashboardState(page);

    await submitAssetTransaction({
      page,
      assetType: "stock",
      actionType: "INFLOW",
      currency: "USD",
      amount: "10'000.00",
      description: "e2e-usd-stock-fx",
      expectedTotalAssetsRappen: before.totalAssetsRappen + 900_000n,
    });

    await expect(page.getByTestId("foreign-assets-hint")).toBeVisible();

    const row = await getLatestAssetLedgerRowForEmail(testEmail);
    expect(row?.original_currency?.toUpperCase()).toBe("USD");
    expect(row?.amount.toString()).toBe("900000");

    await page.unroute("**/api/fx-rate**");
  });

  // ── Canton Tax Ripple ────────────────────────────────────────────────────────

  test("canton tax ripple: residence swap recalculates Safe-to-Spend and Zug hint", async ({
    page,
  }) => {
    await loginAndOpenTaxDashboard(page);

    // Step 0: Ensure we start from ZH
    await selectResidenceCanton(page, "ZH");

    // Step 1: Add 1 M CHF cash so canton wealth-tax differences are noticeable
    const beforeDeposit = await captureTaxDashboardState(page);
    await submitAssetTransaction({
      page,
      assetType: "cash",
      actionType: "INFLOW",
      amount: "1'000'000.00",
      description: "e2e-canton-ripple-1m-cash",
      expectedTotalAssetsRappen: beforeDeposit.totalAssetsRappen + ONE_MILLION_CHF_RAPPEN,
    });

    // Step 2: Baseline in ZH
    const zhSafeToSpend = await parseSafeToSpendRappen(page);
    await expect(page.getByTestId("tax-optimization-hint")).toBeVisible();

    // Step 3: Swap → ZG (lower wealth-tax canton)
    await test.step("select ZG: safe-to-spend increases, Zug hint disappears", async () => {
      await selectResidenceCanton(page, "ZG");

      const zgSafeToSpend = await parseSafeToSpendRappen(page);
      expect(zgSafeToSpend, "ZG safe-to-spend > ZH (lower wealth tax)").toBeGreaterThan(
        zhSafeToSpend,
      );
      await expect(page.getByTestId("tax-optimization-hint")).not.toBeVisible();
    });

    // Step 4: Refresh — ZG persists
    await test.step("refresh: ZG persists in selector and tax summary", async () => {
      await page.reload();
      await expect(page.getByTestId("tax-summary-canton")).toContainText("· ZG", {
        timeout: 15_000,
      });
      const zgAfterReload = await parseSafeToSpendRappen(page);
      expect(zgAfterReload).toBeGreaterThan(zhSafeToSpend);
    });

    // Step 5: Swap → GE (different canton than ZG)
    await test.step("select GE: safe-to-spend changes, Zug hint reappears", async () => {
      const zgSafeToSpendBeforeGe = await parseSafeToSpendRappen(page);
      await selectResidenceCanton(page, "GE");

      const geSafeToSpend = await parseSafeToSpendRappen(page);
      // GE wealth tax (demo) is higher than ZG, but combined income+wealth may differ.
      // Key invariant: the value CHANGED (recalculation happened) and is NOT equal to ZH
      // (since GE wealth tax < ZH wealth tax in the demo brackets).
      expect(geSafeToSpend, "GE safe-to-spend must differ from ZG after canton switch").not.toBe(
        zgSafeToSpendBeforeGe,
      );
      expect(geSafeToSpend, "GE safe-to-spend must be higher than ZH baseline").toBeGreaterThan(
        zhSafeToSpend,
      );
      // Not in ZG → Zug optimisation hint must reappear.
      await expect(page.getByTestId("tax-optimization-hint")).toBeVisible();
    });
  });
});

test("tax statement PDF export returns 401 without session", async ({ browser }) => {
  const port = String(process.env.PORT ?? "4000");
  const baseURL = `http://127.0.0.1:${port}`;
  const context = await browser.newContext({ baseURL });
  const res = await context.request.get("/api/export-pdf");
  expect(res.status()).toBe(401);
  await context.close();
});

// ─── Canton Tax Ripple helpers (used in describe above) ──────────────────────

const ONE_MILLION_CHF_RAPPEN = 100_000_000n;

async function parseSafeToSpendRappen(page: Page): Promise<bigint> {
  const raw = await page.getByTestId("safe-to-spend-value").innerText();
  return parseFormattedChfToRappen(raw);
}

/**
 * Selects a new residence canton via the UI selector and waits for the server
 * round-trip to complete. Fails fast on HTTP errors instead of timing out.
 *
 * Key fix vs. prior version: the response listener is registered BEFORE
 * `selectOption` is called, eliminating the race condition where the network
 * response could arrive before the test registered its listener.
 */
async function selectResidenceCanton(page: Page, canton: string): Promise<void> {
  const select = page.getByTestId("residence-canton-select");
  const summaryEl = page.getByTestId("tax-summary-canton");

  // Early exit — already on target canton.
  const current = await summaryEl.innerText().catch(() => "");
  if (current.includes(`· ${canton}`)) return;

  // Register BEFORE triggering: prevents the race where the server responds
  // faster than Playwright can register waitForResponse.
  const responsePromise = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      r.url().includes("/dashboard/tax") &&
      r.url().includes(".data"),
    { timeout: 20_000 },
  );

  await select.selectOption({ value: canton });

  const res = await responsePromise;
  if (!res.ok()) {
    const body = await res.text().catch(() => "(unreadable)");
    throw new Error(
      `Canton update returned HTTP ${res.status()} — server error: ${body.slice(0, 400)}`,
    );
  }

  // Successful action triggers loader revalidation; wait for UI to reflect the new canton.
  await expect(summaryEl).toContainText(`· ${canton}`, { timeout: 20_000 });
}

