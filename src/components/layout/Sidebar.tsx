"use client";

import {
  LayoutDashboard,
  Receipt,
  FileText,
  ShieldAlert,
  Radar,
  CreditCard,
  ExternalLink,
  X,
  User,
  Wallet,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";

export type NavTab =
  | "overview"
  | "transactions"
  | "invoices"
  | "pricing"
  | "budget"
  | "disputes"
  | "checkout";

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  disputeCount?: number;
  isOpen?: boolean;
  onClose?: () => void;
  isLiveConnected?: boolean;
}

// ─── Monochrome PaySight "P" Logo ───────────────────────────────────────────

export function PaySightLogo({
  className = "w-7 h-7",
  inverted = true,
}: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <div
      className={`${className} rounded-md flex items-center justify-center font-black text-sm select-none ${
        inverted ? "bg-white text-[#111111]" : "bg-[#111111] text-white"
      }`}
      aria-hidden="true"
    >
      P
    </div>
  );
}

export function Sidebar({
  activeTab,
  onTabChange,
  disputeCount = 0,
  isOpen = false,
  onClose,
  isLiveConnected = false,
}: SidebarProps) {
  const primaryNavItems = [
    { id: "overview" as NavTab, label: "Overview", icon: LayoutDashboard },
    { id: "transactions" as NavTab, label: "Transactions", icon: CreditCard },
    { id: "invoices" as NavTab, label: "Invoices", icon: FileText },
    { id: "budget" as NavTab, label: "Budget intelligence", icon: Wallet, tag: "Planner" },
    { id: "pricing" as NavTab, label: "Price comparison", icon: Radar, tag: "Channel3" },
    {
      id: "disputes" as NavTab,
      label: "Disputes",
      icon: ShieldAlert,
      badge: disputeCount > 0 ? disputeCount : undefined,
    },
  ];

  const secondaryNavItems = [
    { id: "checkout" as NavTab, label: "Sandbox checkout", icon: Receipt },
  ];

  const handleNavClick = (id: NavTab) => {
    onTabChange(id);
    onClose?.();
  };

  const content = (
    <div className="w-64 bg-[#111111] text-white flex flex-col justify-between h-full select-none">
      {/* Brand & Main Navigation */}
      <div className="flex flex-col">
        {/* Top Header */}
        <div className="h-16 px-5 border-b border-[#242424] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PaySightLogo inverted className="w-7 h-7" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-white">PaySight</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#242424] text-[#A3A3A3] border border-[#333333]">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-[#A3A3A3] font-medium leading-tight">
                Merchant Intelligence
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1.5 text-[#A3A3A3] hover:text-white hover:bg-[#242424] rounded-md transition-colors"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Primary Navigation List */}
        <nav className="p-3 space-y-1" aria-label="Primary navigation">
          <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
            Navigation
          </div>
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors group focus:outline-none focus:ring-1 focus:ring-[#C2410C] ${
                  isActive
                    ? "bg-[#242424] text-white font-semibold"
                    : "text-[#A3A3A3] hover:text-white hover:bg-[#242424]/60"
                }`}
              >
                <div className="flex items-center min-w-0">
                  {isActive && (
                    <span className="w-1.5 h-3.5 rounded-full bg-[#C2410C] mr-2.5 flex-shrink-0" />
                  )}
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 mr-2.5 transition-colors ${
                      isActive ? "text-white" : "text-[#737373] group-hover:text-white"
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {item.tag && (
                    <span
                      className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        isActive
                          ? "bg-[#111111] text-[#E5E5E5] border border-[#404040]"
                          : "bg-[#242424] text-[#A3A3A3] border border-[#333333]"
                      }`}
                    >
                      {item.tag}
                    </span>
                  )}
                  {item.badge && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#242424] text-[#C2410C] border border-[#C2410C]/30">
                      {item.badge}
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          {/* Secondary Sandbox Tools Section */}
          <div className="pt-4 px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
            Checkout Terminal
          </div>
          {secondaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors group focus:outline-none focus:ring-1 focus:ring-[#C2410C] ${
                  isActive
                    ? "bg-[#242424] text-white font-semibold"
                    : "text-[#A3A3A3] hover:text-white hover:bg-[#242424]/60"
                }`}
              >
                <div className="flex items-center min-w-0">
                  {isActive && (
                    <span className="w-1.5 h-3.5 rounded-full bg-[#C2410C] mr-2.5 flex-shrink-0" />
                  )}
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 mr-2.5 transition-colors ${
                      isActive ? "text-white" : "text-[#737373] group-hover:text-white"
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#242424] text-[#A3A3A3] border border-[#333333]">
                  {isLiveConnected ? "Sandbox" : "Offline"}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Environment Status & Footer */}
      <div className="p-3 border-t border-[#242424] space-y-2.5">
        <div className="bg-[#1A1A1A] border border-[#242424] rounded-lg p-2.5 flex flex-col gap-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[#737373] uppercase tracking-wider">
              Environment
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-[#A3A3A3] font-medium">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isLiveConnected ? "bg-[#15803D]" : "bg-[#B91C1C]"
                }`}
              />
              {isLiveConnected ? "PayPal Sandbox" : "Not Connected"}
            </span>
          </div>
          <div className="text-[10px] font-mono text-[#737373] truncate">
            {isLiveConnected ? "api-m.sandbox.paypal.com" : "PayPal Credentials Required"}
          </div>
        </div>

        <div className="flex items-center justify-between px-2 py-1.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-[#242424] text-white flex items-center justify-center text-xs font-bold border border-[#333333] flex-shrink-0">
              <User className="w-3.5 h-3.5 text-[#A3A3A3]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-white truncate">
                Merchant Workspace
              </span>
              <span className="text-[10px] text-[#737373] truncate">
                {isLiveConnected ? "Sandbox Connected" : "PayPal Disconnected"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <a
              href="https://github.com/yugomania/Paysight"
              target="_blank"
              rel="noopener noreferrer"
              title="View PaySight GitHub Repository"
              className="text-[#737373] hover:text-white p-1 rounded hover:bg-[#242424] transition-colors"
              aria-label="PaySight GitHub Repository"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <SignOutButton />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex flex-col h-screen sticky top-0 flex-shrink-0 z-30">
        {content}
      </aside>

      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="relative z-50 flex-1 max-w-[260px] h-full shadow-2xl">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
