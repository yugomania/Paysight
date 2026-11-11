import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET as healthGet } from "../src/app/api/health/route";
import { GET as pricingGet } from "../src/app/api/pricing/route";
import {
  checkRateLimit,
  resetRateLimitsForTests,
} from "../src/lib/security/rate-limit";

test("Security, Rate Limiting, Health Check & SQL Migration Schema", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "paysight-sec-"));
  const prevDb = process.env.PAYSIGHT_DB_PATH;
  process.env.PAYSIGHT_DB_PATH = path.join(tmpDir, "db.json");

  t.afterEach(() => {
    resetRateLimitsForTests();
  });

  t.after(() => {
    if (prevDb === undefined) delete process.env.PAYSIGHT_DB_PATH;
    else process.env.PAYSIGHT_DB_PATH = prevDb;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test("rate limiter enforces sliding window limits and returns retry metadata", () => {
    const now = 1_700_000_000_000;
    const r1 = checkRateLimit({ key: "test-ip", limit: 2, windowMs: 60_000, nowMs: now });
    const r2 = checkRateLimit({ key: "test-ip", limit: 2, windowMs: 60_000, nowMs: now + 500 });
    const r3 = checkRateLimit({ key: "test-ip", limit: 2, windowMs: 60_000, nowMs: now + 1000 });

    assert.equal(r1.allowed, true);
    assert.equal(r1.remaining, 1);
    assert.equal(r2.allowed, true);
    assert.equal(r2.remaining, 0);
    assert.equal(r3.allowed, false);
    assert.ok(r3.retryAfterSeconds >= 1);

    // Advances past window -> resets cleanly
    const r4 = checkRateLimit({ key: "test-ip", limit: 2, windowMs: 60_000, nowMs: now + 61_000 });
    assert.equal(r4.allowed, true);
  });

  await t.test("GET /api/pricing returns HTTP 429 when client exceeds quota", async () => {
    const prevKey = process.env.CHANNEL3_API_KEY;
    const origFetch = globalThis.fetch;
    process.env.CHANNEL3_API_KEY = "c3_test_quota_key_123456";
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ products: [] }), { status: 200 });

    try {
      for (let i = 0; i < 40; i++) {
        const res = await pricingGet(
          new NextRequest("http://localhost:3000/api/pricing?product=keyboard&price=89", {
            headers: { "x-forwarded-for": "10.0.0.42" },
          })
        );
        assert.equal(res.status, 200);
      }

      const blocked = await pricingGet(
        new NextRequest("http://localhost:3000/api/pricing?product=keyboard&price=89", {
          headers: { "x-forwarded-for": "10.0.0.42" },
        })
      );
      assert.equal(blocked.status, 429);
      assert.ok(blocked.headers.get("retry-after"));
    } finally {
      globalThis.fetch = origFetch;
      if (prevKey === undefined) delete process.env.CHANNEL3_API_KEY;
      else process.env.CHANNEL3_API_KEY = prevKey;
    }
  });

  await t.test("GET /api/health returns non-sensitive operational readiness telemetry", async () => {
    const prevSecret = process.env.PAYPAL_CLIENT_SECRET;
    process.env.PAYPAL_CLIENT_SECRET = "TOP_SECRET_VALUE_MUST_NOT_LEAK";
    try {
      const res = await healthGet();
      assert.equal(res.status, 200);
      const rawText = await res.text();
      assert.ok(!rawText.includes("TOP_SECRET_VALUE_MUST_NOT_LEAK"));

      const json = JSON.parse(rawText);
      assert.equal(json.status, "ok");
      assert.equal(json.persistence.driver, "json_file");
      assert.equal(typeof json.integrations.paypalConfigured, "boolean");
      assert.equal(typeof json.integrations.geminiConfigured, "boolean");
      assert.equal(typeof json.integrations.channel3Configured, "boolean");
    } finally {
      if (prevSecret === undefined) delete process.env.PAYPAL_CLIENT_SECRET;
      else process.env.PAYPAL_CLIENT_SECRET = prevSecret;
    }
  });

  await t.test("PostgreSQL migration schema covers all PaySight tables", () => {
    const sqlPath = path.resolve("db/migrations/001_init.sql");
    assert.ok(fs.existsSync(sqlPath));
    const sql = fs.readFileSync(sqlPath, "utf-8");
    for (const tableName of [
      "paysight_transactions",
      "paysight_invoices",
      "paysight_processed_events",
      "paysight_reconciled_ids",
      "paysight_expenses",
      "paysight_budget_targets",
    ]) {
      assert.ok(sql.includes(tableName), `Missing table ${tableName} in 001_init.sql`);
    }
  });
});

