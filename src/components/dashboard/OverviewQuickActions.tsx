"use client";

import { MessageSquare, Plus, Radar, Receipt } from "lucide-react";

interface OverviewQuickActionsProps {
  onOpenInvoiceModal: () => void;
  onNavigateToPricing: () => void;
  onNavigateToCheckout: () => void;
  onOpenChat: () => void;
}

export function OverviewQuickActions({
  onOpenInvoiceModal,
  onNavigateToPricing,
  onNavigateToCheckout,
  onOpenChat,
}: OverviewQuickActionsProps) {
  const actions = [
    {
      title: "Create Invoice",
      description: "Prepare and preview a verified PayPal Sandbox invoice",
      icon: Plus,
      onClick: onOpenInvoiceModal,
      isPrimary: true,
    },
    {
      title: "Compare Market Pricing",
      description: "Check your products against multi-retailer Channel3 listings",
      icon: Radar,
      onClick: onNavigateToPricing,
      isPrimary: false,
    },
    {
      title: "Sandbox Checkout",
      description: "Execute buyer popup approval and server-verified PayPal capture flows",
      icon: Receipt,
      onClick: onNavigateToCheckout,
      isPrimary: false,
    },
    {
      title: "Ask PaySight Copilot",
      description: "Ask questions about payment volume, trends, or draft invoices",
      icon: MessageSquare,
      onClick: onOpenChat,
      isPrimary: false,
    },
  ];

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#626262]">
          Quick Actions
        </span>
        <span className="text-xs text-[#626262]">What would you like to do next?</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.title}
              type="button"
              onClick={act.onClick}
              className={`p-3.5 rounded-lg border text-left transition-all flex flex-col justify-between group focus:outline-none focus:ring-1 focus:ring-[#C2410C] ${
                act.isPrimary
                  ? "bg-[#FFF3EB] border-[#FED7AA] hover:bg-[#FFE7D6]"
                  : "bg-white border-[#E5E5E5] hover:bg-[#F7F7F8] hover:border-[#D4D4D4]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-7 h-7 rounded-md flex items-center justify-center ${
                    act.isPrimary
                      ? "bg-[#C2410C] text-white"
                      : "bg-[#F7F7F8] text-[#171717] border border-[#E5E5E5] group-hover:bg-[#111111] group-hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span
                  className={`text-[11px] font-semibold ${
                    act.isPrimary ? "text-[#C2410C]" : "text-[#626262] group-hover:text-[#171717]"
                  }`}
                >
                  Action &rarr;
                </span>
              </div>
              <div>
                <div className="text-xs font-semibold text-[#171717]">{act.title}</div>
                <div className="text-[11px] text-[#626262] mt-0.5 leading-snug">{act.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
