# PaySight — AI-Powered PayPal Merchant Analytics, Budgeting & Market Intelligence

**PaySight** (`paysight` `v0.1.0` / UI `v2.0`) is an open-source merchant operations command center built for PayPal business users with Next.js 16, React 19, TypeScript, AG Grid, Recharts, PayPal Sandbox APIs, Channel3 Market Intelligence, and Google Gemini.

---

## Problem Statement & Target Audience

Digital and e-commerce merchants running on PayPal frequently juggle separate dashboards to reconcile gross vs. net settlements after fees and refunds, compare product pricing across competing retailers, manually track operating expenses against monthly revenue targets, and create/send customer invoices safely.

PaySight serves **PayPal merchants, digital sellers, and finance operators** who want one transparent workspace where financial calculations run deterministically on the server and an AI copilot explains verified figures without inventing totals or triggering unconfirmed financial actions.

---

## Product Overview & Core Features

1. **PayPal Analytics & Settlement KPIs**:
   - Server-calculated 30-day **Net Volume**, **Gross Volume**, **PayPal Fees**, **Settled Orders**, **Average Order Value (AOV)**, **Refunds**, and **Dispute Rate** with strict currency separation (`USD`, `EUR`, etc. are never summed together) and an Overview currency selector.
   - Multi-currency summary strip for unconverted secondary currencies.
   - `7 Days` / `30 Days` / `90 Days` **Settlement Velocity** chart (`Recharts`) with computed half-over-half window trend badges.
   - **Needs Attention** banner surfacing open PayPal disputes and past-due unpaid invoices.
2. **Transaction Explorer & Reconciliation**:
   - Chunked (`<= 30`-day windows) and paginated PayPal Transaction Search integration (`src/lib/paypal/api.ts`) with deduplication.
   - Searchable, filterable (`All`, `Completed`, `Pending`, `Exceptions`), sortable AG Grid table with row-click Settlement Detail modal and CSV export.
3. **Two-Step Confirmed PayPal Invoicing (v2)**:
   - Interactive composer supporting multi-line items, currency selection, SHA-256 `confirmationToken` binding between preview and submission, in-flight duplicate locking, `DRAFT` creation by default, and post-creation **Send**, **Cancel**, and **Inspect Detail** actions.
4. **Merchant Budget Intelligence**:
   - Monthly sales targets and operating expense budgets per currency (`src/lib/budget/service.ts`, `/api/budget`).
   - Separates **PayPal Gross Sales**, **PayPal Processing Fees**, **Net PayPal Proceeds**, **Refunds**, and **Merchant-Recorded Operating Expenses** across 7 categories (`inventory`, `marketing`, `software`, `shipping`, `operations`, `taxes`, `other`), computing **Estimated Operating Cash Flow**, month-over-month comparisons, and budget alerts.
5. **Channel3 Competitor Price Radar**:
   - Multi-retailer price search (`POST https://api.trychannel3.com/v1/search`) with nested offer mapping, 15-minute bounded caching (and explicit `Cached` drilldown pill), exact vs. approximate match separation, floor/average/ceiling benchmarks, price position difference, and explicit `Channel3 Live` vs. `Demo Catalog Fallback` source badges. Live failures never fabricate prices.
6. **Sandbox Checkout Terminal**:
   - Server-authoritative 4-SKU catalog (`demo_10` `$10`, `sub_pro` `$49`, `intel_add` `$29`, `exp_pack` `$19`).
   - Uses official `@paypal/react-paypal-js` popup approval + server capture verification in **PayPal Sandbox Mode**, and provides an explicit local simulation button in **Demo Mode**.
7. **Fail-Closed PayPal Webhook Receiver (`/api/webhooks/paypal`)**:
   - Enforces PayPal transmission headers + `PAYPAL_WEBHOOK_ID` + HTTPS PayPal certificate URL + PayPal REST signature verification before accepting events (`PAYMENT.CAPTURE.*`, `INVOICING.INVOICE.*`), deduplicates by event ID, and preserves existing invoice line items across status webhooks.
