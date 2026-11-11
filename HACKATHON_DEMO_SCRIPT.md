# PaySight — Hackathon Demo Script (2m 55s)

> **Preparation**: Run `npm run dev` on `http://localhost:3000` with PayPal Sandbox, Channel3, and Gemini credentials configured in `.env.local` (keep a Sandbox Buyer login ready in another tab). Never display `.env.local` on screen during recording.

---

### 0:00–0:20 — Merchant Problem & PaySight Introduction
- **Show**: `Overview` tab (`http://localhost:3000`), highlighting the white workspace, `#111111` sidebar (`Environment` badge at bottom left), and top bar (`Search`, `Ask PaySight`, `New Invoice`).
- **Say**: *"Online PayPal merchants struggle to connect settlement numbers, competitor pricing, customer invoicing, and operating budgets in one place—and generic AI chatbots often hallucinate financial math. PaySight solves this by pairing PayPal APIs, Channel3 market intelligence, and a server-grounded Gemini copilot."*

### 0:20–0:50 — PayPal Analytics & Transaction Insights
- **Show**:
  1. The 4 KPI cards (`Total Net Volume`, `Settled Orders`, `Avg Transaction Size`, `Dispute / Risk Rate`), pointing out explicit currency (`USD`), separated fees, refunds, and any secondary unconverted currency pills.
  2. Switch `Settlement Velocity` between `7 Days`, `30 Days`, and `90 Days` (chunked `<=30d` server retrieval) and show the computed half-over-half trend badge.
  3. Click `Transactions` in the sidebar, toggle the `Exceptions` filter, click one row to show the **Transaction Detail** modal (`Gross`, `PayPal Fee`, `Net Settlement`, `Source`), and point out `Export` CSV.
- **Say**: *"Every KPI is calculated server-side with strict currency separation—PaySight never mixes EUR and USD totals—and fetches up to 90 days cleanly using PayPal-compliant 30-day chunks."*

### 0:50–1:20 — Grounded AI Copilot Financial Analysis
- **Show**: Click `Explain this trend` on the chart or `Ask PaySight` (`Cmd+J`) to open `ChatPanel`. Click `"Summarise my payments for the last 30 days."` and submit.
- **Say**: *"Notice the tool execution badge for `summarizePayments`. PaySight Copilot fetches the exact server KPI numbers—gross volume, fees, net proceeds, and source—without letting the LLM perform its own math."*

### 1:20–1:50 — Channel3 Market Intelligence
- **Show**: Click `Price comparison` in the sidebar. Point out the `Channel3 Live` data-source badge, inspect or run `"Sony WH-1000XM5"` with price `149.99`, click `Compare Item`, and open the drilldown modal showing exact vs. approximate matches, floor/avg/ceiling, price difference, and retailer links.
- **Say**: *"Under Price Comparison, Channel3 benchmarks our SKU against live multi-retailer listings, separating exact from approximate matches."*

### 1:50–2:20 — Two-Step Invoice Creation or Sandbox Checkout
- **Show (Pick either or show briefly back-to-back)**:
  - **Option A (Invoicing)**: Click `New Invoice`, review Step 1 line items, click `Review Preview` to show Step 2's SHA-256-bound preview (`Create as DRAFT`), click `Confirm & Create Invoice`, then open `Invoices` tab to show the new draft with `Send`, `Cancel`, and `Details` controls.
  - **Option B (Sandbox Checkout)**: Open `Sandbox checkout`, select `PaySight Pro Merchant Plan ($49.00)` (or `starter_10` `$10.00`), approve payment in the PayPal Sandbox popup, and show the verified capture card (`Capture ID`, `Fee`, `Net`).
- **Say**: *"Whether collecting payment via PayPal Invoicing v2 or Sandbox Checkout, amounts are verified server-side and bound by confirmation tokens before any transaction commits."*

### 2:20–2:45 — Budget Intelligence & Business Impact
- **Show**: Click `Budget intelligence` in the sidebar. Point out the `PayPal Gross Sales` vs. monthly target bar, separated `PayPal Processing Fees` vs. `Net PayPal Proceeds`, record a quick expense (e.g. `marketing`, `"Q4 Ad Campaign"`, `85.00`), click `Add Expense`, and show `Operating Cash Flow` + alerts updating live; optionally click `Analyze Budget with AI`.
- **Say**: *"Finally, Budget Intelligence puts PayPal net proceeds alongside manual operating expenses, clearly separating PayPal processing fees from business overhead and tracking pacing against monthly targets."*

### 2:45–2:55 — Closing
- **Show**: Return cleanly to `Overview`.
- **Say**: *"PaySight delivers trustworthy, currency-aware merchant analytics, invoicing, market pricing, and budget planning powered by PayPal and Gemini. Thanks for watching!"*

