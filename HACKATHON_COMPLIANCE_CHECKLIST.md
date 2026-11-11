# PaySight — PayPal AI Hackathon 2026 Compliance Checklist

> Evaluation checklist aligned with `https://paypalaihackathon.devpost.com/rules`. Each item reflects verified repository evidence only.

| # | Requirement | Status | Verification Evidence / Action Needed |
|---|---|---|---|
| 1 | **Meaningful PayPal Developer Platform integration** | **VERIFIED (Code & Build)** | Integrates PayPal Transaction Search v1 (30d chunked/paginated), Orders v2 + JS SDK `PayPalButtons` popup capture, Invoicing v2 (create/send/cancel/list), Customer Disputes v1, and `/api/webhooks/paypal` cryptographic verification (`src/lib/paypal/`, `src/app/api/`). Live Sandbox API execution must be demonstrated with active Sandbox credentials during demo/judging. |
| 2 | **Meaningful AI integration** | **VERIFIED (Code, Tests & Live API)** | Integrates Google Gemini (`@ai-sdk/google` + `ai@4.3.19`) with 9 server-grounded tools (`summarizePayments`, `getTransactions`, `getRevenueTrend`, `getBudgetIntelligence`, `compareProductPricing`, `prepareInvoiceProposalTool`, `createInvoiceTool`, `getInvoices`, `getDisputes`), Gemini 3.x `thoughtSignature` preservation & active model failover, prompt-injection sanitization, tool-call UI badges, and deterministic offline fallback (`src/lib/ai/orchestrator.ts`). Verified live across all 6 core merchant queries against `.env.local`. |
| 3 | **Functional prototype / demo** | **VERIFIED (Build, Tests, Live APIs; Browser QA Manual)** | `npx tsc --noEmit`, `npm run lint`, `npm test` (40/40 isolated tests), `npm run build`, `POST /v1/search` Channel3 live comparisons, and live PayPal Sandbox Orders/Disputes verified. Interactive browser rendering/popup flow requires manual check (`BLOCKED` automatically due to absent browser binary/display on headless host). |
| 4 | **Public open-source GitHub repository** | **NOT VERIFIED** | Local branch `hackathon/finalization` created off `main`; remote repo `https://github.com/yugomania/Paysight` exists, but final commits on `hackathon/finalization` / `main` must be pushed and verified publicly visible. |
| 5 | **Appropriate open-source license** | **VERIFIED** | MIT License present in [`LICENSE`](./LICENSE). |
| 6 | **Complete setup & reproducible run instructions** | **VERIFIED** | [`README.md`](./README.md), [`.env.example`](./.env.example), [`HACKATHON_TESTING_GUIDE.md`](./HACKATHON_TESTING_GUIDE.md), and [`ARCHITECTURE.md`](./ARCHITECTURE.md) document Demo Mode, Sandbox Mode, and all scripts accurately. |
| 7 | **Clear project description** | **VERIFIED** | Provided in [`HACKATHON_PROJECT_DESCRIPTION.md`](./HACKATHON_PROJECT_DESCRIPTION.md) and [`README.md`](./README.md). |
| 8 | **AI tool & code disclosure** | **VERIFIED** | Documentation and code disclose Google Gemini (`@ai-sdk/google`), Channel3, PayPal SDKs, Demo vs. Sandbox separation, and simulated fallbacks transparently. |
| 9 | **Public YouTube demonstration video** | **NOT VERIFIED** | Must be recorded using [`HACKATHON_DEMO_SCRIPT.md`](./HACKATHON_DEMO_SCRIPT.md) and uploaded publicly to YouTube prior to Devpost submission. |
| 10 | **Video duration under 3 minutes** | **NOT VERIFIED** | Scripted for 2m 55s in [`HACKATHON_DEMO_SCRIPT.md`](./HACKATHON_DEMO_SCRIPT.md); verify exact final recording duration after export. |
| 11 | **Original work & IP compliance** | **NOT VERIFIED (Author Attestation Required)** | Uses MIT/open-source npm libraries (`package.json`) with custom PaySight application code; final IP/originality attestation belongs to the submitting author(s). |
| 12 | **Existing project progress disclosure** | **VERIFIED** | Commit history (`main` + `hackathon/finalization`) and [`CHANGELOG.md`](./CHANGELOG.md) clearly document baseline vs. hackathon finalization upgrades. |