8. **Grounded AI Merchant Copilot (`Cmd+J` / `Ask PaySight`)**:
   - Google Gemini (`@ai-sdk/google` + Vercel AI SDK `ai@4.3.19`) wired to 9 server-side read/budget/pricing/invoicing tools with prompt-injection sanitization, tool invocation status pills, safe JSX Markdown rendering, and deterministic offline Markdown fallback tools.

---

## Architecture & Technology Stack

- **Framework**: Next.js `16.4.2` (App Router, Turbopack), React `19.3.0`, TypeScript `5` (`strict: true`)
- **UI & Visualization**: Tailwind CSS `4`, AG Grid Community `36.2.0` (`theme="legacy"`), Recharts `3.10.1`, Lucide React
- **PayPal Integration**: `@paypal/paypal-server-sdk` `2.5.0`, `@paypal/react-paypal-js` `10.6.0`, plus PayPal REST v2/v1 (`fetch` + cached OAuth2)
- **AI & Validation**: Vercel AI SDK `ai` `4.3.19`, `@ai-sdk/google` `1.2.22`, `zod` `3.25.76`
- **Market Intelligence**: Channel3 REST API v1 (`api.trychannel3.com`)
- **Persistence**: File-locked atomic JSON persistence (`.data/paysight-db.json` via `src/lib/db/index.ts`, abstracted behind `StoreRepository`)

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for full Mermaid architecture, sequence, and workflow diagrams.

---

## Demo Mode vs. PayPal Sandbox Mode

