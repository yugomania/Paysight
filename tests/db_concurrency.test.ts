import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getStoredTransactions,
  saveTransaction,
  saveTransactionsBatch,
} from "../src/lib/db";

test("Database Persistence: concurrency safety and corrupted JSON backup recovery", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "paysight-db-"));
  const dbPath = path.join(tmpDir, "db.json");
  const prevDb = process.env.PAYSIGHT_DB_PATH;
  process.env.PAYSIGHT_DB_PATH = dbPath;

  t.after(() => {
    if (prevDb === undefined) delete process.env.PAYSIGHT_DB_PATH;
    else process.env.PAYSIGHT_DB_PATH = prevDb;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test("handles burst writes and batch updates without temp-file collisions", async () => {
    const writes = Array.from({ length: 25 }, (_, i) =>
      Promise.resolve().then(() =>
        saveTransaction({
          id: `BURST-${i}`,
          date: new Date().toISOString(),
          amount: 10 + i,
          currency: "USD",
          status: "COMPLETED",
          customerName: `Customer ${i}`,
          customerEmail: `c${i}@test.dev`,
          productName: "Burst Product",
          paymentMethod: "paypal",
          source: "paypal_sandbox",
        })
      )
    );
    await Promise.all(writes);

    saveTransactionsBatch([
      {
        id: "BATCH-1",
        date: new Date().toISOString(),
        amount: 42,
        currency: "USD",
        status: "COMPLETED",
        customerName: "Batch Buyer",
        customerEmail: "b@test.dev",
        productName: "Batch SKU",
        paymentMethod: "paypal",
        source: "paypal_sandbox",
      },
    ]);

    const stored = getStoredTransactions();
    for (let i = 0; i < 25; i++) {
      assert.ok(stored.some((tx) => tx.id === `BURST-${i}`), `Missing BURST-${i}`);
    }
    assert.ok(stored.some((tx) => tx.id === "BATCH-1"));
  });

  await t.test("preserves corrupted JSON backup before initializing empty store", () => {
    fs.writeFileSync(dbPath, "{ invalid json !!", "utf-8");
    const recovered = getStoredTransactions();
    assert.equal(recovered.length, 0, "Must recover cleanly with empty store (no mock seeds)");

    const backups = fs.readdirSync(tmpDir).filter((f) => f.includes(".corrupt."));
    assert.equal(backups.length, 1, "Must save .corrupt backup before overwriting");
  });
});

