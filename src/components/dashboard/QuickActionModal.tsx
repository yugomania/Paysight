"use client";

import { useCallback, useEffect, useState } from "react";
import {
  X,
  CheckCircle2,
  FileText,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-react";
import type { Invoice, InvoiceItem } from "@/types";
import { formatMoney } from "./StatusBadge";

interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvoiceCreated?: (invoice: Invoice) => void;
}

type ModalStage = "EDIT" | "PREVIEW" | "SUCCESS";

function defaultDueDate(): string {
  return new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
}

export function QuickActionModal({
  isOpen,
  onClose,
  onInvoiceCreated,
}: QuickActionModalProps) {
  const [stage, setStage] = useState<ModalStage>("EDIT");
  const [recipientName, setRecipientName] = useState("Acme Global Partners");
  const [recipientEmail, setRecipientEmail] = useState("finance@acmepartners.com");
  const [currency, setCurrency] = useState("USD");
  const [items, setItems] = useState<InvoiceItem[]>([
    { name: "SaaS Intelligence License", quantity: 1, unitAmount: 1250.0 },
  ]);
  const [note, setNote] = useState("Quarterly PaySight Merchant Suite access");
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [autoSend, setAutoSend] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmationToken, setConfirmationToken] = useState("");

  const resetModalState = useCallback(() => {
    setStage("EDIT");
    setRecipientName("Acme Global Partners");
    setRecipientEmail("finance@acmepartners.com");
    setCurrency("USD");
    setItems([{ name: "SaaS Intelligence License", quantity: 1, unitAmount: 1250.0 }]);
    setNote("Quarterly PaySight Merchant Suite access");
    setDueDate(defaultDueDate());
    setAutoSend(false);
    setCreatedInvoice(null);
    setErrorMessage("");
    setConfirmationToken("");
  }, []);

  const handleClose = useCallback(() => {
    resetModalState();
    onClose();
  }, [resetModalState, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const totalAmount = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitAmount) || 0),
    0
  );

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const handleProceedToPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!recipientEmail || !recipientEmail.includes("@")) {
      setErrorMessage("Please enter a valid recipient email address.");
      return;
    }
    if (!recipientName.trim()) {
      setErrorMessage("Recipient name is required.");
      return;
    }
    if (items.length === 0 || totalAmount <= 0) {
      setErrorMessage("At least one valid line item with positive total is required.");
      return;
    }

    setIsValidating(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "validate_proposal",
          recipientName: recipientName.trim(),
          recipientEmail: recipientEmail.trim(),
          items,
          currency,
          note,
          dueDate,
        }),
      });

      const proposal = await res.json();
      if (!res.ok) {
        throw new Error(proposal.error || "Unable to validate invoice proposal");
      }
      if (!proposal.isValid || !proposal.confirmationToken) {
        setErrorMessage(
          `Validation failed: ${proposal.missingFields?.join(", ") || "Invalid invoice fields"}`
        );
        return;
      }

      setConfirmationToken(proposal.confirmationToken);
      setStage("PREVIEW");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to generate server invoice preview"
      );
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmAndCreate = async () => {
    if (!confirmationToken) {
      setErrorMessage("Missing confirmation token. Please re-validate the preview.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: recipientName.trim(),
          recipientEmail: recipientEmail.trim(),
          items,
          currency,
          note,
          dueDate,
          autoSend,
          confirmationToken,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error || !data.invoice) {
        throw new Error(data.error || "Failed to create invoice");
      }

      setCreatedInvoice(data.invoice);
      onInvoiceCreated?.(data.invoice);
      setStage("SUCCESS");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to create invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Prepare PayPal Invoice"
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white border border-[#E5E5E5] rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F7F7F8] border border-[#E5E5E5] text-[#171717] flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#171717]">
                {stage === "EDIT"
                  ? "Prepare PayPal Invoice"
                  : stage === "PREVIEW"
                  ? "Confirm Invoice Details"
                  : "Invoice Created"}
              </h3>
              <p className="text-xs text-[#626262]">
                {stage === "EDIT"
                  ? "Step 1 of 2: Enter customer, currency, and line items"
                  : stage === "PREVIEW"
                  ? "Step 2 of 2: Review preview bound by SHA-256 confirmation token"
                  : createdInvoice?.source === "paypal_sandbox"
                  ? "Created in PayPal Sandbox & local ledger"
                  : "Created in Demo Mode local ledger"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-[#626262] hover:text-[#171717] p-1.5 rounded-lg hover:bg-[#F7F7F8] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] flex items-center gap-2 text-xs text-[#B91C1C]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="overflow-y-auto">
          {stage === "EDIT" && (
            <form onSubmit={handleProceedToPreview} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#171717]">
                    Recipient Customer / Business Name
                  </label>
                  <input
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full bg-white border border-[#E5E5E5] rounded-lg px-3 py-2 text-xs text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#FFF3EB] focus:border-[#C2410C]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#171717]">
                    Recipient Billing Email
                  </label>
                  <input
                    type="email"
                    required
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full bg-white border border-[#E5E5E5] rounded-lg px-3 py-2 text-xs text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#FFF3EB] focus:border-[#C2410C]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#171717]">Line Items</span>
                  <button
                    type="button"
                    onClick={() =>
                      setItems((prev) => [...prev, { name: "", quantity: 1, unitAmount: 50 }])
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C2410C] hover:underline"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Item</span>
                  </button>
                </div>

                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      required
                      placeholder="Item / service..."
                      value={item.name}
                      onChange={(e) => updateItem(idx, { name: e.target.value })}
                      className="col-span-6 bg-white border border-[#E5E5E5] rounded-lg px-2.5 py-1.5 text-xs text-[#171717]"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={item.unitAmount}
                      onChange={(e) =>
                        updateItem(idx, { unitAmount: parseFloat(e.target.value) || 0 })
                      }
                      className="col-span-3 bg-white border border-[#E5E5E5] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#171717]"
                    />
                    <input
                      type="number"
                      min="1"
                      required
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(idx, { quantity: parseInt(e.target.value, 10) || 1 })
                      }
                      className="col-span-2 bg-white border border-[#E5E5E5] rounded-lg px-2 py-1.5 text-xs font-mono text-[#171717]"
                    />
                    <div className="col-span-1 flex justify-end">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setItems((prev) => prev.filter((_, i) => i !== idx))
                          }
                          aria-label="Remove item"
                          className="p-1 text-[#626262] hover:text-[#B91C1C]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#171717]">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-white border border-[#E5E5E5] rounded-lg px-2.5 py-2 text-xs font-mono text-[#171717]"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="CAD">CAD</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#171717]">Due Date</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-white border border-[#E5E5E5] rounded-lg px-2.5 py-2 text-xs font-mono text-[#171717]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#171717]">Total</label>
                  <div className="w-full bg-[#F7F7F8] border border-[#E5E5E5] rounded-lg px-2.5 py-2 text-xs font-mono font-bold text-[#171717]">
                    {formatMoney(totalAmount, currency)}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#171717]">
                  Merchant Notes &amp; Terms
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-white border border-[#E5E5E5] rounded-lg px-3 py-2 text-xs text-[#171717] resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs text-[#626262]">Next: Review server-verified preview</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 bg-white hover:bg-[#F7F7F8] text-[#171717] rounded-lg text-xs font-medium border border-[#E5E5E5]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isValidating}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                  >
                    <span>{isValidating ? "Validating…" : "Review Preview"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </form>
          )}

          {stage === "PREVIEW" && (
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-xl bg-[#F7F7F8] border border-[#E5E5E5] space-y-3">
                <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2.5">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#626262]">Billed To</span>
                    <div className="text-xs font-bold text-[#171717]">{recipientName}</div>
                    <div className="text-[11px] text-[#626262] font-mono">{recipientEmail}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-[#626262]">Due Date</span>
                    <div className="text-xs font-semibold text-[#171717]">{dueDate}</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-[#171717]">
                      <span>
                        {it.name} × {it.quantity}
                      </span>
                      <span className="font-mono font-semibold">
                        {formatMoney(it.quantity * it.unitAmount, currency)}
                      </span>
                    </div>
                  ))}
                  {note && <p className="text-[11px] text-[#626262] italic">&ldquo;{note}&rdquo;</p>}
                </div>

                <div className="pt-2 border-t border-[#E5E5E5] flex justify-between items-baseline">
                  <span className="text-xs font-bold text-[#171717]">Total Due ({currency})</span>
                  <span className="text-base font-bold font-mono text-[#C2410C]">
                    {formatMoney(totalAmount, currency)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 p-3 rounded-lg border border-[#E5E5E5] bg-white">
                <span className="text-xs font-semibold text-[#171717]">
                  Action on Confirmation:
                </span>
                <div className="space-y-1.5 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="invoiceAction"
                      checked={!autoSend}
                      onChange={() => setAutoSend(false)}
                      className="accent-[#C2410C]"
                    />
                    <span>
                      <strong>Create as DRAFT</strong> (Recommended — review before emailing)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="invoiceAction"
                      checked={autoSend}
                      onChange={() => setAutoSend(true)}
                      className="accent-[#C2410C]"
                    />
                    <span>
                      <strong>Create and SEND immediately</strong> (Sends invoice to recipient)
                    </span>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmationToken("");
                    setStage("EDIT");
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#F7F7F8] text-[#171717] rounded-lg text-xs font-medium border border-[#E5E5E5]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Edit Details</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmAndCreate}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating…</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Confirm &amp; Create Invoice</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {stage === "SUCCESS" && createdInvoice && (
            <div className="p-6 flex flex-col items-center text-center space-y-3.5">
              <CheckCircle2 className="w-12 h-12 text-[#15803D]" />
              <h4 className="text-base font-bold text-[#171717]">
                {createdInvoice.source === "paypal_sandbox"
                  ? "Invoice Created in PayPal Sandbox"
                  : "Invoice Created in Demo Store"}
              </h4>

              <div className="w-full p-4 rounded-xl bg-[#F7F7F8] border border-[#E5E5E5] space-y-2 text-left text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#626262]">Invoice Identifier:</span>
                  <span className="font-mono font-bold text-[#171717]">{createdInvoice.id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#626262]">Invoice Number:</span>
                  <span className="font-mono font-semibold text-[#171717]">
                    {createdInvoice.invoiceNumber}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#626262]">Amount:</span>
                  <span className="font-mono font-bold text-[#171717]">
                    {formatMoney(createdInvoice.amount, createdInvoice.currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#626262]">Status:</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-white text-[#171717] border-[#E5E5E5]">
                    {createdInvoice.status}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#626262]">Recipient:</span>
                  <span className="font-mono text-[#171717]">{createdInvoice.recipientEmail}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 px-4 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                Return to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
