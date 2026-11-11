import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildDateChunks,
  computeMerchantKPIs,
  getMerchantKPIs,
  getRevenueTimeSeries,
  listDisputes,
} from "../src/lib/paypal/api";
import { saveTransaction } from "../src/lib/db";
import type { Transaction } from "../src/types";

test("Analytics: authoritative server-side calculation, chunking, and currency separation", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "paysight-analytics-"));
  const prevDb = process.env.PAYSIGHT_DB_PATH;
  process.env.PAYSIGHT_DB_PATH = path.join(tmpDir, "db.json");

  t.after(() => {
    if (prevDb === undefined) delete process.env.PAYSIGHT_DB_PATH;
    else process.env.PAYSIGHT_DB_PATH = prevDb;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test("splits 60-day and 90-day windows into <= 30 day PayPal chunks", () => {
    const end = new Date("2026-10-20T00:00:00Z");
    const start90 = new Date(end.getTime() - 90 * 86400000);
    const chunks90 = buildDateChunks(start90, end, 30);
    assert.equal(chunks90.length, 3, "90 days must split into 3 chunks of <=30 days");
    for (const c of chunks90) {
      const spanDays = (c.endDate.getTime() - c.startDate.getTime()) / 86400000;
      assert.ok(spanDays <= 31 && spanDays > 0);
    }

    const start60 = new Date(end.getTime() - 60 * 86400000);
    const chunks60 = buildDateChunks(start60, end, 30);
    assert.equal(chunks60.length, 2, "60 days must split into 2 chunks");
  });

  await t.test("separates currencies strictly without mixing EUR into USD KPIs", async () => {
    const nowIso = new Date().toISOString();
    const txUSD: Transaction = {
      id: "TEST-TX-USD-1",
      date: nowIso,
      amount: 100.0,
      fee: 3.2,
      net: 96.8,
      currency: "USD",
      status: "COMPLETED",
      customerName: "US Customer",
      customerEmail: "us@example.com",
      productName: "Test Item USD",
      paymentMethod: "paypal",
      source: "paypal_sandbox",
    };

    const txEUR: Transaction = {
      id: "TEST-TX-EUR-1",
      date: nowIso,
      amount: 500.0,
      fee: 15.0,
      net: 485.0,
      currency: "EUR",
      status: "COMPLETED",
      customerName: "EU Customer",
      customerEmail: "eu@example.com",
      productName: "Test Item EUR",
      paymentMethod: "paypal",
      source: "paypal_sandbox",
    };

    saveTransaction(txUSD);
    saveTransaction(txEUR);

    const kpisBeforeEurCheck = computeMerchantKPIs({
      transactions: [txUSD, txEUR],
      days: 30,
      currency: "USD",
      source: "paypal_sandbox",
    });
    const kpisEur = computeMerchantKPIs({
      transactions: [txUSD, txEUR],
      days: 30,
      currency: "EUR",
      source: "paypal_sandbox",
    });

    assert.equal(kpisBeforeEurCheck.currency, "USD");
    assert.equal(kpisEur.currency, "EUR");
    assert.equal(kpisEur.grossVolume30d, 500.0, "EUR KPI must contain only EUR");
    assert.equal(kpisEur.totalFees30d, 15.0);
    assert.equal(kpisEur.netVolume30d, 485.0);

    // Ensure 500 EUR did not leak into USD totals
    assert.ok(
      kpisBeforeEurCheck.currencyTotals["USD"].gross === kpisBeforeEurCheck.grossVolume30d,
      "USD headline grossVolume30d must match USD breakdown exactly"
    );
    assert.equal(kpisBeforeEurCheck.currencyTotals["EUR"].gross, 500.0);

    // Without live PayPal credentials, getMerchantKPIs must not leak local/mock rows
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
    const unconfiguredKpis = await getMerchantKPIs(30, "USD");
    assert.equal(unconfiguredKpis.source, "unconfigured");
    assert.equal(unconfiguredKpis.grossVolume30d, 0);
  });

  await t.test("refund and fee accounting is distinct and computes period-over-period delta", async () => {
    const now = Date.now();
    const currentTx: Transaction = {
      id: "CURR-SALE-1",
      date: new Date(now - 2 * 86400000).toISOString(),
      amount: 200.0,
      fee: 6.1,
      net: 193.9,
      currency: "USD",
      status: "COMPLETED",
      customerName: "Current Buyer",
      customerEmail: "curr@example.com",
      productName: "Plan",
      paymentMethod: "paypal",
      source: "paypal_sandbox",
    };
    const prevTx: Transaction = {
      id: "PREV-SALE-1",
      date: new Date(now - 40 * 86400000).toISOString(),
      amount: 100.0,
      fee: 3.2,
      net: 96.8,
      currency: "USD",
      status: "COMPLETED",
      customerName: "Prior Buyer",
      customerEmail: "prev@example.com",
      productName: "Plan",
      paymentMethod: "paypal",
      source: "paypal_sandbox",
    };
    const refundTx: Transaction = {
      id: "TEST-REF-1",
      date: new Date(now - 1 * 86400000).toISOString(),
      amount: 50.0,
      fee: 0,
      net: -50.0,
      currency: "USD",
      status: "REFUNDED",
      customerName: "Refund Customer",
      customerEmail: "refund@example.com",
      productName: "Returned Item",
      paymentMethod: "paypal",
      source: "paypal_sandbox",
    };

    const kpis = computeMerchantKPIs({
      transactions: [currentTx, prevTx, refundTx],
      days: 30,
      currency: "USD",
      source: "paypal_sandbox",
      disputeCount: 1,
      nowMs: now,
    });

    assert.equal(kpis.grossVolume30d, 200.0);
    assert.equal(kpis.totalFees30d, 6.1);
    assert.equal(kpis.netVolume30d, 193.9);
    assert.equal(kpis.refundCount30d, 1);
    assert.equal(kpis.refundAmount30d, 50.0);
    assert.equal(kpis.hasPreviousPeriodData, true);
    assert.equal(kpis.totalRevenue30dChange, 100.0); // 200 vs 100 = +100%
    assert.equal(kpis.disputeRate, 100.0); // 1 dispute / 1 completed order
  });

  await t.test("AOV has safe zero-denominator guard and series isolates currency", async () => {
    const emptyKpis = computeMerchantKPIs({
      transactions: [],
      days: 30,
      currency: "USD",
      source: "paypal_sandbox",
    });
    assert.equal(emptyKpis.averageOrderValue, 0);
    assert.equal(emptyKpis.disputeRate, 0);

    const seriesUsd = await getRevenueTimeSeries(7, "USD");
    assert.equal(seriesUsd.length, 7);
    assert.ok(seriesUsd.every((pt) => pt.currency === "USD"));
  });

  await t.test("missing live credentials do not fabricate dispute data", async () => {
    const disputeResult = await listDisputes();
    assert.equal(typeof disputeResult.isLive, "boolean");
    assert.ok(disputeResult.statusMessage.length > 0);
    if (!disputeResult.isLive) {
      assert.equal(disputeResult.disputes.length, 0);
    }
  });
});
