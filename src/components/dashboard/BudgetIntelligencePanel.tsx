"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Plus,
  Receipt,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { BudgetSummary, ExpenseCategory, MerchantExpense } from "@/types";
import { formatMoney } from "./StatusBadge";

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  inventory: "Inventory / COGS",
  marketing: "Marketing & Ads",
  software: "Software & SaaS",
  shipping: "Shipping & Fulfillment",
  operations: "Operations & Overhead",
  taxes: "Taxes & Compliance",
  other: "Other",
};

interface BudgetIntelligencePanelProps {
  onExplainBudget?: (prompt: string) => void;
  refreshSignal?: number;
}

export function BudgetIntelligencePanel({
  onExplainBudget,
  refreshSignal = 0,
}: BudgetIntelligencePanelProps) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [currency, setCurrency] = useState("USD");
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [expenses, setExpenses] = useState<MerchantExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Target edit state
  const [editingTargets, setEditingTargets] = useState(false);
  const [salesTargetInput, setSalesTargetInput] = useState("1500");
  const [expenseBudgetInput, setExpenseBudgetInput] = useState("650");
  const [savingTargets, setSavingTargets] = useState(false);

  // Add expense form state
  const [expDate, setExpDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expCategory, setExpCategory] = useState<ExpenseCategory>("inventory");
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expRecurring, setExpRecurring] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/budget?month=${encodeURIComponent(month)}&currency=${encodeURIComponent(currency)}`
    )
      .then((res) => res.json().then((data) => ({ ok: res.ok, status: res.status, data })))
      .then(({ ok, status, data }) => {
        if (cancelled) return;
        if (!ok || data?.error) {
          setErrorMsg(data?.error || `Failed to load budget (${status})`);
          return;
        }
        setErrorMsg("");
        setSummary(data.summary);
        setExpenses(Array.isArray(data.expenses) ? data.expenses : []);
        setSalesTargetInput(String(data.summary?.salesTarget ?? 0));
        setExpenseBudgetInput(String(data.summary?.expenseBudget ?? 0));
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(
          err instanceof Error ? err.message : "Failed to load budget intelligence"
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [month, currency, refreshSignal]);

  const handleSaveTargets = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTargets(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_target",
          month,
          currency,
          salesTarget: parseFloat(salesTargetInput) || 0,
          expenseBudget: parseFloat(expenseBudgetInput) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to update monthly budget targets");
      }
      setSummary(data.summary);
      setExpenses(Array.isArray(data.expenses) ? data.expenses : []);
      setEditingTargets(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update targets");
    } finally {
      setSavingTargets(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(expAmount);
    if (!expDesc.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setErrorMsg("Enter a description and positive expense amount.");
      return;
    }

    setSavingExpense(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_expense",
          date: expDate,
          category: expCategory,
          description: expDesc.trim(),
          amount: numericAmount,
          currency,
          recurring: expRecurring,
          month,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to save operating expense");
      }
      setSummary(data.summary);
      setExpenses(Array.isArray(data.expenses) ? data.expenses : []);
      setExpDesc("");
      setExpAmount("");
      setExpRecurring(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save expense");
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    setErrorMsg("");
    try {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_expense",
          id,
          month,
          currency,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to delete expense");
      }
      setSummary(data.summary);
      setExpenses(Array.isArray(data.expenses) ? data.expenses : []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to remove expense");
    }
  };

  const statusMeta: Record<BudgetSummary["status"], { label: string; cls: string }> = {
    ON_TRACK: {
      label: "On Track",
      cls: "bg-[#ECFDF3] text-[#15803D] border-[#BBF7D0]",
    },
    BEHIND_TARGET: {
      label: "Behind Sales Pace",
      cls: "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]",
    },
    OVER_BUDGET: {
      label: "Over Expense Budget",
      cls: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
    },
    AT_RISK: {
      label: "At Risk",
      cls: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
    },
    UNCONFIGURED: {
      label: "Targets Not Set",
      cls: "bg-[#F7F7F8] text-[#626262] border-[#E5E5E5]",
    },
  };

  const currentStatus = summary ? statusMeta[summary.status] : statusMeta.UNCONFIGURED;

  return (
    <div className="space-y-5">
      {/* Controls & Header */}
      <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#F7F7F8] border border-[#E5E5E5] text-[#171717] flex items-center justify-center">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#171717]">
                Monthly Financial &amp; Budget Planner
              </h3>
              {summary && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentStatus.cls}`}>
                  {currentStatus.label}
                </span>
              )}
            </div>
            <p className="text-xs text-[#626262]">
              PayPal net proceeds vs. sales targets and merchant-recorded operating expenses
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="sr-only" htmlFor="budget-month">
            Reporting Month
          </label>
          <input
            id="budget-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-white border border-[#E5E5E5] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#171717] focus:outline-none focus:border-[#C2410C]"
          />

          <label className="sr-only" htmlFor="budget-currency">
            Currency
          </label>
          <select
            id="budget-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="bg-white border border-[#E5E5E5] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#171717] focus:outline-none focus:border-[#C2410C]"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="CAD">CAD</option>
          </select>

          <button
            type="button"
            onClick={() => setEditingTargets((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-[#F7F7F8] text-[#171717] border border-[#E5E5E5] font-medium transition-colors"
          >
            <Target className="w-3.5 h-3.5 text-[#626262]" />
            <span>{editingTargets ? "Close Targets" : "Edit Targets"}</span>
          </button>

          {onExplainBudget && (
            <button
              type="button"
              onClick={() =>
                onExplainBudget(
                  `Analyze my merchant budget intelligence for ${month} in ${currency}. Explain my sales target progress, PayPal fees vs. manual operating expenses, cash flow variance, and previous month comparison.`
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFF3EB] hover:bg-[#FFE7D6] text-[#C2410C] border border-[#FED7AA] font-semibold transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Analyze Budget with AI</span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Target Editor Drawer */}
      {editingTargets && (
        <form
          onSubmit={handleSaveTargets}
          className="bg-[#F7F7F8] border border-[#E5E5E5] rounded-xl p-4 flex flex-wrap items-end gap-3 text-xs"
        >
          <div className="space-y-1 flex-1 min-w-[160px]">
            <label className="font-medium text-[#171717]" htmlFor="target-sales">
              Monthly Sales Target ({currency})
            </label>
            <input
              id="target-sales"
              type="number"
              min="0"
              step="0.01"
              value={salesTargetInput}
              onChange={(e) => setSalesTargetInput(e.target.value)}
              className="w-full bg-white border border-[#E5E5E5] rounded-lg px-3 py-1.5 font-mono text-[#171717]"
            />
          </div>
          <div className="space-y-1 flex-1 min-w-[160px]">
            <label className="font-medium text-[#171717]" htmlFor="target-expense">
              Operating Expense Budget ({currency})
            </label>
            <input
              id="target-expense"
              type="number"
              min="0"
              step="0.01"
              value={expenseBudgetInput}
              onChange={(e) => setExpenseBudgetInput(e.target.value)}
              className="w-full bg-white border border-[#E5E5E5] rounded-lg px-3 py-1.5 font-mono text-[#171717]"
            />
          </div>
          <button
            type="submit"
            disabled={savingTargets}
            className="px-4 py-1.5 rounded-lg bg-[#C2410C] hover:bg-[#9A3412] text-white font-semibold disabled:opacity-50"
          >
            {savingTargets ? "Saving…" : "Save Monthly Targets"}
          </button>
        </form>
      )}

      {/* Alerts Banner */}
      {summary && summary.alerts.length > 0 && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3.5 space-y-1.5 text-xs text-[#92400E]">
          <div className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-[#B45309]" />
            <span>Budget Alerts ({month})</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px]">
            {summary.alerts.map((alert, i) => (
              <li key={i}>{alert}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 4 Summary Cards */}
      {loading || !summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-[#F7F7F8] rounded-xl animate-pulse border border-[#E5E5E5]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Card 1: Sales vs Target */}
          <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-[#626262]">
              <span>PayPal Gross Sales</span>
              <Target className="w-4 h-4 text-[#171717]" />
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-[#171717]">
              {formatMoney(summary.actualGrossSales, summary.currency)}
            </div>
            <div className="w-full h-1.5 bg-[#F7F7F8] rounded-full overflow-hidden border border-[#E5E5E5]">
              <div
                className="h-full bg-[#C2410C] transition-all"
                style={{ width: `${Math.min(100, summary.targetProgressPct ?? 0)}%` }}
              />
            </div>
            <div className="text-[11px] text-[#626262] flex justify-between">
              <span>
                Target: {summary.salesTarget > 0 ? formatMoney(summary.salesTarget, summary.currency) : "Not set"}
              </span>
              <span className="font-semibold text-[#171717]">
                {summary.targetProgressPct !== null ? `${summary.targetProgressPct}%` : "—"}
              </span>
            </div>
          </div>

          {/* Card 2: PayPal Net Proceeds & Fees */}
          <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-[#626262]">
              <span>Net PayPal Proceeds</span>
              <DollarSign className="w-4 h-4 text-[#171717]" />
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-[#171717]">
              {formatMoney(summary.netPayPalProceeds, summary.currency)}
            </div>
            <div className="text-[11px] text-[#626262] space-y-0.5 pt-1 border-t border-[#E5E5E5]">
              <div className="flex justify-between">
                <span>PayPal Processing Fees:</span>
                <span className="font-mono text-[#171717]">
                  -{formatMoney(summary.paypalFees, summary.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Refunds ({summary.refundCount}):</span>
                <span className="font-mono text-[#B91C1C]">
                  {formatMoney(summary.refunds, summary.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Manual Operating Expenses */}
          <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-[#626262]">
              <span>Operating Expenses</span>
              <Receipt className="w-4 h-4 text-[#171717]" />
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-[#171717]">
              {formatMoney(summary.manualExpensesTotal, summary.currency)}
            </div>
            <div className="w-full h-1.5 bg-[#F7F7F8] rounded-full overflow-hidden border border-[#E5E5E5]">
              <div
                className={`h-full transition-all ${
                  (summary.expenseUtilizationPct ?? 0) > 100 ? "bg-[#B91C1C]" : "bg-[#111111]"
                }`}
                style={{ width: `${Math.min(100, summary.expenseUtilizationPct ?? 0)}%` }}
              />
            </div>
            <div className="text-[11px] text-[#626262] flex justify-between">
              <span>
                Budget: {summary.expenseBudget > 0 ? formatMoney(summary.expenseBudget, summary.currency) : "Not set"}
              </span>
              <span className="font-semibold text-[#171717]">
                {summary.expenseUtilizationPct !== null ? `${summary.expenseUtilizationPct}% used` : "—"}
              </span>
            </div>
          </div>

          {/* Card 4: Estimated Operating Cash Flow & Prior Month */}
          <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-[#626262]">
              <span>Operating Cash Flow</span>
              <TrendingUp className="w-4 h-4 text-[#171717]" />
            </div>
            <div
              className={`text-xl font-bold font-mono tabular-nums ${
                summary.estimatedOperatingCashFlow >= 0 ? "text-[#15803D]" : "text-[#B91C1C]"
              }`}
            >
              {formatMoney(summary.estimatedOperatingCashFlow, summary.currency)}
            </div>
            <div className="text-[11px] text-[#626262] space-y-0.5 pt-1 border-t border-[#E5E5E5]">
              <div className="flex justify-between">
                <span>Prior ({summary.previousMonth.month}) Gross:</span>
                <span className="font-mono text-[#171717]">
                  {formatMoney(summary.previousMonth.actualGrossSales, summary.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>MoM Gross Change:</span>
                <span className="font-mono text-[#171717]">
                  {summary.previousMonth.grossSalesChangePct !== null
                    ? `${summary.previousMonth.grossSalesChangePct >= 0 ? "+" : ""}${summary.previousMonth.grossSalesChangePct}%`
                    : "No prior data"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Middle Section: Category Breakdown + Record Expense Form */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Category Breakdown */}
          <div className="lg:col-span-5 bg-white border border-[#E5E5E5] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#626262]">
                Expenses by Category
              </span>
              <span className="text-[11px] font-mono text-[#626262]">
                {expenses.length} item(s)
              </span>
            </div>

            {summary.expensesByCategory.length === 0 ? (
              <p className="text-xs text-[#626262] py-6 text-center">
                No operating expenses recorded for {month}. Add business expenses on the right.
              </p>
            ) : (
              <div className="space-y-2.5">
                {summary.expensesByCategory.map((cat) => (
                  <div key={cat.category} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#171717]">
                        {CATEGORY_LABELS[cat.category]}
                      </span>
                      <span className="font-mono tabular-nums text-[#171717]">
                        {formatMoney(cat.total, summary.currency)} ({cat.sharePct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#F7F7F8] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#C2410C]"
                        style={{ width: `${Math.min(100, cat.sharePct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Expense Form + Month Expense List */}
          <div className="lg:col-span-7 bg-white border border-[#E5E5E5] rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#626262]">
                Record Operating Expense ({currency})
              </span>
              <span className="text-[11px] text-[#626262]">
                Separate from PayPal processing fees
              </span>
            </div>

            <form onSubmit={handleAddExpense} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs">
              <div className="sm:col-span-3">
                <label className="sr-only" htmlFor="exp-date">
                  Date
                </label>
                <input
                  id="exp-date"
                  type="date"
                  required
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full bg-white border border-[#E5E5E5] rounded-lg px-2.5 py-1.5 font-mono text-xs text-[#171717]"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="sr-only" htmlFor="exp-cat">
                  Category
                </label>
                <select
                  id="exp-cat"
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}
                  className="w-full bg-white border border-[#E5E5E5] rounded-lg px-2.5 py-1.5 text-xs text-[#171717]"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-4">
                <label className="sr-only" htmlFor="exp-desc">
                  Description
                </label>
                <input
                  id="exp-desc"
                  type="text"
                  required
                  placeholder="Expense description..."
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  className="w-full bg-white border border-[#E5E5E5] rounded-lg px-2.5 py-1.5 text-xs text-[#171717]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="sr-only" htmlFor="exp-amount">
                  Amount
                </label>
                <input
                  id="exp-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  className="w-full bg-white border border-[#E5E5E5] rounded-lg px-2.5 py-1.5 font-mono text-xs text-[#171717]"
                />
              </div>

              <div className="sm:col-span-12 flex flex-wrap items-center justify-between gap-2 pt-1">
                <label className="inline-flex items-center gap-1.5 text-[11px] text-[#626262] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={expRecurring}
                    onChange={(e) => setExpRecurring(e.target.checked)}
                    className="accent-[#C2410C]"
                  />
                  <span>Recurring monthly expense</span>
                </label>

                <button
                  type="submit"
                  disabled={savingExpense}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#C2410C] hover:bg-[#9A3412] text-white font-semibold disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{savingExpense ? "Recording…" : "Add Expense"}</span>
                </button>
              </div>
            </form>

            {/* Expense Ledger Table */}
            {expenses.length > 0 && (
              <div className="border-t border-[#E5E5E5] pt-3 space-y-2 max-h-56 overflow-y-auto">
                {expenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-[#F7F7F8] border border-[#E5E5E5] text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-[#171717] truncate">
                        {exp.description}
                      </div>
                      <div className="text-[11px] text-[#626262] flex items-center gap-2">
                        <span className="font-mono">{exp.date}</span>
                        <span>•</span>
                        <span>{CATEGORY_LABELS[exp.category]}</span>
                        {exp.recurring && (
                          <span className="px-1.5 py-0.2 rounded bg-white border border-[#E5E5E5] text-[10px]">
                            Recurring
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      <span className="font-mono tabular-nums font-bold text-[#171717]">
                        {formatMoney(exp.amount, exp.currency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-1 text-[#626262] hover:text-[#B91C1C] rounded hover:bg-white transition-colors"
                        aria-label={`Remove expense ${exp.description}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Calculation Scope & Data Attribution Disclosure */}
      {summary && (
        <div className="bg-[#F7F7F8] border border-[#E5E5E5] rounded-xl p-3.5 text-[11px] text-[#626262] space-y-1">
          <div className="font-semibold text-[#171717] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
            <span>Calculation Definitions &amp; Scope</span>
          </div>
          {summary.calculationNotes.map((note, idx) => (
            <div key={idx}>• {note}</div>
          ))}
        </div>
      )}
    </div>
  );
}
