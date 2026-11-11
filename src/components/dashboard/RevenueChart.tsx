"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { RevenueDataPoint, DateRangeOption } from "@/types";
import { format, parseISO } from "date-fns";
import { TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import { formatMoney } from "./StatusBadge";

interface RevenueChartProps {
  data: RevenueDataPoint[];
  loading: boolean;
  dateRange: DateRangeOption;
  currency?: string;
  onDateRangeChange: (range: DateRangeOption) => void;
  onExplainTrend?: () => void;
}

const RANGES: { label: string; value: DateRangeOption }[] = [
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "90 Days", value: "90d" },
];

function formatTick(date: string): string {
  try {
    return format(parseISO(date), "MMM d");
  } catch {
    return date;
  }
}

function formatYAxis(value: number) {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

function computeWindowTrendPct(data: RevenueDataPoint[]): number | null {
  if (data.length < 4) return null;
  const mid = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, mid).reduce((s, d) => s + d.revenue, 0);
  const secondHalf = data.slice(mid).reduce((s, d) => s + d.revenue, 0);
  if (firstHalf <= 0) return null;
  return parseFloat((((secondHalf - firstHalf) / firstHalf) * 100).toFixed(1));
}

export function RevenueChart({
  data,
  loading,
  dateRange,
  currency = "USD",
  onDateRangeChange,
  onExplainTrend,
}: RevenueChartProps) {
  const tickInterval = dateRange === "90d" ? 6 : dateRange === "30d" ? 4 : 0;
  const activeCurrency = data[0]?.currency || currency || "USD";
  const totalPeriodRevenue = data.reduce((acc, curr) => acc + curr.revenue, 0);
  const totalTxCount = data.reduce((acc, curr) => acc + curr.transactions, 0);
  const trendPct = computeWindowTrendPct(data);

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E5E5] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#626262]">
              Settlement Velocity ({activeCurrency})
            </span>

            {trendPct !== null ? (
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded border ${
                  trendPct >= 0
                    ? "text-[#15803D] bg-[#ECFDF3] border-[#BBF7D0]"
                    : "text-[#B91C1C] bg-[#FEF2F2] border-[#FECACA]"
                }`}
                title="Second half vs. first half revenue in selected window"
              >
                {trendPct >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span>
                  {trendPct >= 0 ? "+" : ""}
                  {trendPct}% half-over-half
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#626262] bg-[#F7F7F8] px-2 py-0.5 rounded border border-[#E5E5E5]">
                <Minus className="w-3 h-3" />
                <span>{totalTxCount} orders in {dateRange}</span>
              </span>
            )}
          </div>

          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-[#171717] tabular-nums font-mono">
              {formatMoney(totalPeriodRevenue, activeCurrency, 2)}
            </span>
            <span className="text-xs text-[#626262]">
              completed gross volume ({dateRange} • {activeCurrency})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onExplainTrend && (
            <button
              type="button"
              onClick={onExplainTrend}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#C2410C] bg-[#FFF3EB] hover:bg-[#FFE7D6] border border-[#FED7AA] transition-colors shadow-xs"
              title="Open PaySight Copilot to explain this settlement trend"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#C2410C]" />
              <span>Explain this trend</span>
            </button>
          )}

          <div className="inline-flex items-center p-1 bg-[#F7F7F8] rounded-lg border border-[#E5E5E5] text-xs">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => onDateRangeChange(r.value)}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  dateRange === r.value
                    ? "bg-white text-[#171717] border border-[#E5E5E5] shadow-xs font-semibold"
                    : "text-[#626262] hover:text-[#171717]"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-56 bg-[#F7F7F8] rounded-lg animate-pulse" />
      ) : totalPeriodRevenue === 0 ? (
        <div className="h-56 bg-[#F7F7F8] rounded-lg border border-[#E5E5E5] flex items-center justify-center text-xs text-[#626262]">
          No completed {activeCurrency} settlements recorded in the last {dateRange}.
        </div>
      ) : (
        <div className="h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="paysightOrangeGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C2410C" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#C2410C" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatTick}
                tick={{ fill: "#626262", fontSize: 11 }}
                interval={tickInterval}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fill: "#626262", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "#E5E5E5",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                  color: "#171717",
                  fontSize: 12,
                }}
                formatter={(value: unknown, name: unknown) => [
                  name === "revenue" && typeof value === "number"
                    ? formatMoney(value, activeCurrency, 2)
                    : String(value ?? 0),
                  name === "revenue" ? `Daily Revenue (${activeCurrency})` : "Transactions",
                ]}
                labelFormatter={(label) => `Date: ${formatTick(String(label))}`}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#C2410C"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#paysightOrangeGlow)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
