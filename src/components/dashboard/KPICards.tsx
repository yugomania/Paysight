"use client";

import {
  DollarSign,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Activity,
} from "lucide-react";
import type { MerchantKPIs } from "@/types";
import { formatMoney } from "./StatusBadge";

interface KPICardsProps {
  kpis: MerchantKPIs | null;
  loading: boolean;
}

export function KPICards({ kpis, loading }: KPICardsProps) {
  const currency = kpis?.currency ?? "USD";
  const hasPrev = Boolean(kpis?.hasPreviousPeriodData);

  const cards = [
    {
      label: `Total Net Volume (${currency})`,
      value: kpis ? formatMoney(kpis.netVolume30d, currency, 2) : "$0.00",
      change: hasPrev
        ? `${kpis!.totalRevenue30dChange >= 0 ? "+" : ""}${kpis!.totalRevenue30dChange.toFixed(1)}%`
        : "Baseline",
      isPositive: !hasPrev || (kpis?.totalRevenue30dChange ?? 0) >= 0,
      timeframe: kpis
        ? `Gross ${formatMoney(kpis.grossVolume30d, currency, 2)} − Fees ${formatMoney(kpis.totalFees30d, currency, 2)}`
        : "Gross minus PayPal fees",
      icon: DollarSign,
    },
    {
      label: `Settled Orders (${currency})`,
      value: kpis ? kpis.transactionCount30d.toLocaleString() : "0",
      change: hasPrev
        ? `${kpis!.transactionCount30dChange >= 0 ? "+" : ""}${kpis!.transactionCount30dChange.toFixed(1)}%`
        : "30d count",
      isPositive: !hasPrev || (kpis?.transactionCount30dChange ?? 0) >= 0,
      timeframe: kpis
        ? `${kpis.refundCount30d} refund(s) (${formatMoney(kpis.refundAmount30d, currency, 2)})`
        : "Completed orders in window",
      icon: ShoppingBag,
    },
    {
      label: `Avg Transaction Size (${currency})`,
      value: kpis ? formatMoney(kpis.averageOrderValue, currency, 2) : "$0.00",
      change: hasPrev
        ? `${kpis!.averageOrderValueChange >= 0 ? "+" : ""}${kpis!.averageOrderValueChange.toFixed(1)}%`
        : "AOV",
      isPositive: !hasPrev || (kpis?.averageOrderValueChange ?? 0) >= 0,
      timeframe: `Completed gross / settled orders (${currency})`,
      icon: Activity,
    },
    {
      label: "Dispute / Risk Rate",
      value: kpis ? `${kpis.disputeRate.toFixed(2)}%` : "0.00%",
      change: `${kpis?.disputeCount ?? 0} open`,
      isPositive: (kpis?.disputeRate ?? 0) === 0,
      timeframe:
        (kpis?.disputeCount ?? 0) > 0
          ? `${kpis?.disputeCount} PayPal dispute(s) active`
          : "No active dispute claims",
      icon: ShieldCheck,
    },
  ];

  const multiCurrencies = kpis
    ? Object.entries(kpis.currencyTotals).filter(([code]) => code !== currency)
    : [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white border border-[#E5E5E5] rounded-xl p-5 flex flex-col justify-between transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#626262]">{card.label}</span>
                <div className="w-8 h-8 rounded-lg bg-[#F7F7F8] border border-[#E5E5E5] flex items-center justify-center text-[#171717] flex-shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-3">
                {loading ? (
                  <div className="h-8 w-28 bg-[#F7F7F8] rounded-lg animate-pulse" />
                ) : (
                  <div className="text-2xl font-bold tracking-tight text-[#171717] tabular-nums font-mono">
                    {card.value}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2 pt-3 border-t border-[#E5E5E5]">
                <div
                  className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded flex-shrink-0 ${
                    card.isPositive
                      ? "bg-[#ECFDF3] text-[#15803D] border border-[#BBF7D0]"
                      : "bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]"
                  }`}
                >
                  {card.isPositive ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  <span>{card.change}</span>
                </div>
                <span className="text-[11px] text-[#626262] truncate" title={card.timeframe}>
                  {card.timeframe}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Secondary Currencies Strip (Never Mixed Into Primary Currency Totals) */}
      {multiCurrencies.length > 0 && (
        <div className="px-3.5 py-2 rounded-lg bg-[#F7F7F8] border border-[#E5E5E5] flex flex-wrap items-center gap-3 text-xs text-[#626262]">
          <span className="font-semibold text-[#171717]">Additional Currencies (Unconverted):</span>
          {multiCurrencies.map(([code, breakdown]) => (
            <span key={code} className="font-mono text-[11px] px-2 py-0.5 rounded bg-white border border-[#E5E5E5] text-[#171717]">
              {code}: Gross {formatMoney(breakdown.gross, code, 2)} • Net{" "}
              {formatMoney(breakdown.net, code, 2)} ({breakdown.count} orders)
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
