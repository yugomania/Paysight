# PaySight — Hackathon Testing & Verification Guide

## 1. Automated Quality Gates

Verify dependencies, linting, strict TypeScript checking, isolated unit/integration tests, and production build:

```bash
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run build
```

> **Note**: Every suite in `tests/*.test.ts` configures an isolated temporary `PAYSIGHT_DB_PATH` inside `os.tmpdir()` and cleans it up afterward, so running `npm test` does not modify `.data/paysight-db.json`.

### Covered Test Suites (`tests/`)

| File | Coverage |
|---|---|
| `tests/analytics.test.ts` | 30-day date chunking (60d/90d), strict multi-currency isolation, refund/fee separation, period deltas, dispute rate, zero-denominator AOV guard, currency-scoped series |
| `tests/assistant_grounding.test.ts` | `summarizePayments` vs. `getMerchantKPIs` parity across days/currencies, untrusted text sanitization, `getBudgetIntelligence`, `compareProductPricing`, confirmation token enforcement, offline/chat streams |
| `tests/budget.test.ts` | Gross/fee/net/refund/manual expense math, currency isolation, budget statuses/alerts, target updates, expense validation & deletion, MoM comparison |
| `tests/db_concurrency.test.ts` | Burst concurrent writes, batch writes, lockfile serialization, `.corrupt.*` backup recovery |
| `tests/invoicing.test.ts` | Proposal field validation, SHA-256 confirmation mismatch, `autoSend` & HTTP token requirements, Draft -> Sent -> Cancelled lifecycle, concurrent lock rejection |
| `tests/pricing.test.ts` | Fail-closed `channel3_unavailable` without mock fabrication, live Channel3 `POST /v1/search` nested `offers[]` & flat fixture parsing, HTTP `502` error honesty |
| `tests/reconciliation_and_webhooks.test.ts` | Unknown SKU rejection, unconfigured `503` capture rejection, transaction deduplication, fail-closed `503`/`401` webhook gates, verified event handling, auto stale-token revocation on `403`, invoice line-item preservation, `PAID` downgrade prevention |
| `tests/security_and_health.test.ts` | Sliding-window per-IP rate limiting (`429` + `Retry-After` on `/api/pricing`), non-sensitive `/api/health` readiness telemetry, and PostgreSQL schema coverage (`db/migrations/001_init.sql`) |

---

## 2. Manual Judge Verification Walkthrough

### A. Unconfigured Fail-Closed Verification
1. If `.env.local` has blank PayPal/Gemini/Channel3 keys, verify APIs fail closed rather than serving fake/mock data:
   - `POST /api/orders/create`, `POST /api/orders/capture`, `POST /api/invoices` (mutations), `GET /api/pricing`, and `POST /api/chat` return HTTP `503`.
   - `.data/paysight-db.json` initializes with empty arrays (`[]`) and zero demo seed transactions/invoices/expenses.

### B. PayPal Sandbox Mode Verification
1. Populate `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENVIRONMENT=sandbox`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, and `PAYPAL_WEBHOOK_ID` (plus `GOOGLE_GENERATIVE_AI_API_KEY` and `CHANNEL3_API_KEY`) in `.env.local`.
2. Restart `npm run dev`. Confirm sidebar indicator shows **PayPal Sandbox** (`api-m.sandbox.paypal.com`) and zero disconnection banners appear.
3. Navigate through **Overview** (with currency selector), **Transactions** (detail modal + `Export`), **Invoices** (`+ New Invoice` 2-step preview -> `Send` -> `Cancel`), **Budget intelligence** (targets + expenses), **Price comparison** (`Channel3 Live` badge), **Disputes**, and **Sandbox checkout** (`starter_10`, `sub_pro`, `intel_add`, `exp_pack` via PayPal popup buyer login).
4. Open **Ask PaySight** (`Cmd+J`) and test live Gemini tool calls (`"Summarise my payments for the last 30 days."`, `"How am I pacing against my monthly budget and sales target?"`).

### C. Fail-Closed Webhook Check (`curl`)
Verify unsigned requests fail closed (`401` when configured, or `503` if `PAYPAL_WEBHOOK_ID` is unset):

```bash
curl -i -X POST http://localhost:3000/api/webhooks/paypal \
  -H "Content-Type: application/json" \
  -d '{"id":"TEST-UNSIGNED","event_type":"PAYMENT.CAPTURE.COMPLETED"}'
```

Expected: HTTP `401` (missing transmission headers) or `503` (missing verification config) — never HTTP `200`.

---

## 3. Troubleshooting

- **`npm run build` fails on `Geist` font download**: Ensure internet access to `fonts.googleapis.com` during `next build`.
- **PayPal Checkout returns `ORDER_NOT_APPROVED`**: Wait for the buyer popup approval to complete before capture; avoid refreshing mid-popup.
- **Transaction Search warning notice**: Enable **Transaction Search** under App Features in your PayPal Sandbox Developer App.

