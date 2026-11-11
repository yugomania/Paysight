# SECURITY.md — PaySight Security Architecture & Limitations

## 1. Security Model & Scope

PaySight is currently designed as a **single-merchant local / hackathon workspace** running against PayPal Sandbox credentials, Channel3, and Gemini APIs. Review the security controls and explicit limitations below before any public deployment.

---

## 2. Implemented Security Controls

1. **Secret Management & `.gitignore`**:
   - Environment secrets (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `GOOGLE_GENERATIVE_AI_API_KEY`, `CHANNEL3_API_KEY`) live only in `.env.local` (gitignored) and are read strictly in server-side Node modules (`src/lib/`, `src/app/api/`).
   - Error handlers in `/api/orders/create` and elsewhere never echo secret values back to the browser.
   - `NEXT_PUBLIC_PAYPAL_CLIENT_ID` is intentionally public per PayPal's browser JS SDK contract.
2. **Server-Authoritative Checkout Pricing**:
   - `/api/orders/create` and `captureServerSideOrder()` resolve amounts and currencies strictly server-side from `SANDBOX_PRODUCTS` (`src/lib/paypal/catalog.ts`), ignoring any client-supplied totals and verifying captured amount, currency, and `COMPLETED` status against the order's `customId`.
3. **Fail-Closed PayPal Webhook Verification (`/api/webhooks/paypal`)**:
   - Rejects requests missing any of the 5 `paypal-transmission-*` / `paypal-cert-url` / `paypal-auth-algo` headers (`401`).
   - Fails closed (`503`) if `PAYPAL_WEBHOOK_ID` or PayPal server credentials are missing.
   - Enforces `https:` protocol and `*.paypal.com` domain on `certUrl` and validates cryptographic verification via PayPal's `/v1/notifications/verify-webhook-signature` endpoint (`401` on failure).
   - Deduplicates events via `isEventProcessed(eventId)`.
4. **Two-Step Invoice Confirmation Binding**:
   - `prepareInvoiceProposal()` computes a 16-char SHA-256 `confirmationToken` bound to recipient email, currency, total amount, due date, and line items.
   - `POST /api/invoices` requires `confirmationToken` on creation, and `createInvoice()` rejects modified payloads or `autoSend: true` without matching confirmation.
5. **AI Prompt Injection & XSS Defenses**:
   - External untrusted strings (buyer notes, customer names, competitor titles, dispute reasons) pass through `sanitizeUntrustedField()` and are flagged as untrusted data inside `SYSTEM_PROMPT`.
   - `ChatPanel.tsx` renders Markdown using pure React JSX components without `dangerouslySetInnerHTML`, restricting links strictly to `http://` and `https://` URLs.
6. **Concurrent Write Protection & Input Validation**:
   - Database writes use cross-process exclusive `.lock` files + UUID temp-file atomic renames (`src/lib/db/index.ts`).
   - Budget endpoints validate inputs using strict `zod` schemas (`src/app/api/budget/route.ts`).

---

## 3. Known Security Limitations

- **No End-User Authentication or RBAC**: There is currently no user login, session cookie, CSRF token, or multi-tenant isolation. Do **not** deploy PaySight publicly with live PayPal credentials or real customer PII without placing authentication and authorization middleware in front of all routes and API endpoints.
- **No Rate Limiting**: `/api/chat` and `/api/pricing` do not enforce per-IP rate limiting; public exposure could exhaust Gemini or Channel3 API quotas.
- **Process-Local In-Flight Locks**: `captureInFlight` and `invoiceCreationLocks` protect single-instance Node servers only.

---

## 4. Reporting a Vulnerability

If you discover a security issue in this repository, please report it privately to the repository maintainer via GitHub Security Advisories (`https://github.com/yugomania/Paysight/security`) rather than opening a public issue with exploit details.

