import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { POST as webhookHandler } from "../src/app/api/webhooks/paypal/route";
import {
  captureServerSideOrder,
  createInvoice,
  listInvoicesWithMeta,
  listTransactions,
} from "../src/lib/paypal/api";
import { invalidatePayPalAuth } from "../src/lib/paypal/client";
import {
  getStoredInvoiceById,
  getStoredTransactions,
  isEventProcessed,
  isReconciled,
  saveTransaction,
} from "../src/lib/db";

test("Payment State, Reconciliation & Fail-Closed Webhook Processing", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "paysight-wh-"));
  const prevDb = process.env.PAYSIGHT_DB_PATH;
  const prevCid = process.env.PAYPAL_CLIENT_ID;
  const prevSec = process.env.PAYPAL_CLIENT_SECRET;
  const prevWh = process.env.PAYPAL_WEBHOOK_ID;
  process.env.PAYSIGHT_DB_PATH = path.join(tmpDir, "db.json");

  t.after(() => {
    if (prevDb === undefined) delete process.env.PAYSIGHT_DB_PATH;
    else process.env.PAYSIGHT_DB_PATH = prevDb;
    if (prevCid === undefined) delete process.env.PAYPAL_CLIENT_ID;
    else process.env.PAYPAL_CLIENT_ID = prevCid;
    if (prevSec === undefined) delete process.env.PAYPAL_CLIENT_SECRET;
    else process.env.PAYPAL_CLIENT_SECRET = prevSec;
    if (prevWh === undefined) delete process.env.PAYPAL_WEBHOOK_ID;
    else process.env.PAYPAL_WEBHOOK_ID = prevWh;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test("captureServerSideOrder rejects invalid SKU, saves valid order, and marks reconciled", async () => {
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;

    const bad = await captureServerSideOrder("ORD-1", "unknown_sku");
    assert.equal(bad.success, false);

    const captureResult = await captureServerSideOrder(`TEST-ORDER-${Date.now()}`, "sub_pro");
    assert.equal(captureResult.success, true);
    assert.equal(captureResult.transaction?.amount, 49.0);
    assert.equal(captureResult.transaction?.currency, "USD");
    assert.ok(isReconciled(captureResult.transaction!.id));
    assert.ok(getStoredTransactions().some((tx) => tx.id === captureResult.transaction!.id));
  });

  await t.test("deduplication prevents double counting across repeated saves", async () => {
    const id = `RECON-TX-${Date.now()}`;
    const tx = {
      id,
      date: new Date().toISOString(),
      amount: 120.0,
      fee: 3.78,
      net: 116.22,
      currency: "USD",
      status: "COMPLETED" as const,
      customerName: "Recon Buyer",
      customerEmail: "recon@test.dev",
      productName: "Service",
      paymentMethod: "paypal" as const,
      source: "demo_sample" as const,
    };

    saveTransaction(tx);
    saveTransaction(tx);
    const list = await listTransactions(30);
    assert.equal(list.filter((item) => item.id === id).length, 1);
  });

  await t.test("webhook fails closed (503) when verification config is missing", async () => {
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
    delete process.env.PAYPAL_WEBHOOK_ID;

    const req = new NextRequest("http://localhost:3000/api/webhooks/paypal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "WH-MISSING-CFG",
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: { id: "CAP-1", amount: { value: "25.00", currency_code: "USD" } },
      }),
    });
    const res = await webhookHandler(req);
    assert.equal(res.status, 503);
  });

  await t.test("webhook rejects missing headers or invalid signatures with 401", async () => {
    process.env.PAYPAL_CLIENT_ID = "sandbox-client-id-more-than-twenty-chars";
    process.env.PAYPAL_CLIENT_SECRET = "sandbox-client-secret-value";
    process.env.PAYPAL_WEBHOOK_ID = "WH-ID-TEST-123";

    const missingHdrReq = new NextRequest("http://localhost:3000/api/webhooks/paypal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "WH-NO-HDR", event_type: "PAYMENT.CAPTURE.COMPLETED" }),
    });
    const r1 = await webhookHandler(missingHdrReq);
    assert.equal(r1.status, 401);

    const invalidSigReq = new NextRequest("http://localhost:3000/api/webhooks/paypal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "paypal-transmission-id": "tr-1",
        "paypal-transmission-time": new Date().toISOString(),
        "paypal-cert-url": "https://api.sandbox.paypal.com/cert.pem",
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-transmission-sig": "invalid_signature",
      },
      body: JSON.stringify({ id: "WH-BAD-SIG", event_type: "PAYMENT.CAPTURE.COMPLETED" }),
    });
    const r2 = await webhookHandler(invalidSigReq);
    assert.equal(r2.status, 401);
  });

  await t.test("webhook processes verified event, deduplicates repeats, and preserves invoice line items", async () => {
    // Create local draft invoice first to test line-item preservation on webhook PAID
    delete process.env.PAYPAL_CLIENT_ID;
    const inv = await createInvoice({
      recipientName: "Acme Global",
      recipientEmail: "ap@acme.dev",
      items: [{ name: "Annual Intelligence Plan", quantity: 2, unitAmount: 250.0 }],
      autoSend: false,
    });

    process.env.PAYPAL_CLIENT_ID = "sandbox-client-id-more-than-twenty-chars-2";
    process.env.PAYPAL_CLIENT_SECRET = "sandbox-client-secret-value-2";
    process.env.PAYPAL_WEBHOOK_ID = "WH-ID-TEST-123";

    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const target = String(url);
      if (target.includes("/v1/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "mock-tok", expires_in: 3600 }), {
          status: 200,
        });
      }
      if (target.includes("/v1/notifications/verify-webhook-signature")) {
        return new Response(JSON.stringify({ verification_status: "SUCCESS" }), { status: 200 });
      }
      throw new Error(`Unexpected fetch ${target}`);
    };

    try {
      const signedHeaders = {
        "Content-Type": "application/json",
        "paypal-transmission-id": "tr-valid-1",
        "paypal-transmission-time": new Date().toISOString(),
        "paypal-cert-url": "https://api.sandbox.paypal.com/cert.pem",
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-transmission-sig": "valid-rsa-signature",
      };

      const paidEventId = `WH-INV-PAID-${Date.now()}`;
      const paidPayload = {
        id: paidEventId,
        event_type: "INVOICING.INVOICE.PAID",
        resource: {
          id: inv.id,
          amount: { value: "500.00" },
        },
      };

      const r1 = await webhookHandler(
        new NextRequest("http://localhost:3000/api/webhooks/paypal", {
          method: "POST",
          headers: signedHeaders,
          body: JSON.stringify(paidPayload),
        })
      );
      assert.equal(r1.status, 200);
      assert.ok(isEventProcessed(paidEventId));

      const updatedInv = getStoredInvoiceById(inv.id);
      assert.equal(updatedInv?.status, "PAID");
      assert.equal(updatedInv?.items.length, 1, "Must preserve existing line items");
      assert.equal(updatedInv?.items[0].name, "Annual Intelligence Plan");
      assert.equal(updatedInv?.recipientEmail, "ap@acme.dev");

      // Repeat identical event -> skipped idempotently
      const r2 = await webhookHandler(
        new NextRequest("http://localhost:3000/api/webhooks/paypal", {
          method: "POST",
          headers: signedHeaders,
          body: JSON.stringify(paidPayload),
        })
      );
      assert.equal(r2.status, 200);
      const dupBody = await r2.json();
      assert.equal(dupBody.status, "duplicate_skipped");

      // Late SENT webhook must not downgrade PAID status
      const lateSent = {
        id: `WH-INV-SENT-${Date.now()}`,
        event_type: "INVOICING.INVOICE.SENT",
        resource: { id: inv.id },
      };
      const r3 = await webhookHandler(
        new NextRequest("http://localhost:3000/api/webhooks/paypal", {
          method: "POST",
          headers: signedHeaders,
          body: JSON.stringify(lateSent),
        })
      );
      assert.equal(r3.status, 200);
      assert.equal(getStoredInvoiceById(inv.id)?.status, "PAID");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  await t.test("listInvoicesWithMeta auto-terminates stale OAuth token on 403 and recovers cleanly", async () => {
    process.env.PAYPAL_CLIENT_ID = "AX_TEST_CLIENT_ID_LONG_ENOUGH_FOR_VALIDATION";
    process.env.PAYPAL_CLIENT_SECRET = "EX_TEST_SECRET_LONG_ENOUGH_FOR_VALIDATION";
    await invalidatePayPalAuth(false);

    const origFetch = globalThis.fetch;
    let tokenCounter = 0;
    let terminateCalled = false;
    let invoiceCalls = 0;

    try {
      globalThis.fetch = async (url) => {
        const u = String(url);
        if (u.endsWith("/v1/oauth2/token")) {
          tokenCounter += 1;
          return new Response(
            JSON.stringify({ access_token: `tok_${tokenCounter}`, expires_in: 32400 }),
            { status: 200 }
          );
        }
        if (u.endsWith("/v1/oauth2/token/terminate")) {
          terminateCalled = true;
          return new Response("", { status: 200 });
        }
        if (u.includes("/v2/invoicing/invoices")) {
          invoiceCalls += 1;
          if (invoiceCalls === 1) {
            return new Response(
              JSON.stringify({ name: "NOT_AUTHORIZED" }),
              { status: 403 }
            );
          }
          return new Response(JSON.stringify({ items: [] }), { status: 200 });
        }
        throw new Error(`Unexpected fetch URL: ${u}`);
      };

      const res = await listInvoicesWithMeta();
      assert.equal(terminateCalled, true, "Must terminate stale OAuth token on 403");
      assert.equal(tokenCounter, 2, "Must re-fetch fresh OAuth token");
      assert.equal(invoiceCalls, 2);
      assert.equal(res.isLive, true);
      assert.equal(res.dataSource, "paypal_sandbox");
    } finally {
      globalThis.fetch = origFetch;
      await invalidatePayPalAuth(false);
    }
  });
});
