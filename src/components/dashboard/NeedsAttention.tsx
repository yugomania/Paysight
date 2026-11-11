"use client";

import type { Dispute, Invoice } from "@/types";
import { ShieldAlert, FileWarning, CheckCircle2, ArrowRight, Info } from "lucide-react";

interface NeedsAttentionProps {
  disputes: Dispute[];
  invoices: Invoice[];
  isLiveConnected: boolean;
  loading?: boolean;
  onNavigateToDisputes: () => void;
  onNavigateToInvoices: () => void;
}

export function NeedsAttention({
  disputes,
  invoices,
  isLiveConnected,
  loading = false,
  onNavigateToDisputes,
  onNavigateToInvoices,
}: NeedsAttentionProps) {
  // Overdue invoices: DRAFT or SENT where due date is before today
  const todayStr = new Date().toISOString().split("T")[0];
  const overdueInvoices = invoices.filter(
    (inv) =>
      inv.status !== "PAID" &&
      inv.status !== "CANCELLED" &&
      inv.status !== "REFUNDED" &&
      inv.dueDate &&
      inv.dueDate < todayStr
  );

  const openDisputes = disputes.filter(
    (d) => d.status === "OPEN" || d.status === "WAITING_FOR_SELLER" || d.status === "UNDER_REVIEW"
  );

  const hasItems = openDisputes.length > 0 || overdueInvoices.length > 0;

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#626262]">
            Needs Attention
          </span>
          {hasItems && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]">
              {openDisputes.length + overdueInvoices.length} Action{openDisputes.length + overdueInvoices.length > 1 ? "s" : ""} Required
            </span>
          )}
        </div>
        <span className="text-xs text-[#626262]">PayPal Sandbox &amp; Store Ledger</span>
      </div>

      {loading ? (
        <div className="h-12 rounded-lg bg-[#F7F7F8] animate-pulse border border-[#E5E5E5]" />
      ) : hasItems ? (
        <div className="space-y-2.5">
          {/* Dispute Action Item */}
          {openDisputes.length > 0 && (
            <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-md bg-white text-[#B91C1C] border border-[#FECACA] flex items-center justify-center flex-shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-[#171717]">
                    {openDisputes.length} Open PayPal Dispute{openDisputes.length > 1 ? "s" : ""}
                  </div>
                  <div className="text-[11px] text-[#626262]">
                    Requires seller response. Open dispute total:{" "}
                    <strong>
                      ${openDisputes.reduce((sum, d) => sum + d.amount, 0).toFixed(2)} USD
                    </strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onNavigateToDisputes}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-[#F7F7F8] text-[#B91C1C] border border-[#FECACA] font-semibold text-xs transition-colors flex-shrink-0"
              >
                <span>Review disputes</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Overdue Invoice Action Item */}
          {overdueInvoices.length > 0 && (
            <div className="p-3.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-md bg-white text-[#B45309] border border-[#FDE68A] flex items-center justify-center flex-shrink-0">
                  <FileWarning className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-[#171717]">
                    {overdueInvoices.length} Overdue or Pending Invoice{overdueInvoices.length > 1 ? "s" : ""}
                  </div>
                  <div className="text-[11px] text-[#626262]">
                    Unsettled past due date. Total outstanding:{" "}
                    <strong>
                      ${overdueInvoices.reduce((sum, i) => sum + i.amount, 0).toFixed(2)} USD
                    </strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onNavigateToInvoices}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-[#F7F7F8] text-[#B45309] border border-[#FDE68A] font-semibold text-xs transition-colors flex-shrink-0"
              >
                <span>View invoices</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Reassuring All-Clear State */
        <div className="p-3.5 rounded-lg bg-[#F7F7F8] border border-[#E5E5E5] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#15803D] flex-shrink-0" />
            <div>
              <span className="font-semibold text-[#171717]">All clear: </span>
              <span className="text-[#626262]">
                No open dispute cases, chargeback claims, or overdue invoices currently require merchant action.
              </span>
            </div>
          </div>
          {!isLiveConnected && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-[#626262] font-mono">
              <Info className="w-3.5 h-3.5" />
              PayPal Disconnected
            </span>
          )}
        </div>
      )}
    </div>
  );
}
