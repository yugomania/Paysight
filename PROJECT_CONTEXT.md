# PROJECT_CONTEXT.md — PaySight Engineering Context

## 1. Project Purpose
PaySight (`paysight` `v0.1.0` / UI `PaySight v2.0`) is a Next.js 16 merchant intelligence dashboard for PayPal business users combining:
- PayPal Sandbox transaction analytics, KPIs, and settlement velocity charts
- Two-step SHA-256 confirmed PayPal Invoicing v2 creation, sending, and cancellation
- Buyer-approved PayPal Sandbox / Demo Mode checkout with server-authoritative SKU pricing
- Monthly Merchant Budget Intelligence (PayPal gross/fees/net vs. sales targets and manual operating expenses)
- Channel3 competitive product price comparisons with exact vs. approximate classification
- Grounded Google Gemini Copilot (`ai@4.3.19`) with deterministic local fallback tools

## 2. Technology Stack & Constraints
- **Framework**: Next.js `16.4.2` (App Router, Turbopack), React `19.3.0`, TypeScript `5` (`strict: true`).
  - *Constraint (`AGENTS.md`)*: Consult `node_modules/next/dist/docs/` before changing Next.js 16 conventions.
- **UI**: Tailwind CSS v4 (`@tailwindcss/turbopack`), AG Grid Community `36.2.0` (`theme="legacy"` with imported Quartz CSS in `src/app/globals.css`), Recharts `3.10.1`, `lucide-react`.
- **AI**: Vercel AI SDK `ai@^4.3.19` (`ai/react` on client, `streamText` + `convertToCoreMessages` + `createDataStreamResponse` on server) + `@ai-sdk/google@^1.2.22`.
  - *Constraint*: Do not install `@ai-sdk/react` v4 or `@ai-sdk/google` v4 while on `ai@4.3.19` without migrating the entire AI SDK stack together.
- **PayPal**: `@paypal/paypal-server-sdk@^2.5.0`, `@paypal/react-paypal-js@^10.6.0`, plus PayPal REST calls for Invoicing v2, Disputes v1, OAuth2 token caching, and Webhook signature verification.
- **Storage**: Synchronous file-locked atomic JSON persistence in `src/lib/db/index.ts` (defaults to `.data/paysight-db.json`, overridable via `PAYSIGHT_DB_PATH`).

