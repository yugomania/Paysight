# CHANGELOG.md

All notable engineering upgrades and fixes for **PaySight** are recorded here.

## [hackathon/finalization] — 2026-11-11

### Security & Reliability
- **Fail-closed PayPal webhook verification** (`src/app/api/webhooks/paypal/route.ts`, `src/lib/paypal/client.ts`): Enforced all 5 PayPal transmission headers, `PAYPAL_WEBHOOK_ID`, HTTPS `*.paypal.com` cert verification, and remote signature validation; prevented status downgrades (`PAID` -> `SENT`); preserved existing invoice line `items` on invoice webhooks.
- **Concurrency-safe JSON persistence & test isolation** (`src/lib/db/index.ts`): Added cross-process file locking (`withFileLock`), `crypto.randomUUID()` temp filenames eliminating `ENOENT` collisions, `.corrupt.*` backup preservation, `saveTransactionsBatch()`, `PAYSIGHT_DB_PATH` test override, and `StoreRepository` abstraction.
- **Mandatory invoice preview confirmation**: Enforced `confirmationToken` on `POST /api/invoices` and whenever `autoSend: true`, plus microtask-yielding in-flight duplicate locks.
- **Shared SKU catalog** (`src/lib/paypal/catalog.ts`): Unified `SANDBOX_PRODUCTS` across order creation and capture, rejecting unknown SKUs and verifying captured amounts against order `customId`.

### Financial Correctness & PayPal Integrations
- **30-day date chunking & pagination** (`src/lib/paypal/api.ts`): Added `buildDateChunks()` (`<= 30` days) and multi-page PayPal Transaction Search pagination (`fetchTransactionsWithMeta`), surfacing partial-data notices honestly.
- **Strict currency isolation & fee math**: Fixed negative PayPal fee subtraction (`Math.abs`), isolated primary currency KPIs/series (`computeMerchantKPIs`, `getRevenueTimeSeries`), added multi-currency unconverted breakdown strip (`KPICards.tsx`), and computed live `disputeRate` from `listDisputes()`.
- **Strict Demo vs. Sandbox separation**: Prevented `demo_sample` seed records from mixing into live PayPal Sandbox metrics.
- **Invoice lifecycle & checkout completeness**: Added `sendDraftInvoice`, `cancelExistingInvoice`, `InvoicesPanel` detail modal + multi-item `QuickActionModal`, and exposed all 4 server SKUs plus working Demo Mode simulation in `PayPalDemoCheckout`.
- **Removed fake payment links**: Removed synthetic `createPaymentLink` (`LINK-*`) URL generator and tool.

### AI Copilot, Budget Intelligence & Market Intelligence
- **AI grounding & streaming stability** (`src/lib/ai/orchestrator.ts`, `src/components/ai/ChatPanel.tsx`): Aligned `summarizePayments` with `getMerchantKPIs(days, currency)`, added `getBudgetIntelligence` tool, added `convertToCoreMessages` + untrusted field sanitization + text-output error fallback recovery, added JSX Markdown rendering + tool invocation indicators, and fixed default `GEMINI_MODEL` to `gemini-2.0-flash`.
- **Merchant Budget Intelligence** (`src/lib/budget/service.ts`, `src/app/api/budget/route.ts`, `BudgetIntelligencePanel.tsx`): Implemented monthly sales targets, PayPal gross/fees/net proceeds, refunds, 7-category manual operating expenses, estimated cash flow, MoM comparison, and alerts.
- **Channel3 enhancements** (`src/lib/channel3/client.ts`, `CompetitorPricingGrid.tsx`): Dynamic env reading, bounded 15-min cache, honest empty/error behavior in live mode (no synthetic price fabrication), `priceDifference` metrics, and explicit `Channel3 Live` vs. `Demo` attribution.

