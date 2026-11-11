import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  computeBudgetSummaryFromRecords,
  getBudgetSummary,
  recordMerchantExpense,
  removeMerchantExpense,
  updateMonthlyBudgetTarget,
} from "../src/lib/budget/service";

test("Merchant Budget Intelligence: targets, currency isolation, expenses, and cash flow", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "paysight-budget-"));
  const prevDb = process.env.PAYSIGHT_DB_PATH;
  process.env.PAYSIGHT_DB_PATH = path.join(tmpDir, "db.json");

  t.after(() => {
    if (prevDb === undefined) delete process.env.PAYSIGHT_DB_PATH;
    else process.env.PAYSIGHT_DB_PATH = prevDb;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test("separates gross sales, PayPal fees, net proceeds, refunds, manual expenses, and cash flow", () => {
    const summary = computeBudgetSummaryFromRecords({
      month: "2026-10",
      currency: "USD",
      transactions: [
        { date: "2026-10-05T10:00:00Z", amount: 500, fee: 14.8, currency: "USD", status: "COMPLETED" },
        { date: "2026-10-10T10:00:00Z", amount: 300, fee: 9.0, currency: "USD", status: "COMPLETED" },
        { date: "2026-10-12T10:00:00Z", amount: 100, fee: 0, currency: "USD", status: "REFUNDED" },
        { date: "2026-10-14T10:00:00Z", amount: 900, fee: 20, currency: "EUR", status: "COMPLETED" },
        { date: "2026-09-20T10:00:00Z", amount: 400, fee: 12.0, currency: "USD", status: "COMPLETED" },
      ],
      expenses: [
        {
          id: "E1",
          date: "2026-10-02",
          category: "inventory",
          description: "Stock",
          amount: 250,
          currency: "USD",
          createdAt: "2026-10-02T00:00:00Z",
        },
        {
          id: "E2",
          date: "2026-10-03",
          category: "marketing",
          description: "Ads",
          amount: 100,
          currency: "USD",
          createdAt: "2026-10-03T00:00:00Z",
        },
        {
          id: "E3",
          date: "2026-10-03",
          category: "software",
          description: "EU SaaS",
          amount: 50,
          currency: "EUR",
          createdAt: "2026-10-03T00:00:00Z",
        },
      ],
      target: {
        month: "2026-10",
        currency: "USD",
        salesTarget: 1000,
        expenseBudget: 300,
        updatedAt: "2026-10-01T00:00:00Z",
      },
      dataSource: "paypal_sandbox",
      nowDate: new Date("2026-10-15T12:00:00Z"),
    });

    assert.equal(summary.actualGrossSales, 800); // EUR 900 excluded
    assert.equal(summary.paypalFees, 23.8);
    assert.equal(summary.netPayPalProceeds, 776.2);
    assert.equal(summary.refunds, 100);
    assert.equal(summary.manualExpensesTotal, 350); // EUR 50 excluded
    assert.equal(summary.estimatedOperatingCashFlow, 426.2); // 776.2 - 350
    assert.equal(summary.targetProgressPct, 80);
    assert.equal(summary.status, "OVER_BUDGET");
    assert.equal(summary.previousMonth.actualGrossSales, 400);
    assert.equal(summary.previousMonth.grossSalesChangePct, 100);
  });

  await t.test("records, validates, updates targets, and deletes operating expenses", async () => {
    assert.throws(
      () =>
        recordMerchantExpense({
          date: "2026-11-01",
          category: "inventory",
          description: "Zero",
          amount: -10,
        }),
      /greater than zero/
    );

    const month = new Date().toISOString().slice(0, 7);
    updateMonthlyBudgetTarget({
      month,
      currency: "USD",
      salesTarget: 2000,
      expenseBudget: 500,
    });

    const exp = recordMerchantExpense({
      date: `${month}-03`,
      category: "marketing",
      description: "Test Ad Spend",
      amount: 125.5,
      currency: "USD",
    });

    const res1 = await getBudgetSummary(month, "USD");
    assert.equal(res1.summary.salesTarget, 2000);
    assert.ok(res1.expenses.some((e) => e.id === exp.id));

    const deleted = removeMerchantExpense(exp.id);
    assert.equal(deleted, true);

    const res2 = await getBudgetSummary(month, "USD");
    assert.ok(!res2.expenses.some((e) => e.id === exp.id));
  });
});

