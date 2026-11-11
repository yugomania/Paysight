import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { POST as invoicesPost } from "../src/app/api/invoices/route";
import {
  cancelExistingInvoice,
  createInvoice,
  prepareInvoiceProposal,
  sendDraftInvoice,
} from "../src/lib/paypal/api";
import { invalidatePayPalAuth } from "../src/lib/paypal/client";
import type { CreateInvoiceInput } from "../src/types";

test("PayPal Invoicing: validation, preview binding, lifecycle, and concurrency lock", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "paysight-inv-"));
  const prevDb = process.env.PAYSIGHT_DB_PATH;
  const prevCid = process.env.PAYPAL_CLIENT_ID;
  const prevSec = process.env.PAYPAL_CLIENT_SECRET;
  const origFetch = globalThis.fetch;
  process.env.PAYSIGHT_DB_PATH = path.join(tmpDir, "db.json");
  process.env.PAYPAL_CLIENT_ID = "AX_INV_TEST_CLIENT_ID_LONG_ENOUGH_FOR_VALIDATION";
  process.env.PAYPAL_CLIENT_SECRET = "EX_INV_TEST_SECRET_LONG_ENOUGH_FOR_VALIDATION";

  t.after(async () => {
    globalThis.fetch = origFetch;
    await invalidatePayPalAuth(false);
    if (prevDb === undefined) delete process.env.PAYSIGHT_DB_PATH;
    else process.env.PAYSIGHT_DB_PATH = prevDb;
    if (prevCid === undefined) delete process.env.PAYPAL_CLIENT_ID;
    else process.env.PAYPAL_CLIENT_ID = prevCid;
    if (prevSec === undefined) delete process.env.PAYPAL_CLIENT_SECRET;
    else process.env.PAYPAL_CLIENT_SECRET = prevSec;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test("identifies missing or invalid invoice fields", () => {
    const proposal = prepareInvoiceProposal({
      recipientName: "Test Buyer",
      items: [],
    });
    assert.equal(proposal.isValid, false);
    assert.ok(proposal.missingFields.includes("recipientEmail"));
    assert.ok(proposal.missingFields.includes("items"));
  });

  await t.test("binds confirmationToken and rejects edits after preview", async () => {
    const original: CreateInvoiceInput = {
      recipientName: "Acme Corp",
      recipientEmail: "billing@acme.com",
      items: [{ name: "Widget A", quantity: 1, unitAmount: 100.0 }],
      currency: "USD",
    };

    const proposal = prepareInvoiceProposal(original);
    assert.equal(proposal.isValid, true);
    assert.equal(proposal.totalAmount, 100.0);

    await assert.rejects(
      () =>
        createInvoice({
          ...original,
          items: [{ name: "Widget A", quantity: 1, unitAmount: 150.0 }],
          confirmationToken: proposal.confirmationToken,
        }),
      /Confirmation token mismatch/
    );
  });

  await t.test("rejects autoSend without confirmationToken and rejects HTTP POST without token", async () => {
    await assert.rejects(
      () =>
        createInvoice({
          recipientName: "Unconfirmed Buyer",
          recipientEmail: "buyer@test.dev",
          items: [{ name: "Service", quantity: 1, unitAmount: 50.0 }],
          autoSend: true,
        }),
      /confirmation token is required/
    );

    const req = new NextRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientName: "Direct POST",
        recipientEmail: "post@test.dev",
        items: [{ name: "Service", quantity: 1, unitAmount: 50 }],
      }),
    });
    const res = await invoicesPost(req);
    assert.equal(res.status, 400);
  });

  await t.test("creates DRAFT by default, supports sendDraftInvoice and cancelExistingInvoice", async () => {
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (u.endsWith("/v1/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "tok-inv-test", expires_in: 3600 }), {
          status: 200,
        });
      }
      if (u.endsWith("/v2/invoicing/invoices") && init?.method === "POST") {
        return new Response(
          JSON.stringify({ id: "INV2-LIVE-101", detail: { invoice_number: "1001" } }),
          { status: 201 }
        );
      }
      if (u.endsWith("/v2/invoicing/invoices/INV2-LIVE-101/send")) {
        return new Response(
          JSON.stringify({ href: "https://sandbox.paypal.com/invoice/p/#INV2-LIVE-101" }),
          { status: 200 }
        );
      }
      if (u.endsWith("/v2/invoicing/invoices/INV2-LIVE-101/cancel")) {
        return new Response(null, { status: 204 });
      }
      if (u.endsWith("/v2/invoicing/invoices/INV2-LIVE-101") && init?.method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected URL: ${u}`);
    };

    const invoice = await createInvoice({
      recipientName: "Lifecycle Customer",
      recipientEmail: "life@test.dev",
      items: [{ name: "Draft Product", quantity: 1, unitAmount: 75.0 }],
      autoSend: false,
    });
    assert.equal(invoice.status, "DRAFT");
    assert.equal(invoice.source, "paypal_sandbox");

    const sent = await sendDraftInvoice(invoice.id);
    assert.equal(sent.status, "SENT");
    assert.ok(sent.paymentUrl?.includes("INV2-LIVE-101"));

    const cancelled = await cancelExistingInvoice(invoice.id);
    assert.equal(cancelled.status, "CANCELLED");
  });

  await t.test("fails closed when PayPal credentials are missing", async () => {
    const savedCid = process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_ID;
    try {
      await assert.rejects(
        () =>
          createInvoice({
            recipientName: "No Creds Buyer",
            recipientEmail: "nocreds@test.dev",
            items: [{ name: "Service", quantity: 1, unitAmount: 50.0 }],
          }),
        /PayPal Sandbox credentials/
      );
    } finally {
      process.env.PAYPAL_CLIENT_ID = savedCid;
    }
  });

  await t.test("rejects concurrent duplicate invoice creation requests", async () => {
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (u.endsWith("/v1/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "tok-inv-test", expires_in: 3600 }), {
          status: 200,
        });
      }
      if (u.endsWith("/v2/invoicing/invoices") && init?.method === "POST") {
        return new Response(
          JSON.stringify({ id: "INV2-CONCURRENT-1", detail: { invoice_number: "2001" } }),
          { status: 201 }
        );
      }
      throw new Error(`Unexpected URL: ${u}`);
    };

    const input: CreateInvoiceInput = {
      recipientName: "Concurrent Test",
      recipientEmail: "concurrent@test.dev",
      items: [{ name: "Duplicate Guard Test", quantity: 1, unitAmount: 199.0 }],
    };

    const [r1, r2] = await Promise.allSettled([createInvoice(input), createInvoice(input)]);
    const fulfilled = [r1, r2].filter((r) => r.status === "fulfilled").length;
    const rejected = [r1, r2].filter((r) => r.status === "rejected").length;
    assert.equal(fulfilled, 1);
    assert.equal(rejected, 1);
  });
});