## 3. Architecture & Key File Locations
- `src/types/index.ts` — Domain models (`Transaction`, `MerchantKPIs`, `Invoice`, `Dispute`, `PricingComparison`, `MerchantExpense`, `MonthlyBudgetTarget`, `BudgetSummary`).
- `src/lib/db/index.ts` — `StoreRepository` interface, cross-process `.lock` file serialization, `randomUUID()` temp writes, `.corrupt.*` backup preservation, and deterministic demo seeds.
- `src/lib/db/postgres.deferred.ts` & `db/migrations/001_init.sql` — Deferred PostgreSQL/Neon schema and `AsyncStoreRepository` contract ready to replace `.data/paysight-db.json` when multi-instance / durable cloud persistence is prioritized.
- `src/lib/security/rate-limit.ts` — Sliding-window per-IP rate limiter protecting AI, Channel3 pricing, checkout, invoicing, and budget write endpoints.
- `src/lib/paypal/client.ts` — PayPal SDK singleton (keyed by credentials/env), OAuth token cache, `invalidatePayPalAuth()` (`POST /v1/oauth2/token/terminate` cache busting), `hasValidPayPalConfig()`, fail-closed `verifyWebhookSignatureDetailed()`.
- `src/lib/paypal/catalog.ts` — Authoritative `SANDBOX_PRODUCTS` (`demo_10`, `sub_pro`, `intel_add`, `exp_pack`) and `extractPayPalSdkError()` (extracting SDK `result` and JSON `body` details cleanly).
- `src/lib/paypal/api.ts` — `buildDateChunks()` (`<=30d`), paginated `fetchTransactionsWithMeta()`, currency-isolated `computeMerchantKPIs()`/`getMerchantKPIs()`, `getRevenueTimeSeries()`, PayPal Invoicing v2 CRUD (`listInvoicesWithMeta`, `prepareInvoiceProposal`, `createInvoice`, `sendDraftInvoice`, `cancelExistingInvoice`), `listDisputes()`, `captureServerSideOrder()`.
- `src/lib/budget/service.ts` — `computeBudgetSummaryFromRecords()`, `getBudgetSummary()`, `recordMerchantExpense()`, `updateMonthlyBudgetTarget()`, `removeMerchantExpense()`.
- `src/lib/channel3/client.ts` — `searchProductsWithMeta()` (`POST https://api.trychannel3.com/v1/search` with nested `offers[]` + flat fixture support), `getPricingComparison()`, bounded 15-min cache, honest empty/error handling in live mode vs. explicit demo fallback.
- `src/lib/ai/orchestrator.ts` — `SYSTEM_PROMPT`, `sanitizeUntrustedField()`, 9 grounded tools (`paysightTools`), Gemini 3.x `thoughtSignature` passthrough `fetch` bridge + retired/quota model failover (`gemini-3.5-flash` -> `gemini-3-flash-preview` -> `gemini-3.5-flash-lite`), `createChatStream()`, `generateOfflineMarkdown()`.
- `src/app/api/*` — Route handlers: `health`, `transactions`, `orders/create`, `orders/capture`, `invoices`, `disputes`, `pricing`, `budget`, `chat`, `webhooks/paypal`.
- `src/app/page.tsx` & `src/components/` — 7-tab SPA (`overview` with currency selector, `transactions`, `invoices`, `budget`, `pricing`, `disputes`, `checkout`) + `ChatPanel` drawer (`Cmd+J`, `Cmd+K` search).

## 4. Critical Business Logic & Invariants
1. **Strict Demo vs. Sandbox Separation**: When `hasValidPayPalConfig()` is true and PayPal APIs succeed, `demo_sample` seed transactions/invoices are excluded from live Sandbox counts; HTTP 403/failed PayPal API calls report `isLive: false` / `dataSource: "demo_sample"` honestly rather than mislabeling local records as live.
2. **Strict Currency Isolation**: KPIs, revenue charts, Overview KPI currency selector, and monthly budgets filter by a single target currency (`USD` default) and never sum heterogeneous currencies.
3. **Fail-Closed Webhooks**: `/api/webhooks/paypal` requires all 5 `paypal-*` headers and `PAYPAL_WEBHOOK_ID` + valid PayPal API verification; `INVOICING.INVOICE.*` events merge status updates while preserving existing line items.
4. **Two-Step Invoice Safety**: HTTP `POST /api/invoices` requires a SHA-256 `confirmationToken` from `validate_proposal`; `autoSend: true` always requires matching token verification.
5. **Test Isolation**: Every `tests/*.test.ts` suite sets `PAYSIGHT_DB_PATH` to an `os.tmpdir()` folder cleaned up in `t.after()` so `.data/paysight-db.json` is never polluted.

## 5. Known Limitations & Next Priorities
- **No user auth / multi-tenancy**: Single-merchant workspace without end-user login/RBAC; process-local rate limiting is in place, but add auth + external store before public multi-user production hosting.
- **Ephemeral file persistence on Render Free**: Replace `jsonStoreRepository` with an async adapter matching `db/migrations/001_init.sql` (`src/lib/db/postgres.deferred.ts`) for durable multi-deploy cloud state.
- **PayPal Sandbox App Permissions**: On the current local Sandbox app, **Orders v2**, **Customer Disputes v1**, **Transaction Search v1**, and **Invoicing v2** all return live `200`/`201` responses after terminating stale cached OAuth tokens; `invalidatePayPalAuth()` automatically recovers from `401`/`403` stale-token windows on any app where Dashboard permissions are toggled.
- **Google Fonts build network requirement**: `next build` requires outbound network to `fonts.googleapis.com` for `Geist` / `Geist_Mono`.

