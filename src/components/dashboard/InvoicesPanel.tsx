"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle,
  Ban,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Plus,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import type { Invoice } from "@/types";
import { formatMoney } from "./StatusBadge";

interface InvoicesPanelProps {
  invoices: Invoice[];
  externalSearch?: string;
  onOpenNewInvoice: () => void;
  onOpenAiHelp: () => void;
  onInvoiceUpdated: (updated: Invoice) => void;
}

export function InvoicesPanel({
  invoices,
  externalSearch = "",
  onOpenNewInvoice,
  onOpenAiHelp,
  onInvoiceUpdated,
}: InvoicesPanelProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedInvoice) {
        setSelectedInvoice(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedInvoice]);

  const q = externalSearch.trim().toLowerCase();
  const filtered = q
    ? invoices.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.recipientName.toLowerCase().includes(q) ||
          inv.recipientEmail.toLowerCase().includes(q) ||
          inv.status.toLowerCase().includes(q)
      )
    : invoices;

  const handleAction = async (
    invoiceId: string,
    action: "send_draft" | "cancel_invoice"
  ) => {
    setBusyId(invoiceId);
    setErrorMsg("");
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, invoiceId }),
      });
      const data = await res.json();
      if (!res.ok || data.error || !data.invoice) {
        throw new Error(data.error || `Failed to ${action.replace("_", " ")}`);
      }
      onInvoiceUpdated(data.invoice);
      if (selectedInvoice?.id === invoiceId) {
        setSelectedInvoice(data.invoice);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Invoice action failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E5E5] pb-4">
        <div>
          <h2 className="text-base font-bold text-[#171717]">Invoices</h2>
          <p className="text-xs text-[#626262]">
            PayPal Invoicing v2 draft creation, preview confirmation, sending, and status tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenAiHelp}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF3EB] hover:bg-[#FFE7D6] text-[#C2410C] border border-[#FED7AA] rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Help prepare with AI</span>
          </button>
          <button
            type="button"
            onClick={onOpenNewInvoice}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Invoice</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#626262] bg-[#F7F7F8] rounded-xl border border-[#E5E5E5]">
          {q
            ? `No invoices match "${externalSearch}".`
            : "No invoices recorded yet. Click New Invoice to prepare a verified draft."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inv) => {
            const isBusy = busyId === inv.id;
            return (
              <div
                key={inv.id}
                className="p-4 rounded-xl bg-white border border-[#E5E5E5] hover:border-[#D4D4D4] transition-all flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F7F7F8] border border-[#E5E5E5] flex items-center justify-center font-mono text-xs text-[#171717] font-bold">
                    <FileText className="w-4 h-4 text-[#626262]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[#171717]">
                        {inv.recipientName}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#F7F7F8] text-[#626262] border border-[#E5E5E5]">
                        {inv.source === "paypal_live" ? "PayPal Live" : "PayPal Sandbox"}
                      </span>
                    </div>
                    <div className="text-xs text-[#626262] font-mono">
                      {inv.recipientEmail}
                    </div>
                    <div className="text-[11px] text-[#626262] mt-0.5">
                      Invoice #{inv.invoiceNumber || inv.id} •{" "}
                      {inv.items.length} line item(s)
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="text-right mr-1">
                    <div className="font-mono tabular-nums font-bold text-sm text-[#171717]">
                      {formatMoney(inv.amount, inv.currency)}
                    </div>
                    <div className="text-[11px] text-[#626262]">
                      Due {inv.dueDate || "On Receipt"}
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                      inv.status === "PAID"
                        ? "bg-[#ECFDF3] text-[#15803D] border-[#BBF7D0]"
                        : inv.status === "SENT"
                        ? "bg-[#FFF3EB] text-[#C2410C] border-[#FED7AA]"
                        : inv.status === "CANCELLED"
                        ? "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]"
                        : "bg-[#F7F7F8] text-[#171717] border-[#E5E5E5]"
                    }`}
                  >
                    {inv.status}
                  </span>

                  <button
                    type="button"
                    onClick={() => setSelectedInvoice(inv)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#F7F7F8] border border-[#E5E5E5] text-[#171717] font-medium"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Details</span>
                  </button>

                  {inv.status === "DRAFT" && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleAction(inv.id, "send_draft")}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#C2410C] hover:bg-[#9A3412] text-white font-semibold disabled:opacity-50"
                    >
                      {isBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Send</span>
                    </button>
                  )}

                  {(inv.status === "DRAFT" || inv.status === "SENT") && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleAction(inv.id, "cancel_invoice")}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#FEF2F2] text-[#B91C1C] border border-[#E5E5E5] hover:border-[#FECACA] font-medium disabled:opacity-50"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Invoice ${selectedInvoice.invoiceNumber}`}
          onClick={() => setSelectedInvoice(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white border border-[#E5E5E5] rounded-xl shadow-xl overflow-hidden text-xs"
          >
            <div className="px-5 py-3.5 border-b border-[#E5E5E5] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#171717]">
                  Invoice #{selectedInvoice.invoiceNumber || selectedInvoice.id}
                </h3>
                <p className="text-[11px] font-mono text-[#626262]">{selectedInvoice.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                aria-label="Close invoice detail"
                className="p-1.5 rounded-lg text-[#626262] hover:text-[#171717] hover:bg-[#F7F7F8]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3 bg-[#F7F7F8] border border-[#E5E5E5] rounded-lg p-3">
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#626262]">Recipient</div>
                  <div className="font-semibold text-[#171717]">{selectedInvoice.recipientName}</div>
                  <div className="font-mono text-[11px] text-[#626262]">
                    {selectedInvoice.recipientEmail}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-[#626262]">Status / Due</div>
                  <div className="font-bold text-[#171717]">{selectedInvoice.status}</div>
                  <div className="text-[11px] text-[#626262]">
                    Due {selectedInvoice.dueDate || "On Receipt"}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[10px] uppercase font-bold text-[#626262]">Line Items</div>
                {selectedInvoice.items.length === 0 ? (
                  <p className="text-[#626262] italic">No line items recorded.</p>
                ) : (
                  <div className="border border-[#E5E5E5] rounded-lg divide-y divide-[#E5E5E5]">
                    {selectedInvoice.items.map((item, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium text-[#171717]">
                            {item.name} × {item.quantity}
                          </div>
                          {item.description && (
                            <div className="text-[11px] text-[#626262]">{item.description}</div>
                          )}
                        </div>
                        <span className="font-mono font-semibold text-[#171717]">
                          {formatMoney(item.quantity * item.unitAmount, selectedInvoice.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#E5E5E5]">
                <span className="font-bold text-[#171717]">Total</span>
                <span className="text-base font-bold font-mono text-[#C2410C]">
                  {formatMoney(selectedInvoice.amount, selectedInvoice.currency)}
                </span>
              </div>

              {selectedInvoice.paymentUrl && (
                <a
                  href={selectedInvoice.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C2410C] hover:underline"
                >
                  <span>Open Hosted PayPal Invoice Link</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

