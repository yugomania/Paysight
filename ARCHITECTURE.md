# ARCHITECTURE.md — PaySight System Architecture

## 1. High-Level Overview

PaySight is structured as a **Next.js App Router Modular Monolith** with strict separation between browser UI (`src/components/`), HTTP route boundaries (`src/app/api/`), pure & external domain services (`src/lib/`), and file-locked persistence (`src/lib/db/`).

```mermaid
flowchart TD
    subgraph Browser["Browser Client (React 19 SPA)"]
        PAGE["DashboardPage (src/app/page.tsx)"]
        NAV["Sidebar & TopCommandBar (Cmd+J, Cmd+K)"]
        OV["Overview (KPICards, RevenueChart, NeedsAttention, RecentTransactions)"]
        TXN["TransactionGrid (AG Grid v36.2 + Detail Modal)"]
        INV["InvoicesPanel & QuickActionModal (2-Step Preview)"]
        BUD["BudgetIntelligencePanel"]
        PRC["CompetitorPricingGrid (Channel3 Radar)"]
        CHK["PayPalDemoCheckout (4 SKUs)"]
        AI_UI["ChatPanel (useChat + Safe JSX Markdown)"]
    end

    subgraph API["Next.js 16 Route Handlers (src/app/api/)"]
        R_TXN["GET /api/transactions"]
        R_ORD_C["GET/POST /api/orders/create"]
        R_ORD_P["POST /api/orders/capture"]
        R_INV["GET/POST /api/invoices"]
        R_DISP["GET /api/disputes"]
        R_PRIC["GET /api/pricing"]
        R_BUD["GET/POST /api/budget"]
        R_WH["POST /api/webhooks/paypal"]
        R_CHAT["POST /api/chat"]
    end

    subgraph Services["Domain Services (src/lib/)"]
        PP_CLI["paypal/client.ts (SDK, OAuth Cache, Webhook Verify)"]
        PP_CAT["paypal/catalog.ts (Authoritative SKUs & Error Parser)"]
        PP_API["paypal/api.ts (Chunked Search, KPIs, Invoices, Capture)"]
        BUD_SVC["budget/service.ts (Targets, Expenses, Cash Flow)"]
        C3_SVC["channel3/client.ts (Search, 15m Cache, Benchmarks)"]
        AI_SVC["ai/orchestrator.ts (9 Grounded Tools + Offline Fallback)"]
        DB["db/index.ts (StoreRepository + Lockfile + Atomic Rename)"]
        FILE[(".data/paysight-db.json")]
    end

    subgraph External["External APIs"]
        PP["PayPal REST & SDK (Sandbox / Production)"]
        C3["Channel3 REST v1 (api.trychannel3.com)"]
        GEM["Google Gemini API"]
    end

    PAGE --> NAV & OV & TXN & INV & BUD & PRC & CHK & AI_UI
    R_TXN & R_INV & R_DISP & R_ORD_P --> PP_API
    R_ORD_C --> PP_CLI & PP_CAT
    R_ORD_P --> PP_CAT
    R_PRIC --> C3_SVC
    R_BUD --> BUD_SVC
    R_CHAT --> AI_SVC
    R_WH --> PP_CLI & DB

    PP_API --> PP_CLI & PP_CAT & DB
    BUD_SVC --> PP_API & DB
    AI_SVC --> PP_API & BUD_SVC & C3_SVC
    DB <--> FILE

    PP_CLI & PP_API --> PP
    C3_SVC --> C3
    AI_SVC --> GEM
```

---

## 2. PayPal Transaction Retrieval & Currency-Safe KPI Flow

```mermaid
sequenceDiagram
    participant UI as Overview / Transactions
    participant API as GET /api/transactions
    participant PPAPI as fetchTransactionsWithMeta
    participant PP as PayPal Transaction Search v1
    participant DB as paysight-db.json

    UI->>API: ?type=kpis&days=30
    API->>PPAPI: Fetch 60d once (current 30d + prior 30d)
    alt PayPal configured
        PPAPI->>PPAPI: buildDateChunks(60d, max=30d) -> 2 chunks
        loop Each 30d chunk, page 1..totalPages
            PPAPI->>PP: searchTransactions(start, end, page, size=100)
            PP-->>PPAPI: transactionDetails[] (absAmount, absFee, net)
        end
        PPAPI->>DB: saveTransactionsBatch(fetched)
        PPAPI-->>API: Sandbox records only (no demo_sample mixing)
    else Demo Mode
        PPAPI->>DB: Read demo_sample transactions
    end
    API->>API: computeMerchantKPIs() scoped to primaryCurrency + listDisputes()
    API-->>UI: Authoritative KPIs + currencyTotals + isPartialData flag
```

---

## 3. Invoice Two-Step Proposal, Creation & Webhook Lifecycle

