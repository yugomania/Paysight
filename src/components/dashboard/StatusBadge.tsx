"use client";

import {
  ModuleRegistry,
  AllCommunityModule,
  ValidationModule,
  provideGlobalGridOptions,
} from "ag-grid-community";
import type { Transaction } from "@/types";

let agGridRegistered = false;

export function ensureAgGridRegistered(): void {
  if (agGridRegistered) return;
  ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);
  provideGlobalGridOptions({ theme: "legacy" });
  agGridRegistered = true;
}

export function formatMoney(amount: number, currency = "USD", decimals = 2): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "USD").toUpperCase(),
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    return `${amount.toFixed(decimals)} ${currency}`;
  }
}

export function TransactionStatusBadge({ status }: { status: Transaction["status"] | string }) {
  const configs: Record<string, { label: string; dot: string; badge: string }> = {
    COMPLETED: {
      label: "Completed",
      dot: "bg-[#15803D]",
      badge: "bg-[#ECFDF3] text-[#15803D] border-[#BBF7D0]",
    },
    PENDING: {
      label: "Pending",
      dot: "bg-[#B45309]",
      badge: "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]",
    },
    FAILED: {
      label: "Failed",
      dot: "bg-[#B91C1C]",
      badge: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
    },
    REFUNDED: {
      label: "Refunded",
      dot: "bg-[#626262]",
      badge: "bg-[#F7F7F8] text-[#171717] border-[#E5E5E5]",
    },
    DENIED: {
      label: "Denied",
      dot: "bg-[#B91C1C]",
      badge: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
    },
  };

  const current = configs[status] ?? {
    label: status || "Unknown",
    dot: "bg-[#626262]",
    badge: "bg-[#F7F7F8] text-[#171717] border-[#E5E5E5]",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${current.badge}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
      <span>{current.label}</span>
    </span>
  );
}

