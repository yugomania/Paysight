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
import type { CreateInvoiceInput } from "../src/types";

test("PayPal Invoicing: validation, preview binding, lifecycle, and concurrency lock", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "paysight-inv-"));
  const prevDb = process.env.PAYSIGHT_DB_PATH;
  process.env.PAYSIGHT_DB_PATH = path.join(tmpDir, "db.json");

  t.after(() => {
    if (prevDb === undefined) delete process.env.PAYSIGHT_DB_PATH;
    else process.env.PAYSIGHT_DB_PATH = prevDb;
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
    const invoice = await createInvoice({
      recipientName: "Lifecycle Customer",
      recipientEmail: "life@test.dev",
      items: [{ name: "Draft Product", quantity: 1, unitAmount: 75.0 }],
      autoSend: false,
    });
    assert.equal(invoice.status, "DRAFT");

    const sent = await sendDraftInvoice(invoice.id);
    assert.equal(sent.status, "SENT");

    const cancelled = await cancelExistingInvoice(invoice.id);
    assert.equal(cancelled.status, "CANCELLED");
  });

  await t.test("rejects concurrent duplicate invoice creation requests", async () => {
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
