import { NextRequest } from "next/server";
import {
  listInvoicesWithMeta,
  createInvoice,
  prepareInvoiceProposal,
  sendDraftInvoice,
  cancelExistingInvoice,
} from "@/lib/paypal/api";
import { hasValidPayPalConfig } from "@/lib/paypal/client";
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitExceededResponse,
} from "@/lib/security/rate-limit";

export async function GET() {
  try {
    const result = await listInvoicesWithMeta();
    return Response.json({
      invoices: result.invoices,
      isLive: result.isLive,
      dataSource: result.dataSource,
      note: result.note,
    });
  } catch (err) {
    console.error("[/api/invoices] GET error:", err);
    return Response.json({ error: "Failed to list invoices" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit({
    key: `invoices-post:${getClientIdentifier(req)}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return rateLimitExceededResponse(rl);
  }

  try {
    const body = await req.json();

    if (body.action === "validate_proposal") {
      const proposal = prepareInvoiceProposal(body);
      return Response.json(proposal);
    }

    if (!hasValidPayPalConfig()) {
      return Response.json(
        {
          error:
            "PayPal Sandbox credentials (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET) are not configured in .env.local.",
        },
        { status: 503 }
      );
    }

    if (body.action === "send_draft") {
      const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId.trim() : "";
      if (!invoiceId) {
        return Response.json({ error: "invoiceId is required to send draft" }, { status: 400 });
      }
      const updated = await sendDraftInvoice(invoiceId);
      return Response.json({ success: true, invoice: updated });
    }

    if (body.action === "cancel_invoice") {
      const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId.trim() : "";
      if (!invoiceId) {
        return Response.json({ error: "invoiceId is required to cancel invoice" }, { status: 400 });
      }
      const updated = await cancelExistingInvoice(invoiceId);
      return Response.json({ success: true, invoice: updated });
    }

    // Require explicit preview confirmation token on HTTP invoice creation
    const confirmationToken =
      typeof body.confirmationToken === "string" ? body.confirmationToken.trim() : "";
    if (!confirmationToken) {
      return Response.json(
        {
          error:
            "Missing confirmationToken: validate the invoice proposal and review the exact preview before creating.",
        },
        { status: 400 }
      );
    }

    const newInvoice = await createInvoice({
      recipientName: body.recipientName,
      recipientEmail: body.recipientEmail,
      items: body.items,
      currency: body.currency || "USD",
      note: body.note,
      dueDate: body.dueDate,
      autoSend: Boolean(body.autoSend),
      confirmationToken,
    });

    return Response.json({
      success: true,
      invoice: newInvoice,
    });
  } catch (err) {
    console.error("[/api/invoices] POST error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to process invoice action" },
      { status: 400 }
    );
  }
}
