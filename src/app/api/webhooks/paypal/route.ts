import { NextRequest } from "next/server";
import {
  getStoredInvoiceById,
  isEventProcessed,
  markEventProcessed,
  markReconciled,
  saveInvoice,
  saveTransaction,
} from "@/lib/db";
import { verifyWebhookSignatureDetailed } from "@/lib/paypal/client";
import type { Invoice, InvoiceItem, Transaction } from "@/types";

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource?: Record<string, unknown>;
}

function parseWebhookItems(rawItems: unknown): InvoiceItem[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((item): InvoiceItem | null => {
      const i = (item ?? {}) as Record<string, unknown>;
      const unitObj = (i.unit_amount ?? {}) as Record<string, unknown>;
      const quantity = parseInt(String(i.quantity ?? "1"), 10);
      const unitAmount = parseFloat(String(unitObj.value ?? "0"));
      const name = typeof i.name === "string" ? i.name.trim() : "";
      if (!name || !Number.isFinite(quantity) || quantity <= 0) return null;
      return {
        name,
        quantity,
        unitAmount: Number.isFinite(unitAmount) ? unitAmount : 0,
        description: typeof i.description === "string" ? i.description : undefined,
      };
    })
    .filter((item): item is InvoiceItem => item !== null);
}

function mapWebhookInvoiceStatus(
  eventType: string,
  existingStatus?: Invoice["status"]
): Invoice["status"] {
  if (eventType === "INVOICING.INVOICE.PAID") return "PAID";
  if (eventType === "INVOICING.INVOICE.REFUNDED") return "REFUNDED";
  if (eventType === "INVOICING.INVOICE.CANCELLED") {
    return existingStatus === "PAID" ? "PAID" : "CANCELLED";
  }
  if (eventType === "INVOICING.INVOICE.SENT") {
    if (existingStatus === "PAID" || existingStatus === "REFUNDED") {
      return existingStatus;
    }
    return "SENT";
  }
  return existingStatus ?? "DRAFT";
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // 1. Fail closed if required PayPal transmission headers are missing
    const transmissionId = req.headers.get("paypal-transmission-id")?.trim() ?? "";
    const transmissionTime = req.headers.get("paypal-transmission-time")?.trim() ?? "";
    const certUrl = req.headers.get("paypal-cert-url")?.trim() ?? "";
    const authAlgo = req.headers.get("paypal-auth-algo")?.trim() ?? "";
    const transmissionSig = req.headers.get("paypal-transmission-sig")?.trim() ?? "";
    const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();

    const verification = await verifyWebhookSignatureDetailed({
      transmissionId,
      transmissionTime,
      certUrl,
      authAlgo,
      transmissionSig,
      webhookId,
      rawBody,
    });

    if (!verification.verified) {
      if (verification.reason === "missing_config") {
        return Response.json(
          { error: "Webhook verification is not configured on the server" },
          { status: 503 }
        );
      }
      if (verification.reason === "invalid_payload") {
        return Response.json({ error: "Invalid webhook JSON payload" }, { status: 400 });
      }
      return Response.json(
        { error: "Invalid or missing PayPal webhook signature" },
        { status: 401 }
      );
    }

    // 2. Parse & validate incoming event structure
    let event: Partial<PayPalWebhookEvent>;
    try {
      event = JSON.parse(rawBody) as Partial<PayPalWebhookEvent>;
    } catch {
      return Response.json({ error: "Invalid webhook JSON payload" }, { status: 400 });
    }

    const eventId = typeof event.id === "string" ? event.id.trim() : "";
    const eventType = typeof event.event_type === "string" ? event.event_type.trim() : "";

    if (!eventId || !eventType) {
      return Response.json(
        { error: "Missing required event identifier or event_type" },
        { status: 400 }
      );
    }

    if (event.resource !== undefined && (typeof event.resource !== "object" || event.resource === null || Array.isArray(event.resource))) {
      return Response.json({ error: "Invalid webhook resource object" }, { status: 400 });
    }

    // 3. Idempotency: skip already processed webhook events
    if (isEventProcessed(eventId)) {
      return Response.json({ received: true, status: "duplicate_skipped" });
    }

    const resource = (event.resource ?? {}) as Record<string, unknown>;
    const amountObj = (resource.amount ?? {}) as Record<string, unknown>;
    const breakdown = (resource.seller_receivable_breakdown ?? {}) as Record<string, unknown>;
    const feeObj = (breakdown.paypal_fee ?? {}) as Record<string, unknown>;

    switch (eventType) {
      case "PAYMENT.CAPTURE.COMPLETED": {
        const captureId =
          typeof resource.id === "string" && resource.id.trim()
            ? resource.id.trim()
            : `CAP-${eventId}`;
        const amountVal = Math.abs(parseFloat(String(amountObj.value ?? "0")) || 0);
        const feeVal = Math.abs(parseFloat(String(feeObj.value ?? "0")) || 0);
        const netVal = parseFloat((amountVal - feeVal).toFixed(2));
        const currency =
          typeof amountObj.currency_code === "string" && amountObj.currency_code.trim()
            ? amountObj.currency_code.trim().toUpperCase()
            : "USD";

        const txn: Transaction = {
          id: captureId,
          date:
            typeof resource.create_time === "string" && resource.create_time
              ? resource.create_time
              : new Date().toISOString(),
          amount: amountVal,
          fee: feeVal,
          net: netVal,
          currency,
          status: "COMPLETED",
          customerName: "PayPal Buyer",
          customerEmail: "sandbox-customer@paypal.com",
          productName: "PayPal Webhook Captured Order",
          paymentMethod: "paypal",
          source: "paypal_sandbox",
          note: `Webhook verified capture (${eventId})`,
        };

        saveTransaction(txn);
        markReconciled(captureId);
        break;
      }

      case "PAYMENT.CAPTURE.DENIED": {
        const captureId =
          typeof resource.id === "string" && resource.id.trim()
            ? resource.id.trim()
            : `CAP-${eventId}`;
        const amountVal = Math.abs(parseFloat(String(amountObj.value ?? "0")) || 0);
        const currency =
          typeof amountObj.currency_code === "string" && amountObj.currency_code.trim()
            ? amountObj.currency_code.trim().toUpperCase()
            : "USD";

        const txn: Transaction = {
          id: captureId,
          date:
            typeof resource.create_time === "string" && resource.create_time
              ? resource.create_time
              : new Date().toISOString(),
          amount: amountVal,
          fee: 0,
          net: 0,
          currency,
          status: "DENIED",
          customerName: "PayPal Buyer",
          customerEmail: "sandbox-customer@paypal.com",
          productName: "Denied Order",
          paymentMethod: "paypal",
          source: "paypal_sandbox",
          note: `Webhook verified denial (${eventId})`,
        };
        saveTransaction(txn);
        break;
      }

      case "PAYMENT.CAPTURE.REFUNDED": {
        const refundId =
          typeof resource.id === "string" && resource.id.trim()
            ? resource.id.trim()
            : `REF-${eventId}`;
        const refundAmount = Math.abs(parseFloat(String(amountObj.value ?? "0")) || 0);
        const currency =
          typeof amountObj.currency_code === "string" && amountObj.currency_code.trim()
            ? amountObj.currency_code.trim().toUpperCase()
            : "USD";

        const txn: Transaction = {
          id: refundId,
          date:
            typeof resource.create_time === "string" && resource.create_time
              ? resource.create_time
              : new Date().toISOString(),
          amount: refundAmount,
          fee: 0,
          net: -refundAmount,
          currency,
          status: "REFUNDED",
          customerName: "Refund Recipient",
          customerEmail: "sandbox-customer@paypal.com",
          productName: "Refund Event",
          paymentMethod: "paypal",
          source: "paypal_sandbox",
          note: `Webhook verified refund (${eventId})`,
        };
        saveTransaction(txn);
        break;
      }

      case "INVOICING.INVOICE.PAID":
      case "INVOICING.INVOICE.CANCELLED":
      case "INVOICING.INVOICE.SENT":
      case "INVOICING.INVOICE.REFUNDED": {
        const invoiceResource = (resource.invoice ?? resource) as Record<string, unknown>;
        const invoiceId =
          typeof invoiceResource.id === "string" ? invoiceResource.id.trim() : "";

        if (invoiceId) {
          const existing = getStoredInvoiceById(invoiceId);
          const detail = (invoiceResource.detail ?? {}) as Record<string, unknown>;
          const paymentTerm = (detail.payment_term ?? {}) as Record<string, unknown>;
          const metadata = (detail.metadata ?? {}) as Record<string, unknown>;
          const recipients = Array.isArray(invoiceResource.primary_recipients)
            ? (invoiceResource.primary_recipients as Array<Record<string, unknown>>)
            : [];
          const billingInfo = (recipients[0]?.billing_info ?? {}) as Record<string, unknown>;
          const recipientNameObj = (billingInfo.name ?? {}) as Record<string, unknown>;
          const invAmountObj = (invoiceResource.amount ?? amountObj) as Record<string, unknown>;
          const parsedAmount = parseFloat(String(invAmountObj.value ?? "NaN"));
          const webhookItems = parseWebhookItems(invoiceResource.items);

          const inv: Invoice = {
            id: invoiceId,
            invoiceNumber:
              (typeof detail.invoice_number === "string" && detail.invoice_number.trim()) ||
              existing?.invoiceNumber ||
              invoiceId,
            recipientName:
              (typeof recipientNameObj.full_name === "string" &&
                recipientNameObj.full_name.trim()) ||
              existing?.recipientName ||
              "Customer",
            recipientEmail:
              (typeof billingInfo.email_address === "string" &&
                billingInfo.email_address.trim()) ||
              existing?.recipientEmail ||
              "",
            amount:
              Number.isFinite(parsedAmount) && parsedAmount > 0
                ? parsedAmount
                : existing?.amount ?? 0,
            currency:
              (typeof detail.currency_code === "string" && detail.currency_code.trim()) ||
              existing?.currency ||
              "USD",
            status: mapWebhookInvoiceStatus(eventType, existing?.status),
            dueDate:
              (typeof paymentTerm.due_date === "string" && paymentTerm.due_date.trim()) ||
              existing?.dueDate ||
              "",
            createdDate:
              (typeof detail.invoice_date === "string" && detail.invoice_date.trim()) ||
              existing?.createdDate ||
              new Date().toISOString(),
            // Preserve existing line items unless webhook explicitly carries non-empty items
            items: webhookItems.length > 0 ? webhookItems : existing?.items ?? [],
            note:
              (typeof detail.note === "string" && detail.note.trim()) || existing?.note,
            paymentUrl:
              (typeof metadata.recipient_view_url === "string" &&
                metadata.recipient_view_url.trim()) ||
              existing?.paymentUrl,
            source: existing?.source ?? "paypal_sandbox",
          };
          saveInvoice(inv);
        }
        break;
      }

      default:
        break;
    }

    markEventProcessed(eventId);
    return Response.json({ received: true, eventId, eventType });
  } catch (err) {
    console.error(
      "[/api/webhooks/paypal] error:",
      err instanceof Error ? err.message : "Unknown webhook processing error"
    );
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
