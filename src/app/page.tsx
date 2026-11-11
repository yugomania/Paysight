"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Sidebar, type NavTab } from "@/components/layout/Sidebar";
import { TopCommandBar } from "@/components/layout/TopCommandBar";
import { QuickActionModal } from "@/components/dashboard/QuickActionModal";
import { KPICards } from "@/components/dashboard/KPICards";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { TransactionGrid } from "@/components/dashboard/TransactionGrid";
import { CompetitorPricingGrid } from "@/components/dashboard/CompetitorPricingGrid";
import { PayPalDemoCheckout } from "@/components/checkout/PayPalDemoCheckout";
import { ChatPanel } from "@/components/ai/ChatPanel";
import { NeedsAttention } from "@/components/dashboard/NeedsAttention";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { OverviewQuickActions } from "@/components/dashboard/OverviewQuickActions";
import { BudgetIntelligencePanel } from "@/components/dashboard/BudgetIntelligencePanel";
import { InvoicesPanel } from "@/components/dashboard/InvoicesPanel";
import type {
  Transaction,
  MerchantKPIs,
  RevenueDataPoint,
  PricingComparison,
  DateRangeOption,
  Invoice,
  Dispute,
} from "@/types";
import { CheckCircle2, Info, AlertTriangle } from "lucide-react";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<NavTab>("overview");
  const [globalSearch, setGlobalSearch] = useState("");
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [budgetRefreshSignal, setBudgetRefreshSignal] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Collapsible Assistant state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [prefillPrompt, setPrefillPrompt] = useState<string>("");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [kpis, setKpis] = useState<MerchantKPIs | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [comparisons, setComparisons] = useState<PricingComparison[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [disputeMessage, setDisputeMessage] = useState<string>("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [dateRange, setDateRange] = useState<DateRangeOption>("30d");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("USD");

  const [loadingTxns, setLoadingTxns] = useState(true);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [loadingRevenue, setLoadingRevenue] = useState(true);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // ─── Authoritative Data Fetching ─────────────────────────────────────────

  const fetchDashboardData = useCallback(async () => {
    setIsRefreshing(true);
    setFetchError("");
    const days = dateRange === "90d" ? 90 : dateRange === "7d" ? 7 : 30;

    setLoadingTxns(true);
    setLoadingKpis(true);
    setLoadingRevenue(true);

    const txnReq = fetch(`/api/transactions?days=${days}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setTransactions(data);
        else if (data?.error) setFetchError(data.error);
      })
      .catch((err) => {
        console.error("Transactions fetch error:", err);
        setFetchError("Unable to load transactions from server.");
      })
      .finally(() => setLoadingTxns(false));

    const kpiReq = fetch(`/api/transactions?type=kpis&currency=${encodeURIComponent(selectedCurrency)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) {
          setKpis(data);
          setIsLiveConnected(data.source === "paypal_sandbox");
        }
      })
      .catch((err) => console.error("KPIs fetch error:", err))
      .finally(() => setLoadingKpis(false));

    const revReq = fetch(`/api/transactions?type=revenue&days=${days}&currency=${encodeURIComponent(selectedCurrency)}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setRevenueData(data);
      })
      .catch((err) => console.error("Revenue fetch error:", err))
      .finally(() => setLoadingRevenue(false));

    const invReq = fetch("/api/invoices")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.invoices)) setInvoices(data.invoices);
      })
      .catch((err) => console.error("Invoices fetch error:", err));

    const dispReq = fetch("/api/disputes")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.disputes)) setDisputes(data.disputes);
        if (data?.statusMessage) setDisputeMessage(data.statusMessage);
      })
      .catch((err) => console.error("Disputes fetch error:", err));

    await Promise.allSettled([txnReq, kpiReq, revReq, invReq, dispReq]);
    setBudgetRefreshSignal((n) => n + 1);
    setIsRefreshing(false);
  }, [dateRange, selectedCurrency]);

  const fetchPricingData = useCallback((forceRefresh = false) => {
    if (!forceRefresh && comparisons.length > 0) return;
    setLoadingPricing(true);
    const sampleProducts = [
      { name: "Premium Noise Cancelling Headphones", price: 149.99 },
      { name: "Ergonomic Mechanical Keyboard", price: 89.99 },
      { name: "Ultra-Clear 4K Streaming Webcam", price: 119.99 },
      { name: "7-in-1 Aluminum USB-C Hub", price: 49.99 },
    ];

    Promise.all(
      sampleProducts.map((p) =>
        fetch(`/api/pricing?product=${encodeURIComponent(p.name)}&price=${p.price}`)
          .then((res) => res.json())
          .catch(() => null)
      )
    )
      .then((results) => {
        const valid = results.filter((r) => r && !r.error);
        setComparisons(valid);
      })
      .finally(() => setLoadingPricing(false));
  }, [comparisons.length]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (activeTab === "pricing") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchPricingData();
    }
  }, [activeTab, fetchPricingData]);

  // Keyboard shortcuts: Cmd/Ctrl+J toggles Copilot, Cmd/Ctrl+K focuses search, Escape closes drawers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsChatOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape") {
        if (isChatOpen) setIsChatOpen(false);
        if (isMobileMenuOpen) setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isChatOpen, isMobileMenuOpen]);

  const openChatWithPrompt = (prompt: string) => {
    setPrefillPrompt(prompt);
    setIsChatOpen(true);
  };

  const handleNewPaymentSuccess = (newTxn: Transaction) => {
    setTransactions((prev) => [newTxn, ...prev]);
    fetch("/api/transactions?type=kpis")
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) setKpis(data);
      });
    setBudgetRefreshSignal((n) => n + 1);
  };

  const handleInvoiceCreated = (newInv: Invoice) => {
    setInvoices((prev) => [newInv, ...prev]);
  };

  const handleInvoiceUpdated = (updated: Invoice) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === updated.id ? updated : inv))
    );
  };

  return (
    <div className="min-h-screen bg-white text-[#171717] flex">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        disputeCount={disputes.length}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        isLiveConnected={isLiveConnected}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopCommandBar
          searchValue={globalSearch}
          searchInputRef={searchInputRef}
          onSearchChange={(q) => {
            setGlobalSearch(q);
            if (q.trim() && activeTab === "overview") {
              setActiveTab("transactions");
            }
          }}
          onOpenQuickInvoice={() => setIsInvoiceModalOpen(true)}
          onRefresh={() => {
            fetchDashboardData();
            if (activeTab === "pricing") fetchPricingData(true);
          }}
          isRefreshing={isRefreshing}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onToggleChat={() => setIsChatOpen((prev) => !prev)}
          isChatOpen={isChatOpen}
        />

        {/* Environment Mode & Partial-Data Transparency Banners */}
        {!isLiveConnected && (
          <div className="bg-[#FFF3EB] border-b border-[#FED7AA] px-4 md:px-6 py-2 flex items-center justify-between text-xs text-[#C2410C]">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 flex-shrink-0" />
              <span>
                {kpis?.dataWarning ? (
                  <>
                    <strong>Sandbox Fallback Ledger:</strong> {kpis.dataWarning}
                  </>
                ) : (
                  <>
                    <strong>Demo Mode Active:</strong> Showing deterministic sample data from{" "}
                    <code>.data/paysight-db.json</code>. Configure{" "}
                    <code>PAYPAL_CLIENT_ID</code> and <code>PAYPAL_CLIENT_SECRET</code> in{" "}
                    <code>.env.local</code> for live PayPal Sandbox.
                  </>
                )}
              </span>
            </div>
            <span className="hidden sm:inline font-mono text-[11px] bg-white text-[#C2410C] px-2 py-0.5 rounded border border-[#FED7AA]">
              {kpis?.dataWarning ? "Fallback Sample Data" : "Demo Sample Data"}
            </span>
          </div>
        )}

        {isLiveConnected && kpis?.isPartialData && kpis?.dataWarning && (
          <div className="bg-[#FFFBEB] border-b border-[#FDE68A] px-4 md:px-6 py-2 flex items-center gap-2 text-xs text-[#92400E]">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-[#B45309]" />
            <span>
              <strong>Partial PayPal Notice:</strong> {kpis.dataWarning}
            </span>
          </div>
        )}

        {fetchError && (
          <div className="bg-[#FEF2F2] border-b border-[#FECACA] px-4 md:px-6 py-2 flex items-center gap-2 text-xs text-[#B91C1C]">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{fetchError}</span>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {activeTab === "overview" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-[#171717]">Business Overview</h2>
                    <p className="text-xs text-[#626262]">
                      Server-calculated performance metrics and settlement velocity
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono text-[#626262]">
                    <span>
                      {kpis?.reportingPeriod || "Last 30 days"} • {kpis?.reportingTimezone || "UTC"}
                    </span>
                    <label className="sr-only" htmlFor="overview-currency">
                      Reporting Currency
                    </label>
                    <select
                      id="overview-currency"
                      value={selectedCurrency}
                      onChange={(e) => setSelectedCurrency(e.target.value)}
                      className="bg-white border border-[#E5E5E5] rounded-md px-2 py-1 text-xs font-mono text-[#171717] focus:outline-none focus:border-[#C2410C]"
                    >
                      {Array.from(
                        new Set([
                          "USD",
                          "EUR",
                          "GBP",
                          "CAD",
                          ...Object.keys(kpis?.currencyTotals ?? {}),
                        ])
                      ).map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <KPICards kpis={kpis} loading={loadingKpis} />

                <RevenueChart
                  data={revenueData}
                  loading={loadingRevenue}
                  dateRange={dateRange}
                  currency={selectedCurrency}
                  onDateRangeChange={setDateRange}
                  onExplainTrend={() =>
                    openChatWithPrompt(
                      `Explain my settlement revenue trend for the last ${dateRange} in ${selectedCurrency}. Detail velocity, refund impacts, and fees.`
                    )
                  }
                />
              </div>

              <NeedsAttention
                disputes={disputes}
                invoices={invoices}
                isLiveConnected={isLiveConnected}
                loading={loadingKpis}
                onNavigateToDisputes={() => setActiveTab("disputes")}
                onNavigateToInvoices={() => setActiveTab("invoices")}
              />

              <div className="space-y-4">
                <OverviewQuickActions
                  onOpenInvoiceModal={() => setIsInvoiceModalOpen(true)}
                  onNavigateToPricing={() => setActiveTab("pricing")}
                  onNavigateToCheckout={() => setActiveTab("checkout")}
                  onOpenChat={() => setIsChatOpen(true)}
                />

                <RecentTransactions
                  transactions={transactions}
                  loading={loadingTxns}
                  onViewAll={() => setActiveTab("transactions")}
                />
              </div>
            </div>
          )}

          {activeTab === "transactions" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <h2 className="text-base font-bold text-[#171717]">Transactions</h2>
                <p className="text-xs text-[#626262]">
                  Complete searchable ledger with currency columns, settlement details, and CSV export
                </p>
              </div>

              <TransactionGrid
                transactions={transactions}
                loading={loadingTxns}
                externalSearch={globalSearch}
                onSummarizeTransactions={() =>
                  openChatWithPrompt(
                    "Summarise my recent PayPal transactions for the last 30 days. Highlight completed order volume, pending/failed items, fees, and net payout."
                  )
                }
              />
            </div>
          )}

          {activeTab === "invoices" && (
            <InvoicesPanel
              invoices={invoices}
              externalSearch={globalSearch}
              onOpenNewInvoice={() => setIsInvoiceModalOpen(true)}
              onOpenAiHelp={() =>
                openChatWithPrompt(
                  "Help me prepare an invoice for a customer. Ask for recipient name, email, item description, quantity, and unit price to generate a confirmation preview."
                )
              }
              onInvoiceUpdated={handleInvoiceUpdated}
            />
          )}

          {activeTab === "budget" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <h2 className="text-base font-bold text-[#171717]">Budget Intelligence</h2>
                <p className="text-xs text-[#626262]">
                  Compare monthly PayPal proceeds against sales targets and recorded operating expenses
                </p>
              </div>

              <BudgetIntelligencePanel
                refreshSignal={budgetRefreshSignal}
                onExplainBudget={openChatWithPrompt}
              />
            </div>
          )}

          {activeTab === "pricing" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <h2 className="text-base font-bold text-[#171717]">Price comparison</h2>
                <p className="text-xs text-[#626262]">
                  Competitive pricing benchmarks across retail listings via Channel3
                </p>
              </div>

              <CompetitorPricingGrid
                comparisons={comparisons}
                loading={loadingPricing}
                onAddComparison={(newComp) => setComparisons((prev) => [newComp, ...prev])}
                onExplainComparison={() =>
                  openChatWithPrompt(
                    "Compare my catalog pricing with Channel3 market listings for Ergonomic Mechanical Keyboard and Premium Noise Cancelling Headphones."
                  )
                }
              />
            </div>
          )}

          {activeTab === "disputes" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
                <div>
                  <h2 className="text-base font-bold text-[#171717]">Disputes</h2>
                  <p className="text-xs text-[#626262]">
                    PayPal Sandbox chargeback tracking and buyer dispute cases
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#ECFDF3] text-[#15803D] border border-[#BBF7D0]">
                  {disputes.length === 0 ? "0 Active Disputes" : `${disputes.length} Open Dispute(s)`}
                </span>
              </div>

              {disputes.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#F7F7F8] border border-[#E5E5E5] space-y-2 text-center text-xs">
                  <CheckCircle2 className="w-8 h-8 text-[#15803D] mx-auto mb-1" />
                  <div className="font-semibold text-sm text-[#171717]">
                    {disputeMessage || "No active dispute cases in your PayPal account."}
                  </div>
                  <p className="text-[#626262] max-w-md mx-auto">
                    PaySight queries PayPal Customer Disputes API v1 honestly and never fabricates dispute records when unconfigured or empty.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {disputes.map((d) => (
                    <div
                      key={d.id}
                      className="p-4 rounded-xl bg-white border border-[#FECACA] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#B91C1C]" />
                          <span className="text-xs font-bold text-[#171717]">Dispute #{d.id}</span>
                          <span className="text-[11px] font-mono text-[#626262]">
                            TXN: {d.transactionId}
                          </span>
                        </div>
                        <span className="text-xs font-mono tabular-nums font-bold text-[#B91C1C]">
                          ${d.amount.toFixed(2)} {d.currency}
                        </span>
                      </div>
                      <p className="text-xs text-[#171717]">
                        Reason: <em>{d.reason}</em> • Buyer: <strong>{d.buyerName}</strong>
                      </p>
                      <div className="pt-2 flex items-center justify-between text-xs text-[#626262] border-t border-[#F7F7F8]">
                        <span>Opened: {new Date(d.openedDate).toLocaleDateString()}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]">
                          {d.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "checkout" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <h2 className="text-base font-bold text-[#171717]">Checkout Terminal</h2>
                <p className="text-xs text-[#626262]">
                  Test buyer checkout and server-side order capture against PayPal Sandbox or Demo Mode
                </p>
              </div>

              <PayPalDemoCheckout onPaymentSuccess={handleNewPaymentSuccess} />
            </div>
          )}
        </main>
      </div>

      <div
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] transition-transform duration-300 ease-in-out flex flex-col ${
          isChatOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
        aria-hidden={!isChatOpen}
      >
        <ChatPanel
          onClose={() => setIsChatOpen(false)}
          prefillPrompt={prefillPrompt}
          onClearPrefill={() => setPrefillPrompt("")}
          onDataMutated={fetchDashboardData}
        />
      </div>

      {isChatOpen && (
        <div
          onClick={() => setIsChatOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 sm:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      <QuickActionModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        onInvoiceCreated={handleInvoiceCreated}
      />
    </div>
  );
}