### UI/UX, Packaging & Documentation
- Removed hardcoded `+14.8% trend` badge from `RevenueChart.tsx` in favor of computed half-over-half window deltas.
- Added transaction detail modal (`TransactionGrid.tsx`), `⌘K` search shortcut, and accessible dialog attributes.
- Removed 6 unused npm dependencies (`@paypal/agent-toolkit`, `@ai-sdk/openai`, `@ai-sdk/react`, `zustand`, `ag-grid-enterprise`, `axios`).
- Updated `.env.example`, `render.yaml`, `README.md`, and created `AUDIT_REPORT.md`, `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `SECURITY.md`, `CONTRIBUTING.md`, and Hackathon submission docs.

### Final Production & Live Integration Readiness Pass
- **Operational Readiness & Rate Limiting** (`src/app/api/health/route.ts`, `src/lib/security/rate-limit.ts`, `next.config.ts`, `render.yaml`): Added `GET /api/health` telemetry (no secret exposure), Render health check path, baseline HTTP security headers, and sliding-window per-IP rate limits on `/api/chat`, `/api/pricing`, `/api/orders/*`, `/api/invoices` POST, and `/api/budget` POST.
- **Deferred PostgreSQL/Neon Blueprint** (`db/migrations/001_init.sql`, `src/lib/db/postgres.deferred.ts`): Added idempotent SQL schema and async repository interface design without breaking synchronous local JSON storage or Demo Mode.
- **Live Upstream Integration Fixes Verified Outside Sandbox**:
  - Updated Channel3 client (`src/lib/channel3/client.ts`) to `POST https://api.trychannel3.com/v1/search` and parse nested `offers[]`/`brands[]`/`images[]` structures alongside flat test fixtures.
  - Updated Gemini orchestrator (`src/lib/ai/orchestrator.ts`) with a streaming `thoughtSignature` passthrough `fetch` bridge for Gemini 3.x multi-step tool calling (`ai@4.3.19` + `@ai-sdk/google@1.2.22`) and automatic failover across `gemini-3.5-flash` / `gemini-3-flash-preview` / `gemini-3.5-flash-lite` past retired `gemini-2.0-flash` / `gemini-2.5-flash`.
- Improved PayPal SDK `ApiError` body extraction (`extractPayPalSdkError`), added automatic stale-token revocation/retry (`invalidatePayPalAuth` via `/v1/oauth2/token/terminate` on `401`/`403` to bypass PayPal's 9-hour OAuth token cache), and removed all mock/demo/simulated fallbacks from `src/` so every integration operates strictly live and fails closed (`503`) when unconfigured:
  - Removed all seed generators (`buildSeed*`) from `src/lib/db/index.ts`; DB starts empty and strips legacy `demo_sample` / `EXP-DEMO-*` records.
  - Removed Channel3 `DEMO_CATALOG` & simulated fallback listings from `src/lib/channel3/client.ts` (`/api/pricing` returns `503` when `CHANNEL3_API_KEY` is missing).
  - Removed `generateOfflineMarkdown` regex fallback from `src/lib/ai/orchestrator.ts` (`/api/chat` returns `503` when `GOOGLE_GENERATIVE_AI_API_KEY` is missing).
  - Replaced `PayPalDemoCheckout.tsx` and simulated `ORD-DEMO-*`/`CAP-SIM-*`/`INV2-DEMO-*` flows with `PayPalSandboxCheckout.tsx` and fail-closed `503` PayPal config enforcement across orders, invoicing, and transactions.
  - Migrated `fetchTransactionsWithMeta()` to standard `fetch` + `getAccessToken()` matching `listInvoicesWithMeta()` and `listDisputes()`.
- **Dashboard UX Polish**: Added Overview currency selector (`src/app/page.tsx`), loading skeleton for `NeedsAttention`, `Cached` pill in `CompetitorPricingGrid`, and replaced all generic `Sparkles`/`Bot` AI icons across 8 UI components with `MessageSquare` action triggers and a branded PaySight `P` `AssistantAvatar`.
- **Report**: Added comprehensive [`FINAL_READINESS_REPORT.md`](./FINAL_READINESS_REPORT.md).

