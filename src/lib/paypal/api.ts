import { createHash } from "crypto";
import { subDays, format } from "date-fns";
import {
  getOrdersController,
  getAccessToken,
  getPayPalBaseUrl,
  hasValidPayPalConfig,
  invalidatePayPalAuth,
} from "./client";
import { extractPayPalSdkError, resolveSandboxProduct } from "./catalog";
import {
  getStoredTransactions,
  saveTransactionsBatch,
  saveTransaction,
  getStoredInvoices,
  getStoredInvoiceById,
  saveInvoice,
  markReconciled,
} from "@/lib/db";
import type {
  CurrencyMetricsBreakdown,
  DataSourceKind,
  Transaction,
  MerchantKPIs,
  RevenueDataPoint,
  Invoice,
  CreateInvoiceInput,
  InvoiceProposal,
  Dispute,
} from "@/types";

// ─── Proposal Hash for Confirmation Binding ─────────────────────────────────

export function generateProposalToken(details: {
  recipientEmail: string;
  totalAmount: number;
  currency: string;
  dueDate: string;
  items: Array<{ name: string; quantity: number; unitAmount: number }>;
}): string {
  const payload = JSON.stringify({
    email: details.recipientEmail.toLowerCase().trim(),
    total: details.totalAmount.toFixed(2),
    currency: details.currency.toUpperCase(),
    dueDate: details.dueDate,
    items: details.items.map((i) => ({
      n: i.name.trim(),
      q: i.quantity,
      u: i.unitAmount.toFixed(2),
    })),
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

// ─── Date Range Chunking & Deduplication Helpers ─────────────────────────────

export interface DateChunk {
  startDate: Date;
  endDate: Date;
}

/**
 * Splits an arbitrary date range into chunks of at most `maxChunkDays` (<= 31 days per PayPal API limits).
 */
export function buildDateChunks(
  startDate: Date,
  endDate: Date,
  maxChunkDays = 30
): DateChunk[] {
  const clampedChunk = Math.max(1, Math.min(31, Math.floor(maxChunkDays)));
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  if (endMs <= startMs) {
    return [{ startDate, endDate }];
  }

  const chunkMs = clampedChunk * 86400000;
  const chunks: DateChunk[] = [];
  let cursor = startMs;

  while (cursor < endMs) {
    const next = Math.min(endMs, cursor + chunkMs);
    chunks.push({
      startDate: new Date(cursor),
      endDate: new Date(next),
    });
    cursor = next;
  }

  return chunks;
}

export function deduplicateTransactions(list: Transaction[]): Transaction[] {
  const byId = new Map<string, Transaction>();
  for (const t of list) {
    if (!t.id) continue;
    if (!byId.has(t.id)) {
      byId.set(t.id, t);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export interface TransactionFetchResult {
  transactions: Transaction[];
  source: DataSourceKind;
  isLive: boolean;
  isPartial: boolean;
  chunksQueried: number;
  dataWarning?: string;
}

const MAX_PAGES_PER_CHUNK = 10;
const PAGE_SIZE = 100;

function toPayPalUtcTimestamp(date: Date): string {
  return date.toISOString().split(".")[0] + "Z";
}

function mapTransactionStatus(raw: string): Transaction["status"] {
  const map: Record<string, Transaction["status"]> = {
    S: "COMPLETED",
    SUCCESS: "COMPLETED",
    COMPLETED: "COMPLETED",
    P: "PENDING",
    PENDING: "PENDING",
    F: "FAILED",
    FAILED: "FAILED",
    R: "REFUNDED",
    REFUNDED: "REFUNDED",
    D: "DENIED",
    DENIED: "DENIED",
    V: "REFUNDED",
    REVERSED: "REFUNDED",
  };
  return map[raw.toUpperCase()] ?? "PENDING";
}

// ─── Transactions List with Chunked Search & Pagination ──────────────────────

export async function fetchTransactionsWithMeta(
  days = 30
): Promise<TransactionFetchResult> {
  const safeDays = Number.isFinite(days) ? Math.max(1, Math.min(365, Math.floor(days))) : 30;
  const cutoff = subDays(new Date(), safeDays).getTime();

  if (!hasValidPayPalConfig()) {
    return {
      transactions: [],
      source: "unconfigured",
      isLive: false,
      isPartial: true,
      chunksQueried: 0,
      dataWarning:
        "PayPal credentials (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET) are not configured in .env.local.",
    };
  }

  let token = await getAccessToken();
  if (!token) {
    return {
      transactions: [],
      source: "paypal_sandbox",
      isLive: false,
      isPartial: true,
      chunksQueried: 0,
      dataWarning:
        "Unable to obtain PayPal OAuth access token. Verify PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.",
    };
  }

  const base = getPayPalBaseUrl();
  const endDate = new Date();
  const startDate = subDays(endDate, safeDays);
  const chunks = buildDateChunks(startDate, endDate, 30);

  const fetched: Transaction[] = [];
  let succeededChunks = 0;
  let isPartial = false;
  let lastErrorMsg = "";
  let didRefreshAuth = false;

  for (const chunk of chunks) {
    let page = 1;
    let chunkDone = false;

    while (!chunkDone && page <= MAX_PAGES_PER_CHUNK) {
      try {
        const qs = new URLSearchParams({
          start_date: toPayPalUtcTimestamp(chunk.startDate),
          end_date: toPayPalUtcTimestamp(chunk.endDate),
          fields: "all",
          page_size: String(PAGE_SIZE),
          page: String(page),
        });

        const res = await fetch(`${base}/v1/reporting/transactions?${qs.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if ((res.status === 401 || res.status === 403) && !didRefreshAuth) {
          didRefreshAuth = true;
          await invalidatePayPalAuth(true);
          const refreshed = await getAccessToken();
          if (refreshed) {
            token = refreshed;
            continue;
          }
        }

        if (!res.ok) {
          const errJson = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          const details = Array.isArray(errJson.details)
            ? (errJson.details as Array<Record<string, string>>)
            : [];
          const msg = details[0]?.issue
            ? `${details[0].issue}: ${details[0].description ?? errJson.message ?? `HTTP ${res.status}`}`
            : typeof errJson.message === "string"
            ? errJson.message
            : `PayPal Transaction Search returned HTTP ${res.status}`;
          lastErrorMsg = msg;
          isPartial = true;
          console.warn("[PayPal] searchTransactions chunk notice:", msg);
          chunkDone = true;
          continue;
        }

        const data = (await res.json()) as Record<string, unknown>;
        const raw = Array.isArray(data.transaction_details)
          ? (data.transaction_details as Array<Record<string, unknown>>)
          : [];
        const totalPages =
          typeof data.total_pages === "number" && data.total_pages > 0 ? data.total_pages : 1;

        for (const t of raw) {
          const info = (t.transaction_info ?? {}) as Record<string, unknown>;
          const payerInfo = (t.payer_info ?? {}) as Record<string, unknown>;
          const cartInfo = (t.cart_info ?? {}) as Record<string, unknown>;
          const itemDetails = Array.isArray(cartInfo.item_details)
            ? (cartInfo.item_details as Array<Record<string, unknown>>)
            : [];
          const itemInfo = itemDetails[0] ?? {};

          const txAmountObj = (info.transaction_amount ?? {}) as Record<string, string>;
          const feeAmountObj = (info.fee_amount ?? {}) as Record<string, string>;
          const payerNameObj = (payerInfo.payer_name ?? {}) as Record<string, string>;

          const rawAmount = parseFloat(txAmountObj.value ?? "0") || 0;
          const rawFee = parseFloat(feeAmountObj.value ?? "0") || 0;
          const absAmount = Math.abs(rawAmount);
          const absFee = Math.abs(rawFee);
          const status = mapTransactionStatus(String(info.transaction_status ?? ""));
          const netVal =
            status === "REFUNDED"
              ? -parseFloat((absAmount - absFee).toFixed(2))
              : status === "FAILED" || status === "DENIED"
              ? 0
              : parseFloat((absAmount - absFee).toFixed(2));

          const fullName =
            payerNameObj.alternate_full_name ||
            [payerNameObj.given_name, payerNameObj.surname].filter(Boolean).join(" ").trim() ||
            "PayPal Customer";

          fetched.push({
            id:
              typeof info.transaction_id === "string" && info.transaction_id
                ? info.transaction_id
                : `TXN-${Date.now()}-${fetched.length}`,
            date:
              typeof info.transaction_initiation_date === "string" &&
              info.transaction_initiation_date
                ? info.transaction_initiation_date
                : new Date().toISOString(),
            amount: absAmount,
            fee: absFee,
            net: netVal,
            currency: String(txAmountObj.currency_code ?? "USD").toUpperCase(),
            status,
            customerName: fullName,
            customerEmail:
              typeof payerInfo.email_address === "string" && payerInfo.email_address
                ? payerInfo.email_address
                : "sandbox-buyer@paypal.com",
            productName:
              typeof itemInfo.item_name === "string" && itemInfo.item_name
                ? itemInfo.item_name
                : "PayPal Payment",
            productSku: typeof itemInfo.item_code === "string" ? itemInfo.item_code : undefined,
            paymentMethod: "paypal",
            invoiceId: typeof info.invoice_id === "string" ? info.invoice_id : undefined,
            note: typeof info.transaction_note === "string" ? info.transaction_note : undefined,
            source: "paypal_sandbox",
          });
        }

        succeededChunks += page === 1 ? 1 : 0;

        if (page >= totalPages || raw.length < PAGE_SIZE) {
          chunkDone = true;
        } else if (page === MAX_PAGES_PER_CHUNK) {
          isPartial = true;
          lastErrorMsg = `Chunk capped at ${MAX_PAGES_PER_CHUNK * PAGE_SIZE} records to preserve PayPal rate limits.`;
          chunkDone = true;
        } else {
          page += 1;
        }
      } catch (err) {
        lastErrorMsg = err instanceof Error ? err.message : "PayPal Transaction Search failed";
        isPartial = true;
        console.warn("[PayPal] searchTransactions chunk notice:", lastErrorMsg);
        chunkDone = true;
      }
    }
  }

  if (fetched.length > 0) {
    saveTransactionsBatch(fetched);
  }

  if (succeededChunks === 0) {
    return {
      transactions: [],
      source: "paypal_sandbox",
      isLive: false,
      isPartial: true,
      chunksQueried: chunks.length,
      dataWarning: `PayPal Transaction Search failed (${lastErrorMsg || "verify Transaction Search permission in PayPal Developer Dashboard"}).`,
    };
  }

  const storedSandboxTxns = getStoredTransactions().filter(
    (t) => t.source === "paypal_sandbox" || t.source === "paypal_live"
  );
  const mergedSandbox = deduplicateTransactions([...fetched, ...storedSandboxTxns]).filter(
    (t) => new Date(t.date).getTime() >= cutoff
  );

  return {
    transactions: mergedSandbox,
    source: "paypal_sandbox",
    isLive: true,
    isPartial,
    chunksQueried: chunks.length,
    dataWarning: isPartial && lastErrorMsg ? lastErrorMsg : undefined,
  };
}

export async function listTransactions(days = 30): Promise<Transaction[]> {
  const res = await fetchTransactionsWithMeta(days);
  return res.transactions;
}

// ─── Authoritative Server-Side KPIs (Strict Currency Separation) ─────────────

export function selectPrimaryCurrency(
  transactions: Transaction[],
  preferredCurrency?: string
): string {
  if (preferredCurrency && preferredCurrency.trim()) {
    return preferredCurrency.trim().toUpperCase();
  }
  const completed = transactions.filter((t) => t.status === "COMPLETED");
  const pool = completed.length > 0 ? completed : transactions;
  if (pool.some((t) => (t.currency || "USD").toUpperCase() === "USD")) {
    return "USD";
  }
  const counts = new Map<string, number>();
  for (const t of pool) {
    const code = (t.currency || "USD").toUpperCase();
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  let topCurrency = "USD";
  let topCount = 0;
  for (const [code, count] of counts.entries()) {
    if (count > topCount) {
      topCurrency = code;
      topCount = count;
    }
  }
  return topCurrency;
}

export function computeCurrencyBreakdown(
  transactions: Transaction[]
): Record<string, CurrencyMetricsBreakdown> {
  const breakdown: Record<string, CurrencyMetricsBreakdown> = {};

  const ensure = (code: string) => {
    if (!breakdown[code]) {
      breakdown[code] = {
        gross: 0,
        fees: 0,
        net: 0,
        count: 0,
        refundCount: 0,
        refundAmount: 0,
      };
    }
    return breakdown[code];
  };

  for (const t of transactions) {
    const code = (t.currency || "USD").toUpperCase();
    if (t.status === "COMPLETED") {
      const entry = ensure(code);
      const fee = Math.abs(t.fee ?? 0);
      entry.gross += t.amount;
      entry.fees += fee;
      entry.net += t.amount - fee;
      entry.count += 1;
    } else if (t.status === "REFUNDED") {
      const entry = ensure(code);
      entry.refundCount += 1;
      entry.refundAmount += t.amount;
    }
  }

  for (const entry of Object.values(breakdown)) {
    entry.gross = parseFloat(entry.gross.toFixed(2));
    entry.fees = parseFloat(entry.fees.toFixed(2));
    entry.net = parseFloat(entry.net.toFixed(2));
    entry.refundAmount = parseFloat(entry.refundAmount.toFixed(2));
  }

  return breakdown;
}

export function computeMerchantKPIs(params: {
  transactions: Transaction[];
  days: number;
  currency?: string;
  source: DataSourceKind;
  disputeCount?: number;
  isPartialData?: boolean;
  dataWarning?: string;
  nowMs?: number;
}): MerchantKPIs {
  const safeDays = Math.max(1, Math.floor(params.days));
  const now = params.nowMs ?? Date.now();
  const currentStart = now - safeDays * 86400000;
  const prevStart = now - safeDays * 2 * 86400000;

  const currentWindow = params.transactions.filter((t) => {
    const time = new Date(t.date).getTime();
    return time >= currentStart && time <= now;
  });

  const previousWindow = params.transactions.filter((t) => {
    const time = new Date(t.date).getTime();
    return time >= prevStart && time < currentStart;
  });

  const currencyTotals = computeCurrencyBreakdown(currentWindow);
  const primaryCurrency = selectPrimaryCurrency(currentWindow, params.currency);

  const completedCurrent = currentWindow.filter(
    (t) =>
      t.status === "COMPLETED" &&
      (t.currency || "USD").toUpperCase() === primaryCurrency
  );
  const completedPrev = previousWindow.filter(
    (t) =>
      t.status === "COMPLETED" &&
      (t.currency || "USD").toUpperCase() === primaryCurrency
  );
  const refundsCurrent = currentWindow.filter(
    (t) =>
      t.status === "REFUNDED" &&
      (t.currency || "USD").toUpperCase() === primaryCurrency
  );

  const totalGrossCurrent = parseFloat(
    completedCurrent.reduce((sum, t) => sum + t.amount, 0).toFixed(2)
  );
  const totalGrossPrev = parseFloat(
    completedPrev.reduce((sum, t) => sum + t.amount, 0).toFixed(2)
  );
  const totalFeesCurrent = parseFloat(
    completedCurrent.reduce((sum, t) => sum + Math.abs(t.fee ?? 0), 0).toFixed(2)
  );
  const netVolumeCurrent = parseFloat((totalGrossCurrent - totalFeesCurrent).toFixed(2));
  const refundAmountCurrent = parseFloat(
    refundsCurrent.reduce((sum, t) => sum + t.amount, 0).toFixed(2)
  );

  const avgCurrent =
    completedCurrent.length > 0
      ? parseFloat((totalGrossCurrent / completedCurrent.length).toFixed(2))
      : 0;
  const avgPrev =
    completedPrev.length > 0
      ? parseFloat((totalGrossPrev / completedPrev.length).toFixed(2))
      : 0;

  const disputeCount = Math.max(0, params.disputeCount ?? 0);
  const disputeRate =
    completedCurrent.length > 0
      ? parseFloat(((disputeCount / completedCurrent.length) * 100).toFixed(2))
      : 0.0;

  const hasPreviousPeriodData = completedPrev.length > 0;
  const pctDelta = (curr: number, prev: number) =>
    prev > 0 ? parseFloat((((curr - prev) / prev) * 100).toFixed(1)) : 0;

  return {
    totalRevenue30d: totalGrossCurrent,
    totalRevenue30dChange: pctDelta(totalGrossCurrent, totalGrossPrev),
    transactionCount30d: completedCurrent.length,
    transactionCount30dChange: pctDelta(completedCurrent.length, completedPrev.length),
    averageOrderValue: avgCurrent,
    averageOrderValueChange: pctDelta(avgCurrent, avgPrev),
    disputeRate,
    disputeRateChange: 0,
    disputeCount,
    currency: primaryCurrency,
    grossVolume30d: totalGrossCurrent,
    netVolume30d: netVolumeCurrent,
    totalFees30d: totalFeesCurrent,
    refundCount30d: refundsCurrent.length,
    refundAmount30d: refundAmountCurrent,
    reportingPeriod: `Last ${safeDays} days`,
    reportingDays: safeDays,
    reportingTimezone: "UTC",
    hasPreviousPeriodData,
    isPartialData: params.isPartialData,
    dataWarning: params.dataWarning,
    source: params.source,
    lastUpdated: new Date().toISOString(),
    currencyTotals,
  };
}

export async function getMerchantKPIs(
  days = 30,
  currencyFilter?: string
): Promise<MerchantKPIs> {
  const safeDays = Number.isFinite(days) ? Math.max(1, Math.min(180, Math.floor(days))) : 30;
  // Single fetch for 2x window avoids parallel duplicate PayPal calls and concurrent DB writes
  const [txMeta, disputeRes] = await Promise.all([
    fetchTransactionsWithMeta(safeDays * 2),
    listDisputes(),
  ]);

  return computeMerchantKPIs({
    transactions: txMeta.transactions,
    days: safeDays,
    currency: currencyFilter,
    source: txMeta.source,
    disputeCount: disputeRes.isLive ? disputeRes.disputes.length : 0,
    isPartialData: txMeta.isPartial,
    dataWarning: txMeta.dataWarning,
  });
}

// ─── Revenue Time Series (Currency-Scoped) ───────────────────────────────────

export async function getRevenueTimeSeries(
  days = 30,
  currency?: string
): Promise<RevenueDataPoint[]> {
  const safeDays = Number.isFinite(days) ? Math.max(1, Math.min(365, Math.floor(days))) : 30;
  const transactions = await listTransactions(safeDays);
  const targetCurrency = selectPrimaryCurrency(transactions, currency);

  const byDate: Record<string, { revenue: number; transactions: number; refunds: number }> = {};

  for (let i = safeDays - 1; i >= 0; i--) {
    const d = format(subDays(new Date(), i), "yyyy-MM-dd");
    byDate[d] = { revenue: 0, transactions: 0, refunds: 0 };
  }

  for (const t of transactions) {
    if ((t.currency || "USD").toUpperCase() !== targetCurrency) continue;
    const d = t.date.split("T")[0];
    if (byDate[d]) {
      if (t.status === "COMPLETED") {
        byDate[d].revenue += t.amount;
        byDate[d].transactions += 1;
      } else if (t.status === "REFUNDED") {
        byDate[d].refunds += t.amount;
      }
    }
  }

  return Object.entries(byDate).map(([date, v]) => ({
    date,
    revenue: parseFloat(v.revenue.toFixed(2)),
    transactions: v.transactions,
    refunds: parseFloat(v.refunds.toFixed(2)),
    currency: targetCurrency,
  }));
}

// ─── Invoicing API v2 ────────────────────────────────────────────────────────

export interface InvoiceListResult {
  invoices: Invoice[];
  isLive: boolean;
  dataSource: DataSourceKind;
  note?: string;
}

export async function listInvoicesWithMeta(): Promise<InvoiceListResult> {
  if (!hasValidPayPalConfig()) {
    return {
      invoices: [],
      isLive: false,
      dataSource: "unconfigured",
      note: "PayPal credentials (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET) are not configured in .env.local.",
    };
  }

  try {
    let token = await getAccessToken();
    if (!token) {
      return {
        invoices: [],
        isLive: false,
        dataSource: "paypal_sandbox",
        note: "Unable to obtain PayPal OAuth access token.",
      };
    }
    const base = getPayPalBaseUrl();

    let res = await fetch(`${base}/v2/invoicing/invoices?page_size=25&page=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401 || res.status === 403) {
      await invalidatePayPalAuth(true);
      token = await getAccessToken();
      if (token) {
        res = await fetch(`${base}/v2/invoicing/invoices?page_size=25&page=1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }

    if (!res.ok) {
      console.warn("[PayPal] listInvoices HTTP:", res.status);
      return {
        invoices: [],
        isLive: false,
        dataSource: "paypal_sandbox",
        note: `PayPal Invoicing API returned HTTP ${res.status}. Verify Invoicing permission on your Sandbox app.`,
      };
    }

    const data = await res.json();
    const liveInvoices: Invoice[] = (data.items ?? []).map(mapInvoice);

    for (const inv of liveInvoices) {
      const existing = getStoredInvoiceById(inv.id);
      saveInvoice({
        ...inv,
        items: inv.items.length > 0 ? inv.items : existing?.items ?? [],
        paymentUrl: inv.paymentUrl || existing?.paymentUrl,
      });
    }

    return {
      invoices: getStoredInvoices().filter((i) => i.source === "paypal_sandbox"),
      isLive: true,
      dataSource: "paypal_sandbox",
    };
  } catch (err) {
    console.warn("[PayPal] listInvoices error:", err);
    return {
      invoices: [],
      isLive: false,
      dataSource: "paypal_sandbox",
      note: "PayPal Invoicing request failed. Check network and PayPal Sandbox credentials.",
    };
  }
}

export async function listInvoices(): Promise<Invoice[]> {
  const res = await listInvoicesWithMeta();
  return res.invoices;
}

// ─── Proposal Validation (AI / UI Two-Step Creation) ─────────────────────────

export function prepareInvoiceProposal(input: Partial<CreateInvoiceInput>): InvoiceProposal {
  const missingFields: string[] = [];
  if (!input.recipientEmail?.trim() || !input.recipientEmail.includes("@")) {
    missingFields.push("recipientEmail");
  }
  if (!input.recipientName?.trim()) {
    missingFields.push("recipientName");
  }
  if (!input.items || input.items.length === 0) {
    missingFields.push("items");
  } else {
    for (const [idx, item] of input.items.entries()) {
      if (!item.name?.trim() || item.quantity <= 0 || item.unitAmount <= 0) {
        missingFields.push(`item[${idx}] (requires name, quantity > 0, unitAmount > 0)`);
      }
    }
  }

  const validItems = (input.items ?? []).filter((i) => i.quantity > 0 && i.unitAmount > 0);
  const totalAmount = validItems.reduce((acc, i) => acc + i.quantity * i.unitAmount, 0);
  const dueDate = input.dueDate || format(subDays(new Date(), -14), "yyyy-MM-dd");
  const currency = (input.currency || "USD").toUpperCase();

  const confirmationToken = generateProposalToken({
    recipientEmail: input.recipientEmail || "",
    totalAmount,
    currency,
    dueDate,
    items: validItems,
  });

  return {
    id: `PROP-${Date.now().toString().slice(-6)}`,
    recipientName: input.recipientName || "Pending Recipient",
    recipientEmail: input.recipientEmail || "",
    items: validItems,
    totalAmount: parseFloat(totalAmount.toFixed(2)),
    currency,
    dueDate,
    note: input.note || "PaySight Merchant Invoice",
    missingFields,
    isValid: missingFields.length === 0,
    confirmationToken,
    status: "PROPOSAL_PENDING_CONFIRMATION",
  };
}

// In-flight operation lock to prevent duplicate creation on double-click
const invoiceCreationLocks = new Set<string>();

export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  // 1. Validate inputs
  const proposal = prepareInvoiceProposal(input);
  if (!proposal.isValid) {
    throw new Error(
      `Invoice validation failed: Missing fields [${proposal.missingFields.join(", ")}]`
    );
  }

  // 1b. Require valid confirmation token if auto-sending or if a token was supplied
  if (input.autoSend && !input.confirmationToken) {
    throw new Error(
      "Explicit preview confirmation token is required before sending an invoice to a customer."
    );
  }
  if (input.confirmationToken && input.confirmationToken !== proposal.confirmationToken) {
    throw new Error(
      "Confirmation token mismatch: invoice details were modified after preview. Please review and confirm again."
    );
  }

  // 2. Idempotency lock based on recipient, currency, total, and first item
  const lockKey = `${input.recipientEmail.toLowerCase().trim()}:${proposal.currency}:${proposal.totalAmount}:${proposal.items[0]?.name}`;
  if (invoiceCreationLocks.has(lockKey)) {
    throw new Error("Duplicate invoice creation in progress. Please wait.");
  }
  invoiceCreationLocks.add(lockKey);

  try {
    // Yield a microtask so overlapping double-clicks/parallel calls hit the in-flight lock
    await Promise.resolve();
    if (!hasValidPayPalConfig()) {
      throw new Error(
        "PayPal Sandbox credentials (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET) are required to create invoices."
      );
    }

    const token = await getAccessToken();
    if (!token) {
      throw new Error(
        "Unable to obtain PayPal OAuth access token. Check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET."
      );
    }

    const base = getPayPalBaseUrl();

    // 3. Build PayPal Invoicing v2 Payload
    const body = {
      detail: {
        invoice_date: format(new Date(), "yyyy-MM-dd"),
        currency_code: proposal.currency,
        note: input.note,
        payment_term: {
          term_type: "DUE_ON_DATE_SPECIFIED",
          due_date: proposal.dueDate,
        },
      },
      invoicer: {
        name: { business_name: "PaySight Merchant Intelligence" },
      },
      primary_recipients: [
        {
          billing_info: {
            name: { full_name: input.recipientName.trim() },
            email_address: input.recipientEmail.trim(),
          },
        },
      ],
      items: proposal.items.map((item) => ({
        name: item.name,
        description: item.description,
        quantity: String(item.quantity),
        unit_amount: {
          currency_code: proposal.currency,
          value: item.unitAmount.toFixed(2),
        },
      })),
    };

    const createRes = await fetch(`${base}/v2/invoicing/invoices`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(body),
    });

    if (!createRes.ok) {
      const errBody = await createRes.text();
      throw new Error(`PayPal Invoicing API error (${createRes.status}): ${errBody}`);
    }

    const created = await createRes.json();
    const invoiceId = created.id ?? created.href?.split("/").pop();
    if (!invoiceId) {
      throw new Error("PayPal Invoicing API returned no invoice identifier.");
    }

    let finalStatus: Invoice["status"] = "DRAFT";
    let paymentUrl: string | undefined = created.detail?.metadata?.recipient_view_url;

    // 4. Send only if explicitly authorized
    if (input.autoSend) {
      const sendRes = await fetch(`${base}/v2/invoicing/invoices/${invoiceId}/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ send_to_recipient: true }),
      });
      if (!sendRes.ok) {
        const sendErr = await sendRes.text();
        // Save the created draft honestly before throwing error
        const draftInvoice: Invoice = {
          id: invoiceId,
          invoiceNumber: created.detail?.invoice_number ?? invoiceId,
          recipientName: input.recipientName.trim(),
          recipientEmail: input.recipientEmail.trim(),
          amount: proposal.totalAmount,
          currency: proposal.currency,
          status: "DRAFT",
          dueDate: proposal.dueDate,
          createdDate: new Date().toISOString(),
          items: proposal.items,
          note: input.note,
          paymentUrl,
          source: "paypal_sandbox",
        };
        saveInvoice(draftInvoice);
        throw new Error(
          `Invoice ${draftInvoice.invoiceNumber} saved as DRAFT, but PayPal send failed (${sendRes.status}): ${sendErr}`
        );
      }

      finalStatus = "SENT";
      const sendData = await sendRes.json().catch(() => ({}));
      if (typeof sendData?.href === "string") {
        paymentUrl = sendData.href;
      }
    }

    const invoice: Invoice = {
      id: invoiceId,
      invoiceNumber: created.detail?.invoice_number ?? invoiceId,
      recipientName: input.recipientName.trim(),
      recipientEmail: input.recipientEmail.trim(),
      amount: proposal.totalAmount,
      currency: proposal.currency,
      status: finalStatus,
      dueDate: proposal.dueDate,
      createdDate: new Date().toISOString(),
      items: proposal.items,
      note: input.note,
      paymentUrl,
      source: "paypal_sandbox",
    };

    saveInvoice(invoice);
    return invoice;
  } finally {
    invoiceCreationLocks.delete(lockKey);
  }
}

export async function sendDraftInvoice(invoiceId: string): Promise<Invoice> {
  const existing = getStoredInvoiceById(invoiceId);
  if (!existing) {
    throw new Error(`Invoice ${invoiceId} not found.`);
  }
  if (existing.status !== "DRAFT") {
    throw new Error(`Only DRAFT invoices can be sent (current status: ${existing.status}).`);
  }

  if (!hasValidPayPalConfig()) {
    throw new Error(
      "PayPal Sandbox credentials (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET) are required to send invoices."
    );
  }

  const token = await getAccessToken();
  if (!token) {
    throw new Error("Unable to authenticate with PayPal to send invoice.");
  }

  const base = getPayPalBaseUrl();
  const sendRes = await fetch(`${base}/v2/invoicing/invoices/${invoiceId}/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ send_to_recipient: true }),
  });

  if (!sendRes.ok) {
    const errText = await sendRes.text();
    throw new Error(`PayPal failed to send invoice (${sendRes.status}): ${errText}`);
  }

  const sendData = await sendRes.json().catch(() => ({}));
  const updated: Invoice = {
    ...existing,
    status: "SENT",
    paymentUrl: typeof sendData?.href === "string" ? sendData.href : existing.paymentUrl,
  };
  saveInvoice(updated);
  return updated;
}

export async function cancelExistingInvoice(invoiceId: string): Promise<Invoice> {
  const existing = getStoredInvoiceById(invoiceId);
  if (!existing) {
    throw new Error(`Invoice ${invoiceId} not found.`);
  }
  if (existing.status === "PAID" || existing.status === "REFUNDED" || existing.status === "CANCELLED") {
    throw new Error(`Cannot cancel invoice with status ${existing.status}.`);
  }

  if (!hasValidPayPalConfig()) {
    throw new Error(
      "PayPal Sandbox credentials (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET) are required to cancel invoices."
    );
  }

  const token = await getAccessToken();
  if (!token) {
    throw new Error("Unable to authenticate with PayPal to cancel invoice.");
  }

  const base = getPayPalBaseUrl();
  const res =
    existing.status === "DRAFT"
      ? await fetch(`${base}/v2/invoicing/invoices/${invoiceId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        })
      : await fetch(`${base}/v2/invoicing/invoices/${invoiceId}/cancel`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subject: "Invoice Cancelled",
            note: "Cancelled via PaySight Merchant Dashboard",
            send_to_invoicer: true,
            send_to_recipient: true,
          }),
        });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`PayPal invoice cancel error (${res.status}): ${errText}`);
  }

  const updated: Invoice = { ...existing, status: "CANCELLED" };
  saveInvoice(updated);
  return updated;
}

function mapInvoice(raw: Record<string, unknown>): Invoice {
  const detail = (raw.detail as Record<string, unknown>) ?? {};
  const metadata = (detail.metadata as Record<string, unknown>) ?? {};
  const recipients = (raw.primary_recipients as Array<Record<string, unknown>>) ?? [];
  const billingInfo = (recipients[0]?.billing_info ?? {}) as Record<string, unknown>;
  const nameObj = (billingInfo.name ?? {}) as Record<string, unknown>;
  const items = (raw.items as Array<Record<string, unknown>>) ?? [];

  return {
    id: (raw.id as string) ?? "",
    invoiceNumber: (detail.invoice_number as string) ?? "",
    recipientName: (nameObj.full_name as string) ?? "Customer",
    recipientEmail: (billingInfo.email_address as string) ?? "",
    amount: parseFloat((raw.amount as Record<string, string>)?.value ?? "0"),
    currency: ((detail.currency_code as string) ?? "USD").toUpperCase(),
    status: mapInvoiceStatus((raw.status as string) ?? ""),
    dueDate: (detail.payment_term as Record<string, string>)?.due_date ?? "",
    createdDate: (detail.invoice_date as string) ?? new Date().toISOString(),
    items: items.map((i) => ({
      name: (i.name as string) ?? "Item",
      quantity: parseInt(String(i.quantity ?? "1"), 10),
      unitAmount: parseFloat((i.unit_amount as Record<string, string>)?.value ?? "0"),
      description: i.description as string | undefined,
    })),
    note: detail.note as string | undefined,
    paymentUrl: metadata.recipient_view_url as string | undefined,
    source: "paypal_sandbox",
  };
}

function mapInvoiceStatus(raw: string): Invoice["status"] {
  const m: Record<string, Invoice["status"]> = {
    DRAFT: "DRAFT",
    SENT: "SENT",
    PAID: "PAID",
    CANCELLED: "CANCELLED",
    MARKED_AS_PAID: "PAID",
    REFUNDED: "REFUNDED",
  };
  return m[raw.toUpperCase()] ?? "DRAFT";
}

// ─── Disputes (Honest reporting: distinguish retrieval vs none) ──────────────

export async function listDisputes(): Promise<{
  disputes: Dispute[];
  isLive: boolean;
  statusMessage: string;
}> {
  if (!hasValidPayPalConfig()) {
    return {
      disputes: [],
      isLive: false,
      statusMessage:
        "PayPal Sandbox credentials not configured. Configure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env.local to query live Sandbox disputes.",
    };
  }

  try {
    const token = await getAccessToken();
    if (!token) {
      return {
        disputes: [],
        isLive: false,
        statusMessage:
          "Unable to obtain PayPal OAuth token. Verify your client ID and secret in .env.local.",
      };
    }

    const base = getPayPalBaseUrl();
    const res = await fetch(`${base}/v1/customer/disputes?page_size=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return {
        disputes: [],
        isLive: false,
        statusMessage: `PayPal Customer Disputes API returned status ${res.status}. Note that Disputes API permissions must be active on your sandbox app.`,
      };
    }

    const data = await res.json();
    const items = (data.items ?? []).map((d: Record<string, unknown>): Dispute => ({
      id: (d.dispute_id as string) ?? "",
      transactionId:
        ((d.disputed_transactions as Array<Record<string, unknown>>)?.[0]
          ?.seller_transaction_id as string) ?? "",
      reason: (d.reason as string) ?? "OTHER",
      status: (d.status as Dispute["status"]) ?? "OPEN",
      amount: parseFloat((d.dispute_amount as Record<string, string>)?.value ?? "0"),
      currency: ((d.dispute_amount as Record<string, string>)?.currency_code ?? "USD").toUpperCase(),
      openedDate: (d.create_time as string) ?? "",
      updatedDate: (d.update_time as string) ?? "",
      buyerName:
        ((d.disputed_transactions as Array<Record<string, unknown>>)?.[0]?.buyer as Record<
          string,
          string
        >)?.name ?? "Customer",
      isLiveVerified: true,
      source: "paypal_sandbox",
    }));

    return {
      disputes: items,
      isLive: true,
      statusMessage:
        items.length === 0
          ? "No open disputes found in your PayPal Sandbox account."
          : `Retrieved ${items.length} dispute(s).`,
    };
  } catch (err) {
    return {
      disputes: [],
      isLive: false,
      statusMessage: `Dispute retrieval failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Server-Side Order Capture & Reconciliation ──────────────────────────────

export async function captureServerSideOrder(
  orderId: string,
  productId?: string
): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
  const requestedProduct = resolveSandboxProduct(productId);
  if (!requestedProduct) {
    return {
      success: false,
      error: `Unknown product catalog identifier "${productId}".`,
    };
  }

  if (!hasValidPayPalConfig()) {
    return {
      success: false,
      error:
        "PayPal Sandbox credentials (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET) are required for server-side order capture.",
    };
  }

  try {
    const ordersController = getOrdersController();
    const response = await ordersController.captureOrder({ id: orderId });

    const result = response.result;
    const purchaseUnit = result.purchaseUnits?.[0];
    const capture = purchaseUnit?.payments?.captures?.[0];

    if (!capture) {
      return { success: false, error: "No capture record in PayPal response" };
    }

    const captureId = capture.id ?? `CAP-${orderId}`;

    // Idempotency: if already stored in ledger, return stored record
    const existing = getStoredTransactions().find((t) => t.id === captureId);
    if (existing) {
      console.info(`[PayPal] Duplicate capture attempt for ${captureId} — returning stored record.`);
      return { success: true, transaction: existing };
    }

    // Prefer PayPal order's authoritative customId if present
    const orderCustomSku = purchaseUnit?.customId;
    const authoritativeProduct =
      (orderCustomSku ? resolveSandboxProduct(orderCustomSku) : null) ?? requestedProduct;

    const amountVal = parseFloat(capture.amount?.value ?? "0");
    const currency = (capture.amount?.currencyCode ?? authoritativeProduct.currency).toUpperCase();

    if (Math.abs(amountVal - authoritativeProduct.numericAmount) > 0.01) {
      return {
        success: false,
        error: `Amount mismatch: captured $${amountVal} ${currency} but expected $${authoritativeProduct.numericAmount} ${authoritativeProduct.currency} for product "${authoritativeProduct.name}". Possible tampering — do not fulfil.`,
      };
    }

    if (currency !== authoritativeProduct.currency) {
      return {
        success: false,
        error: `Currency mismatch: captured ${currency} but expected ${authoritativeProduct.currency}`,
      };
    }

    const feeVal = Math.abs(
      parseFloat(capture.sellerReceivableBreakdown?.paypalFee?.value ?? "0") || 0
    );
    const netVal = parseFloat(
      capture.sellerReceivableBreakdown?.netAmount?.value ??
        String((amountVal - feeVal).toFixed(2))
    );

    const captureStatus = capture.status;
    if (captureStatus !== "COMPLETED") {
      return {
        success: false,
        error: `Capture status is "${captureStatus}" — not COMPLETED. Do not fulfil until status confirms.`,
      };
    }

    const newTxn: Transaction = {
      id: captureId,
      date: capture.createTime ?? new Date().toISOString(),
      amount: amountVal,
      fee: feeVal,
      net: netVal,
      currency,
      status: "COMPLETED",
      customerName: `${result.payer?.name?.givenName ?? "Sandbox"} ${result.payer?.name?.surname ?? "Buyer"}`.trim(),
      customerEmail: result.payer?.emailAddress ?? "sandbox-buyer@paypal.com",
      productName: authoritativeProduct.name,
      productSku: authoritativeProduct.id,
      paymentMethod: "paypal",
      source: "paypal_sandbox",
      note: `[SANDBOX] Verified PayPal capture — Order: ${orderId} | Capture: ${captureId}`,
    };

    saveTransaction(newTxn);
    markReconciled(captureId);
    return { success: true, transaction: newTxn };
  } catch (err) {
    const { message } = extractPayPalSdkError(err, "PayPal capture failed");
    console.error("[PayPal] captureServerSideOrder error:", message);
    return { success: false, error: message };
  }
}
