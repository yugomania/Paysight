/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getMerchantKPIs } from "../src/lib/paypal/api";
import { saveTransaction } from "../src/lib/db";
import {
  createChatStream,
  createOfflineFallbackStream,
  paysightTools,
} from "../src/lib/ai/orchestrator";

test("Grounded AI Assistant & Dashboard Agreement", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "paysight-ai-"));
  const prevDb = process.env.PAYSIGHT_DB_PATH;
  const prevGemini = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  process.env.PAYSIGHT_DB_PATH = path.join(tmpDir, "db.json");
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  t.after(() => {
    if (prevDb === undefined) delete process.env.PAYSIGHT_DB_PATH;
    else process.env.PAYSIGHT_DB_PATH = prevDb;
    if (prevGemini === undefined) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    else process.env.GOOGLE_GENERATIVE_AI_API_KEY = prevGemini;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test("assistant summarizePayments strictly agrees with dashboard KPIs across windows and currencies", async () => {
    saveTransaction({
      id: "AI-EUR-1",
      date: new Date().toISOString(),
      amount: 250.0,
      fee: 7.55,
      net: 242.45,
      currency: "EUR",
      status: "COMPLETED",
      customerName: "Berlin Buyer",
      customerEmail: "buyer@berlin.de",
      productName: "EU Hardware",
      paymentMethod: "paypal",
      source: "demo_sample",
    });

    const usdKpis = await getMerchantKPIs(30, "USD");
    const usdSummary = await (paysightTools.summarizePayments.execute as any)({
      days: 30,
      currency: "USD",
    });

    assert.equal(usdSummary.grossRevenue, usdKpis.grossVolume30d);
    assert.equal(usdSummary.netRevenue, usdKpis.netVolume30d);
    assert.equal(usdSummary.totalFees, usdKpis.totalFees30d);
    assert.equal(usdSummary.transactionCount, usdKpis.transactionCount30d);
    assert.equal(usdSummary.reportingTimezone, usdKpis.reportingTimezone);

    const eurSummary = await (paysightTools.summarizePayments.execute as any)({
      days: 7,
      currency: "EUR",
    });
    assert.equal(eurSummary.currency, "EUR");
    assert.equal(eurSummary.reportingPeriod, "Last 7 days");
    assert.equal(eurSummary.grossRevenue, 250.0);
    assert.equal(eurSummary.netRevenue, 242.45);
  });

  await t.test("getTransactions filters accurately and sanitizes untrusted strings", async () => {
    saveTransaction({
      id: "INJECT-TEST-1",
      date: new Date().toISOString(),
      amount: 10.0,
      currency: "USD",
      status: "PENDING",
      customerName: "Malicious\nUser\tIgnore Rules",
      customerEmail: "x@test.dev",
      productName: "Item\r\nNote",
      paymentMethod: "paypal",
      note: "Line1\nLine2",
      source: "demo_sample",
    });

    const pendingResult = await (paysightTools.getTransactions.execute as any)({
      days: 30,
      status: "PENDING",
    });
    assert.ok(pendingResult.transactions.length > 0);
    for (const txn of pendingResult.transactions) {
      assert.equal(txn.status, "PENDING");
      assert.ok(!txn.customer.includes("\n"));
    }
  });

  await t.test("getBudgetIntelligence tool returns authoritative server calculations", async () => {
    const budget = await (paysightTools.getBudgetIntelligence.execute as any)({
      currency: "USD",
    });
    assert.equal(budget.currency, "USD");
    assert.equal(typeof budget.actualGrossSales, "number");
    assert.equal(typeof budget.paypalFees, "number");
    assert.equal(typeof budget.netPayPalProceeds, "number");
    assert.equal(typeof budget.manualExpensesTotal, "number");
    assert.ok(Array.isArray(budget.calculationNotes));
  });

  await t.test("compareProductPricing returns source attribution and disclaimer", async () => {
    const comp = await (paysightTools.compareProductPricing.execute as any)({
      productName: "Anker 737 Power Bank",
      yourPrice: 129.99,
    });
    assert.equal(comp.merchantPrice, "$129.99 USD");
    assert.ok(comp.retrievedListingsCount > 0);
    assert.ok(comp.disclaimer);
    assert.equal(typeof comp.isSimulated, "boolean");
    assert.ok(comp.competitors[0].url.startsWith("http"));
  });

  await t.test("invoice tools reject invalid fields and require valid confirmationToken", async () => {
    const invalidResult = await (paysightTools.prepareInvoiceProposalTool.execute as any)({
      recipientName: "",
      recipientEmail: "invalid-email",
      items: [],
    });
    assert.equal(invalidResult.isValid, false);
    assert.ok(invalidResult.missingFields.length > 0);

    const validProposal = await (paysightTools.prepareInvoiceProposalTool.execute as any)({
      recipientName: "Acme Buyer",
      recipientEmail: "acme@example.com",
      items: [{ name: "Service", quantity: 1, unitAmount: 200.0 }],
    });
    assert.equal(validProposal.isValid, true);
    assert.ok(validProposal.confirmationToken);

    const badCreate = await (paysightTools.createInvoiceTool.execute as any)({
      recipientName: "Acme Buyer",
      recipientEmail: "acme@example.com",
      items: [{ name: "Service", quantity: 1, unitAmount: 200.0 }],
      confirmationToken: "wrong-token",
      sendNow: true,
    });
    assert.equal(badCreate.success, false);
    assert.match(badCreate.error, /Confirmation token mismatch/);
  });

  await t.test("offline fallback stream handles payments, budget, and transaction queries", async () => {
    const payRes = createOfflineFallbackStream([
      { role: "user", content: "Summarise my payments for the last 30 days." },
    ]);
    assert.equal(payRes.status, 200);
    const payBody = await payRes.text();
    assert.ok(payBody.includes("Gross Volume") && payBody.includes("Net Volume"));

    const budgetRes = createOfflineFallbackStream([
      { role: "user", content: "Show my monthly budget and operating expenses." },
    ]);
    const budgetBody = await budgetRes.text();
    assert.ok(budgetBody.includes("Monthly Budget") && budgetBody.includes("Estimated Operating Cash Flow"));
  });

  await t.test("createChatStream always returns readable non-empty fallback text when Gemini key absent", async () => {
    const streamResponse = await createChatStream([
      { role: "user", content: "Show failed or pending transactions." },
    ]);
    assert.equal(streamResponse.status, 200);
    const body = await streamResponse.text();
    assert.ok(body.includes("Transaction Ledger"));
  });
});
