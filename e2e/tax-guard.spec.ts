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
let shouldCleanupUser = false;

async function provisionConfirmedUser(email: string, password: string) {
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
  const { error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error && !/already/i.test(error.message)) {
    throw new Error(`Failed to provision E2E user: ${error.message}`);
  }
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
    } else {
      testEmail = `tax-guard-${browserName}-${Date.now()}@example.com`;
      shouldCleanupUser = true;
      await provisionConfirmedUser(testEmail, TEST_PASSWORD);
    }

    await deleteAssetLedgerRowsForEmail(testEmail);
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
});
