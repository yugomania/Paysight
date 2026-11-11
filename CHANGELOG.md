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

