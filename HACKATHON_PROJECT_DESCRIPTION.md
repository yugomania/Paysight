# PaySight — Hackathon Project Description

## The Merchant Problem

Small and mid-sized online merchants using PayPal face three everyday operational bottlenecks:
1. **Fragmented settlement visibility**: Gross order totals rarely match bank deposits once PayPal fees, refunds, disputes, and multiple currencies enter the picture—forcing merchants to export CSVs or switch across separate PayPal views.
2. **Pricing & margin blindness**: Setting SKU prices without real retail competitor context leads to underpricing (leaving margin on the table) or overpricing, while operating expenses (inventory, marketing, fulfillment) sit detached from PayPal cash inflows.
3. **Manual invoicing & AI trust risks**: Creating customer invoices takes multiple steps across dashboards, and generic LLM chatbots cannot be trusted to add currency totals accurately or email customers without deterministic guardrails.

---

## PaySight's Solution

**PaySight** (`v2.0` UI) brings **PayPal payment analytics**, **two-step confirmed PayPal invoicing**, **Channel3 competitive price intelligence**, **monthly merchant budget planning**, and a **tool-grounded Google Gemini copilot** into one cohesive Next.js web workspace.

Every financial number displayed by the dashboard or cited by PaySight Copilot is computed deterministically on the server—never guessed by an LLM—and PaySight enforces strict live-only fail-closed operation (`HTTP 503` when credentials are absent) as well as strict separation between unconverted currencies (`USD`, `EUR`, etc.).

---

## Target Audience

- Independent digital merchants and D2C brands collecting payments via PayPal Checkout and PayPal Invoicing
- Small-business operators monitoring monthly revenue targets, PayPal processing fees, and non-PayPal operating expenses
- Finance and operations leads who need fast, verifiable answers on failed/pending orders and competitive SKU pricing

---

## Core Technical Integrations

### 1. PayPal Developer Platform Integration
- **Transaction Search API v1 (REST + OAuth2)**: Chunked (`<= 30`-day windows) and paginated retrieval across 7d/30d/60d/90d horizons with deduplication, automatic stale OAuth token revocation/retry on `401`/`403` (`invalidatePayPalAuth`), explicit partial-data warnings, and accurate fee/net math.
- **Orders v2 & JS Checkout SDK (`@paypal/react-paypal-js`)**: Buyer-approved popup checkout (`PayPalSandboxCheckout`) for 4 server-authoritative SKUs (`SANDBOX_PRODUCTS`: `starter_10`, `sub_pro`, `intel_add`, `exp_pack`), failing closed (`503`) if unconfigured and validating captured amount, currency, and `COMPLETED` status against the PayPal order's `customId`.
- **Invoicing API v2**: Multi-item draft/send/cancel lifecycle featuring SHA-256 `confirmationToken` binding between preview and execution (`prepareInvoiceProposal` -> `createInvoice`) plus `sendDraftInvoice` and `cancelExistingInvoice`.
- **Customer Disputes API v1**: Honest live dispute retrieval (`disputeRate` and `Needs Attention` alerts) without fabricated dispute records.
- **Fail-Closed Webhooks (`/api/webhooks/paypal`)**: Verifies all 5 PayPal transmission headers, `PAYPAL_WEBHOOK_ID`, HTTPS PayPal certificate URLs, and cryptographic signatures via `/v1/notifications/verify-webhook-signature`, with event-ID idempotency and invoice line-item preservation.

### 2. Grounded AI Integration (Google Gemini + Vercel AI SDK)
- Powered by `@ai-sdk/google` (`gemini-3.5-flash` / `gemini-3-flash-preview` / `gemini-3.5-flash-lite` failover with Gemini 3.x `thoughtSignature` preservation) and Vercel AI SDK `ai@4.3.19` (`streamText`, `convertToCoreMessages`).
- Wired to **9 backend tools** (`summarizePayments`, `getTransactions`, `getRevenueTrend`, `getBudgetIntelligence`, `compareProductPricing`, `prepareInvoiceProposalTool`, `createInvoiceTool`, `getInvoices`, `getDisputes`) with prompt-injection sanitization for untrusted external text, tool-status UI indicators, safe JSX Markdown rendering, and fail-closed HTTP `503` enforcement when `GOOGLE_GENERATIVE_AI_API_KEY` is absent.

### 3. Channel3 Market Intelligence
- Queries `POST https://api.trychannel3.com/v1/search` (with nested `offers[]` parsing and a 15-minute bounded cache), classifies exact vs. approximate matches, computes market floor/average/ceiling and merchant price variance, and fails closed (`HTTP 503` / `channel3_unavailable`) when unconfigured without fabricating competitor prices.

### 4. Merchant Budget Intelligence
- Tracks monthly sales targets and operating expense budgets per currency alongside PayPal gross volume, PayPal fees, net PayPal proceeds, refunds, 7-category manual operating expenses, estimated operating cash flow, month-over-month deltas, and pacing alerts.

---

## Differentiation & Impact

- **Server-Calculated Grounding**: Unlike generic AI chat wrappers, PaySight binds its AI assistant to the exact server calculation functions used by its KPI cards and budget ledger.
- **Two-Step Cryptographic Confirmation**: Both the UI modal and AI copilot require SHA-256 confirmation-token validation over exact invoice line items, recipient, due date, and currency before submitting or emailing via PayPal.
- **Zero-Mock Live Parity**: Evaluators configure PayPal Sandbox, Gemini, and Channel3 keys via `.env.local` for full live execution against `api-m.sandbox.paypal.com`, failing closed cleanly whenever any upstream key is missing or returns an error.