```mermaid
flowchart LR
    A["1. Draft Form / AI prepareInvoiceProposalTool"] --> B["prepareInvoiceProposal() validates fields"]
    B --> C["SHA-256 confirmationToken over email, currency, total, dueDate, items"]
    C --> D["2. Merchant Previews Exact Breakdown & Chooses DRAFT or SENT"]
    D --> E["3. POST /api/invoices verifies token & acquires invoiceCreationLocks"]
    E --> F{"PayPal Sandbox active?"}
    F -- Yes --> G["POST /v2/invoicing/invoices (Prefer: return=representation)"]
    G --> H{"autoSend == true?"}
    H -- Yes --> I["POST .../send -> returns paymentUrl"]
    H -- No --> J["Status = DRAFT (Send/Cancel later via InvoicesPanel)"]
    F -- No --> K["Save local Demo Mode invoice"]
    I & J & K --> L["saveInvoice() -> .data/paysight-db.json"]
```

### Fail-Closed Webhook Processing (`POST /api/webhooks/paypal`)

1. Extract all 5 required PayPal transmission headers (`paypal-transmission-id`, `paypal-transmission-time`, `paypal-cert-url`, `paypal-auth-algo`, `paypal-transmission-sig`).
2. Verify `PAYPAL_WEBHOOK_ID` and live PayPal config exist (`503` if unconfigured).
3. Enforce HTTPS `*.paypal.com` certificate host and verify signature via PayPal `/v1/notifications/verify-webhook-signature` (`401` on failure).
4. Deduplicate via `isEventProcessed(event.id)`.
5. Merge invoice updates into existing stored records (`getStoredInvoiceById`), preserving line `items` and preventing `SENT` webhooks from downgrading `PAID` status.

---

## 4. Buyer-Approved Checkout Flow

```mermaid
sequenceDiagram
    participant U as Merchant / Buyer
    participant CHK as PayPalDemoCheckout
    participant C as POST /api/orders/create
    participant P as PayPal Popup / Orders v2
    participant CAP as POST /api/orders/capture
    participant DB as paysight-db.json

    U->>CHK: Select SKU (demo_10 / sub_pro / intel_add / exp_pack)
    CHK->>C: { productId }
    C->>C: resolveSandboxProduct(productId) from SANDBOX_PRODUCTS
    alt Live PayPal Sandbox
        C->>P: OrdersController.createOrder(customId=productId, NO_SHIPPING)
        C-->>CHK: { id: orderId, isLive: true }
        U->>P: Approve in PayPal Sandbox popup
        P-->>CHK: onApprove({ orderID })
        CHK->>CAP: { orderId, productId }
        CAP->>P: OrdersController.captureOrder(orderId)
        CAP->>CAP: Verify amount, currency, status == COMPLETED, dedup captureId
        CAP->>DB: saveTransaction + markReconciled
    else Demo Mode Simulation
        C-->>CHK: { id: ORD-DEMO-..., isLive: false }
        CHK->>CAP: { orderId, productId }
        CAP->>DB: Record CAP-SIM-* (source: demo_sample)
    end
```

---

## 5. Grounded AI Tool & Fallback Architecture

```mermaid
flowchart TD
    REQ["POST /api/chat ({ messages })"] --> NORM["normalizeMessagesForStreamText (convertToCoreMessages)"]
    NORM --> CHECK{"GOOGLE_GENERATIVE_AI_API_KEY valid?"}
    CHECK -- Yes --> GEM["streamText(google(GEMINI_MODEL), SYSTEM_PROMPT, 9 paysightTools, maxSteps=5)"]
    GEM --> STREAM{"Emitted text-delta?"}
    STREAM -- Yes --> SSE["Stream text, tool_call, tool_result to ChatPanel"]
    STREAM -- "No (error before text)" --> FB["generateOfflineMarkdown() executes local backend tools"]
    CHECK -- No --> FB
    FB --> SSE
```

Untrusted fields returned by tools (`customer`, `product`, `note`, `retailer`, `title`, `reason`) pass through `sanitizeUntrustedField()` and are bound by explicit system prompt boundaries against indirect prompt injection.

---

## 6. Persistence & Concurrency Design (`src/lib/db/index.ts`)

- **Interface**: `StoreRepository` encapsulates transactions, invoices, processed webhook IDs, reconciled capture IDs, operating expenses, and monthly budget targets so an external SQL store can replace JSON storage without rewriting services.
- **Locking & Atomicity**: `withFileLock()` creates an exclusive `.lock` file (`O_EXCL` / `"wx"`) with stale-lock recovery (`> 5s`) and `Atomics.wait` backoff, then writes to `.tmp.<pid>.<uuid>` before `fs.renameSync`.
- **Corruption Recovery**: Malformed JSON files are copied to `<dbFile>.corrupt.<timestamp>` before re-seeding instead of overwriting silently.

