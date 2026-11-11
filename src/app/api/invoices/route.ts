import { NextRequest } from "next/server";
import {
  listInvoices,
  createInvoice,
  prepareInvoiceProposal,
  sendDraftInvoice,
  cancelExistingInvoice,
} from "@/lib/paypal/api";
import { hasValidPayPalConfig } from "@/lib/paypal/client";

export async function GET() {
  try {
    const invoices = await listInvoices();
    const isLive = hasValidPayPalConfig();
    return Response.json({
      invoices,
      isLive,
      dataSource: isLive ? "paypal_sandbox" : "demo_sample",
    });
  } catch (err) {
    console.error("[/api/invoices] GET error:", err);
    return Response.json({ error: "Failed to list invoices" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === "validate_proposal") {
      const proposal = prepareInvoiceProposal(body);
      return Response.json(proposal);
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