| Mode | Trigger Condition | Transactions & Invoices | Checkout Terminal | Channel3 & Gemini |
|---|---|---|---|---|
| **Demo Mode** | `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` omitted or placeholders | Deterministic seeded local records in `.data/paysight-db.json` (`source: "demo_sample"`) | Simulated local capture button (`CAP-SIM-*`, no PayPal popup) | Structured demo catalog (`isSimulated: true`) & local deterministic tool fallback if keys omitted |
| **PayPal Sandbox Mode** | Valid Sandbox `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Live `api-m.sandbox.paypal.com` Search, Invoicing v2, Disputes v1 (`source: "paypal_sandbox"`), isolated from demo seeds | Real PayPal JS SDK buyer login & server-verified order capture | Uses live `CHANNEL3_API_KEY` and `GOOGLE_GENERATIVE_AI_API_KEY` when provided |

---

## Setup & Local Execution

### 1. Prerequisites

- Node.js `20+` (verified on Node `v24.21.0`) and `npm`
- Optional for Sandbox Mode: [PayPal Developer Sandbox App](https://developer.paypal.com/dashboard/applications/sandbox) with **Transaction Search**, **Invoicing**, and **Customer Disputes** enabled
- Optional for live AI & Pricing: [Google AI Studio API Key](https://aistudio.google.com/app/apikey) and [Channel3 API Key](https://trychannel3.com/)

### 2. Installation

```bash
git clone https://github.com/yugomania/Paysight.git
cd Paysight
npm ci
```

### 3. Configure Environment

```bash
cp .env.example .env.local
```

| Variable | Mode / Requirement | Purpose |
|---|---|---|
| `PAYPAL_CLIENT_ID` | Required for Sandbox | PayPal REST/SDK client ID |
| `PAYPAL_CLIENT_SECRET` | Required for Sandbox | PayPal REST/SDK client secret |
| `PAYPAL_ENVIRONMENT` | Default `sandbox` | `"sandbox"` or `"live"` |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Required for live Checkout UI | Browser PayPal JS SDK client ID |
| `PAYPAL_WEBHOOK_ID` | Required for `/api/webhooks/paypal` | Webhook ID configured in PayPal Developer Dashboard |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Optional | Enables live Google Gemini streaming (`streamText`) |
| `GEMINI_MODEL` | Optional (default `gemini-3.5-flash`) | Google Gemini model identifier (automatically fails over past retired models) |
| `CHANNEL3_API_KEY` | Optional | Enables live Channel3 product comparisons |
| `PAYSIGHT_DB_PATH` | Optional | Overrides `.data/paysight-db.json` path (used automatically by tests) |
| `DATABASE_URL` | Deferred / Optional | Reserved for deferred PostgreSQL/Neon adapter (`db/migrations/001_init.sql`) |

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Note on Visual Assets**: No static screenshot PNGs are committed inside the repository yet; open `/` locally or follow [`HACKATHON_DEMO_SCRIPT.md`](./HACKATHON_DEMO_SCRIPT.md) to walk through every live tab.

---

## Testing & Quality Gates

```bash
npm test            # Runs all 8 node:test suites (41 isolated tests)
npm run lint        # ESLint 9 checks
npx tsc --noEmit    # Strict TypeScript check
npm run build       # Production Next.js build (requires internet access for Google Fonts)
```

---

## Deployment

A Render web-service blueprint is defined in [`render.yaml`](./render.yaml):

- **Build command**: `npm ci && npm run build`
- **Start command**: `npm start`
- **Health check**: `GET /api/health` (non-sensitive operational readiness, persistence mode, and integration configuration booleans)
- **Important Persistence Caveat**: On Render's Free plan, the container filesystem is ephemeral; `.data/paysight-db.json` resets across restarts/deploys unless you attach persistent storage or complete the deferred PostgreSQL/Neon adapter ([`db/migrations/001_init.sql`](./db/migrations/001_init.sql), [`src/lib/db/postgres.deferred.ts`](./src/lib/db/postgres.deferred.ts)).

---

## Security Notes & Known Limitations

- **Single-Workspace Prototype (No User Login)**: PaySight currently does not include end-user login/session authentication or multi-tenant isolation. Per-IP sliding-window rate limiting (`src/lib/security/rate-limit.ts`) and baseline HTTP security headers (`next.config.ts`) are active for single-instance hosting, but do not expose a deployment holding real customer/merchant PII publicly without adding authentication and shared storage first. See [`SECURITY.md`](./SECURITY.md).
- **PayPal Sandbox Permissions**: Live Transaction Search and Customer Disputes require explicit feature toggles in your PayPal Sandbox Developer App; if disabled, PaySight discloses the limitation honestly via warning banners.
- **Channel3 Unconfigured Fallback**: When `CHANNEL3_API_KEY` is unset, comparisons return sample/demo reference listings clearly tagged `Demo` (`isSimulated: true`). When `CHANNEL3_API_KEY` is configured and fails or returns empty, PaySight returns `0` listings rather than inventing competitor prices.
- **Standalone Payment Links**: Synthetic PayPal payment links were removed; use PayPal Invoicing v2 (`paymentUrl` generated once sent in Sandbox).

---

## Troubleshooting

- **Offline `npm run build` fails on `Geist` fonts**: `next/font/google` fetches `Geist` and `Geist_Mono` from `fonts.googleapis.com` at build time; ensure outbound HTTPS access or run builds in a connected environment.
- **PayPal Sandbox Transaction Search notice**: Confirm **Transaction Search** is checked under App Features in `developer.paypal.com/dashboard/applications/sandbox`.
- **PayPal Checkout popup blocked**: Allow browser popups for `localhost:3000`, and log in with a PayPal Sandbox **Personal (Buyer)** account rather than your Business merchant account.

---

## Demo Instructions

Follow [`HACKATHON_DEMO_SCRIPT.md`](./HACKATHON_DEMO_SCRIPT.md) for a reproducible <3-minute walkthrough, and [`HACKATHON_TESTING_GUIDE.md`](./HACKATHON_TESTING_GUIDE.md) for verification commands.

---

## License

Licensed under the [MIT License](./LICENSE).
