"use client";

import type { Transaction } from "@/types";
import { format, parseISO } from "date-fns";
import { ArrowRight, Receipt } from "lucide-react";
import { TransactionStatusBadge, formatMoney } from "./StatusBadge";

interface RecentTransactionsProps {
  transactions: Transaction[];
  loading: boolean;
  onViewAll: () => void;
}

export function RecentTransactions({
  transactions,
  loading,
  onViewAll,
}: RecentTransactionsProps) {
  const recent = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden flex flex-col">
      <div className="p-4 border-b border-[#E5E5E5] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#F7F7F8] border border-[#E5E5E5] text-[#171717] flex items-center justify-center">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#171717]">Recent Transactions</h3>
            <p className="text-xs text-[#626262]">Latest 5 records from your active ledger</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#C2410C] hover:bg-[#FFF3EB] border border-transparent hover:border-[#FED7AA] transition-colors"
        >
          <span>View all transactions</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-[#F7F7F8] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#626262] bg-[#F7F7F8]">
          No transactions recorded yet in this interval.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#F7F7F8] text-[#626262] font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Customer</th>
                <th className="py-2.5 px-4 hidden sm:table-cell">Product / Description</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {recent.map((t) => {
                let formattedDate = t.date;
                try {
                  formattedDate = format(parseISO(t.date), "MMM d, HH:mm");
                } catch {
                  formattedDate = t.date;
                }

                return (
                  <tr key={t.id} className="hover:bg-[#F7F7F8]/60 transition-colors">
                    <td className="py-3 px-4 text-[#626262] font-medium whitespace-nowrap">
                      {formattedDate}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#171717]">{t.customerName}</div>
                      <div className="text-[11px] text-[#626262] font-mono">
                        {t.customerEmail}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[#171717] hidden sm:table-cell max-w-xs truncate">
                      {t.productName}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <TransactionStatusBadge status={t.status} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap">
                      <span className="text-[#171717]">
                        {formatMoney(t.amount, t.currency)}
                      </span>
                      <span className="text-[10px] text-[#626262] ml-1">{t.currency}</span>
                      {(t.fee ?? 0) > 0 && (
                        <div className="text-[10px] text-[#626262]">
                          Net: {formatMoney(t.net ?? t.amount - (t.fee ?? 0), t.currency)}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="p-3 border-t border-[#E5E5E5] bg-[#F7F7F8] flex justify-center">
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-semibold text-[#171717] hover:text-[#C2410C] inline-flex items-center gap-1.5 transition-colors"
        >
          <span>Open full ledger with search &amp; CSV export</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
