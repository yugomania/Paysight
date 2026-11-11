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
| `tests/pricing.test.ts` | Demo simulated source labeling, live Channel3 response parsing, fail-honest empty/HTTP error behavior without price fabrication |
| `tests/reconciliation_and_webhooks.test.ts` | Unknown SKU rejection, capture persistence & reconciliation flags, transaction deduplication, fail-closed `503`/`401` webhook gates, verified event handling, invoice line-item preservation, `PAID` downgrade prevention |

---

## 2. Manual Judge Verification Walkthrough

### A. Demo Mode (Zero Configuration)
1. Ensure `.env.local` has blank PayPal/Gemini/Channel3 keys (or omit `.env.local`).
2. Start dev server: `npm run dev` and open `http://localhost:3000`.
3. Confirm the orange **Demo Mode Active** banner appears and bottom-left sidebar shows `Demo Mode`.
4. Navigate through **Overview**, **Transactions** (click a row for detail modal + test `Export`), **Invoices** (create a multi-item draft -> send -> inspect detail -> cancel), **Budget intelligence** (edit targets + add/delete an expense), **Price comparison** (verify `Demo Catalog Fallback` badge), **Disputes** (confirms zero fabricated disputes), and **Sandbox checkout** (select any of the 4 SKUs and click `Execute Demo Mode Checkout`).
5. Open **Ask PaySight** (`Cmd+J`) and run `"Summarise my payments for the last 30 days."` and `"How am I pacing against my monthly budget and sales target?"`.

### B. PayPal Sandbox Mode Verification
1. Populate `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENVIRONMENT=sandbox`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, and `PAYPAL_WEBHOOK_ID` in `.env.local`.
2. Restart `npm run dev`. Confirm sidebar indicator switches to **PayPal Sandbox** (`api-m.sandbox.paypal.com`).
3. Create a Draft invoice via `+ New Invoice` -> check your PayPal Sandbox Developer Dashboard -> click **Send** inside `Invoices`.
4. Test **Sandbox checkout**: select a catalog SKU, click the PayPal button, sign in with a Sandbox **Personal Buyer** test account, approve, and verify the resulting `CAP-*` transaction appears in `Transactions` with actual PayPal fees and net settlement.

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

