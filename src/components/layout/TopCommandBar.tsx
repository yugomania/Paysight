"use client";

import type { RefObject } from "react";
import {
  Search,
  Sparkles,
  Plus,
  RotateCw,
  GitFork,
  ExternalLink,
  Menu,
  X,
} from "lucide-react";
import { PaySightLogo } from "@/components/layout/Sidebar";

interface TopCommandBarProps {
  searchValue?: string;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  onSearchChange?: (query: string) => void;
  onOpenQuickInvoice?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onToggleMobileMenu?: () => void;
  onToggleChat?: () => void;
  isChatOpen?: boolean;
}

export function TopCommandBar({
  searchValue = "",
  searchInputRef,
  onSearchChange,
  onOpenQuickInvoice,
  onRefresh,
  isRefreshing = false,
  onToggleMobileMenu,
  onToggleChat,
  isChatOpen = false,
}: TopCommandBarProps) {
  return (
    <header className="h-16 border-b border-[#E5E5E5] bg-white px-4 md:px-6 flex items-center justify-between gap-3 sticky top-0 z-20">
      {/* Left: Mobile Drawer Trigger + Brand */}
      <div className="flex items-center gap-3 lg:hidden">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="p-2 -ml-1.5 rounded-lg text-[#171717] hover:bg-[#F7F7F8] border border-[#E5E5E5] transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <PaySightLogo inverted={false} className="w-6 h-6 text-xs" />
          <span className="font-bold text-sm tracking-tight text-[#171717]">PaySight</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex-1 max-w-md relative hidden sm:block">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#626262]">
          <Search className="w-4 h-4" />
        </div>
        <input
          ref={searchInputRef}
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder="Search transactions, customers, invoices..."
          aria-label="Search transactions, customers, and invoices"
          className="w-full bg-white border border-[#E5E5E5] rounded-lg pl-9 pr-14 py-2 text-xs text-[#171717] placeholder:text-[#626262] focus:outline-none focus:ring-2 focus:ring-[#FFF3EB] focus:border-[#C2410C] transition-all"
        />
        <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1">
          {searchValue ? (
            <button
              type="button"
              onClick={() => onSearchChange?.("")}
              className="p-0.5 text-[#626262] hover:text-[#171717] rounded"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-[#626262] bg-[#F7F7F8] border border-[#E5E5E5] rounded pointer-events-none">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {/* Right Action Cluster */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleChat}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
            isChatOpen
              ? "bg-[#111111] text-white border-[#111111]"
              : "bg-[#FFF3EB] hover:bg-[#FFE7D6] text-[#C2410C] border-[#FED7AA] shadow-xs"
          }`}
          aria-label={isChatOpen ? "Close AI Assistant" : "Open AI Assistant"}
        >
          <Sparkles className={`w-3.5 h-3.5 ${isChatOpen ? "text-[#FED7AA]" : "text-[#C2410C]"}`} />
          <span>Ask PaySight</span>
          <span className="hidden sm:inline-flex text-[10px] font-mono px-1 rounded bg-white text-[#C2410C] border border-[#FED7AA]">
            AI
          </span>
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh dashboard data"
          className="p-2 rounded-lg bg-white hover:bg-[#F7F7F8] text-[#171717] border border-[#E5E5E5] transition-colors disabled:opacity-50"
          aria-label="Refresh dashboard data"
        >
          <RotateCw
            className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[#C2410C]" : ""}`}
          />
        </button>

        <button
          type="button"
          onClick={onOpenQuickInvoice}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-semibold shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#C2410C]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">New Invoice</span>
        </button>

        <a
          href="https://github.com/yugomania/Paysight"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-[#F7F7F8] text-[#171717] text-xs font-medium border border-[#E5E5E5] transition-colors"
          title="View PaySight source on GitHub"
        >
          <GitFork className="w-3.5 h-3.5 text-[#626262]" />
          <span className="hidden sm:inline">GitHub</span>
          <ExternalLink className="w-3 h-3 text-[#626262]" />
        </a>
      </div>
    </header>
  );
}
