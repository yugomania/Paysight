import { randomUUID } from "crypto";
import { subMonths, format, parseISO, isValid } from "date-fns";
import {
  deleteStoredExpense,
  getAllStoredBudgetTargets,
  getStoredBudgetTarget,
  getStoredExpenses,
  saveBudgetTarget,
  saveExpense,
} from "@/lib/db";
import { fetchTransactionsWithMeta, selectPrimaryCurrency } from "@/lib/paypal/api";
import type {
  BudgetCategoryBreakdown,
  BudgetSummary,
  ExpenseCategory,
  MerchantExpense,
  MonthlyBudgetTarget,
} from "@/types";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "inventory",
  "marketing",
  "software",
  "shipping",
  "operations",
  "taxes",
  "other",
];

export function normalizeMonthKey(month?: string): string {
  if (month && /^\d{4}-\d{2}$/.test(month.trim())) {
    return month.trim();
  }
  return new Date().toISOString().slice(0, 7);
}

export function getPreviousMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map((n) => parseInt(n, 10));
  if (!y || !m) return format(subMonths(new Date(), 1), "yyyy-MM");
  const dt = new Date(Date.UTC(y, m - 1, 15));
  return format(subMonths(dt, 1), "yyyy-MM");
}

export function recordMerchantExpense(input: {
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency?: string;
  recurring?: boolean;
}): MerchantExpense {
  const cleanDesc = input.description?.trim();
  if (!cleanDesc) {
    throw new Error("Expense description is required.");
  }
  if (!EXPENSE_CATEGORIES.includes(input.category)) {
    throw new Error(`Invalid expense category "${input.category}".`);
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Expense amount must be greater than zero.");
  }
  const cleanDate = input.date?.trim();
  if (!cleanDate || !/^\d{4}-\d{2}-\d{2}$/.test(cleanDate) || !isValid(parseISO(cleanDate))) {
    throw new Error("Expense date must be a valid YYYY-MM-DD date.");
  }

  const expense: MerchantExpense = {
    id: `EXP-${randomUUID().slice(0, 8).toUpperCase()}`,
    date: cleanDate,
    category: input.category,
    description: cleanDesc,
    amount: parseFloat(input.amount.toFixed(2)),
    currency: (input.currency || "USD").trim().toUpperCase(),
    recurring: Boolean(input.recurring),
    createdAt: new Date().toISOString(),
  };

  saveExpense(expense);
  return expense;
}

export function updateMonthlyBudgetTarget(input: {
  month?: string;
  currency?: string;
  salesTarget: number;
  expenseBudget: number;
}): MonthlyBudgetTarget {
  const month = normalizeMonthKey(input.month);
  const currency = (input.currency || "USD").trim().toUpperCase();

  if (!Number.isFinite(input.salesTarget) || input.salesTarget < 0) {
    throw new Error("Sales target must be zero or greater.");
  }
  if (!Number.isFinite(input.expenseBudget) || input.expenseBudget < 0) {
    throw new Error("Operating expense budget must be zero or greater.");
  }

  const target: MonthlyBudgetTarget = {
    month,
    currency,
    salesTarget: parseFloat(input.salesTarget.toFixed(2)),
    expenseBudget: parseFloat(input.expenseBudget.toFixed(2)),
    updatedAt: new Date().toISOString(),
  };

  saveBudgetTarget(target);
  return target;
}

export function removeMerchantExpense(id: string): boolean {
  if (!id?.trim()) return false;
  return deleteStoredExpense(id.trim());
}

export function computeBudgetSummaryFromRecords(params: {
  month: string;
  currency: string;
  transactions: Array<{
    date: string;
    amount: number;
    fee?: number;
    currency: string;
    status: string;
  }>;
  expenses: MerchantExpense[];
  target?: MonthlyBudgetTarget;
  dataSource: BudgetSummary["dataSource"];
  nowDate?: Date;
}): BudgetSummary {
  const monthKey = normalizeMonthKey(params.month);
  const prevMonthKey = getPreviousMonthKey(monthKey);
  const currency = params.currency.toUpperCase();

  const txForMonth = (targetMonth: string) =>
    params.transactions.filter(
      (t) =>
        (t.currency || "USD").toUpperCase() === currency &&
        t.date.slice(0, 7) === targetMonth
    );

  const currTx = txForMonth(monthKey);
  const prevTx = txForMonth(prevMonthKey);

  const completedCurr = currTx.filter((t) => t.status === "COMPLETED");
  const refundedCurr = currTx.filter((t) => t.status === "REFUNDED");
  const completedPrev = prevTx.filter((t) => t.status === "COMPLETED");

  const actualGrossSales = parseFloat(
    completedCurr.reduce((s, t) => s + t.amount, 0).toFixed(2)
  );
  const paypalFees = parseFloat(
    completedCurr.reduce((s, t) => s + Math.abs(t.fee ?? 0), 0).toFixed(2)
  );
  const refunds = parseFloat(
    refundedCurr.reduce((s, t) => s + t.amount, 0).toFixed(2)
  );
  const netPayPalProceeds = parseFloat((actualGrossSales - paypalFees).toFixed(2));

  const prevGross = parseFloat(
    completedPrev.reduce((s, t) => s + t.amount, 0).toFixed(2)
  );
  const prevFees = parseFloat(
    completedPrev.reduce((s, t) => s + Math.abs(t.fee ?? 0), 0).toFixed(2)
  );
  const prevNet = parseFloat((prevGross - prevFees).toFixed(2));

  const currExpenses = params.expenses.filter(
    (e) => e.currency.toUpperCase() === currency && e.date.slice(0, 7) === monthKey
  );
  const prevExpenses = params.expenses.filter(
    (e) => e.currency.toUpperCase() === currency && e.date.slice(0, 7) === prevMonthKey
  );

  const manualExpensesTotal = parseFloat(
    currExpenses.reduce((s, e) => s + e.amount, 0).toFixed(2)
  );
  const prevManualExpenses = parseFloat(
    prevExpenses.reduce((s, e) => s + e.amount, 0).toFixed(2)
  );

  // Category breakdown
  const catMap = new Map<ExpenseCategory, { total: number; count: number }>();
  for (const e of currExpenses) {
    const existing = catMap.get(e.category) ?? { total: 0, count: 0 };
    existing.total += e.amount;
    existing.count += 1;
    catMap.set(e.category, existing);
  }

  const expensesByCategory: BudgetCategoryBreakdown[] = Array.from(catMap.entries())
    .map(([category, v]) => ({
      category,
      total: parseFloat(v.total.toFixed(2)),
      sharePct:
        manualExpensesTotal > 0
          ? parseFloat(((v.total / manualExpensesTotal) * 100).toFixed(1))
          : 0,
      count: v.count,
    }))
    .sort((a, b) => b.total - a.total);

  const salesTarget = params.target?.salesTarget ?? 0;
  const expenseBudget = params.target?.expenseBudget ?? 0;
  const estimatedOperatingCashFlow = parseFloat(
    (netPayPalProceeds - manualExpensesTotal).toFixed(2)
  );

  const targetProgressPct =
    salesTarget > 0
      ? parseFloat(((actualGrossSales / salesTarget) * 100).toFixed(1))
      : null;
  const expenseUtilizationPct =
    expenseBudget > 0
      ? parseFloat(((manualExpensesTotal / expenseBudget) * 100).toFixed(1))
      : null;
  const salesVariance = parseFloat((actualGrossSales - salesTarget).toFixed(2));
  const expenseBudgetVariance = parseFloat((expenseBudget - manualExpensesTotal).toFixed(2));

  // Status evaluation grounded in month progress
  const alerts: string[] = [];
  let status: BudgetSummary["status"] = "ON_TRACK";

  if (salesTarget <= 0 && expenseBudget <= 0) {
    status = "UNCONFIGURED";
    alerts.push("No monthly sales target or operating expense budget set for this month.");
  } else {
    const now = params.nowDate ?? new Date();
    const currentMonthStr = now.toISOString().slice(0, 7);
    const dayOfMonth = monthKey === currentMonthStr ? now.getUTCDate() : 28;
    const expectedMonthProgressPct = Math.min(100, (dayOfMonth / 30) * 100);

    const overBudget = expenseBudget > 0 && manualExpensesTotal > expenseBudget;
    const nearBudget =
      expenseBudget > 0 && !overBudget && manualExpensesTotal >= expenseBudget * 0.85;
    const behindPace =
      salesTarget > 0 &&
      targetProgressPct !== null &&
      targetProgressPct + 15 < expectedMonthProgressPct;

    if (overBudget && behindPace) {
      status = "AT_RISK";
    } else if (overBudget) {
      status = "OVER_BUDGET";
    } else if (behindPace) {
      status = "BEHIND_TARGET";
    } else {
      status = "ON_TRACK";
    }

    if (overBudget) {
      alerts.push(
        `Operating expenses (${currency} ${manualExpensesTotal.toFixed(2)}) exceed your ${currency} ${expenseBudget.toFixed(2)} budget by ${currency} ${(manualExpensesTotal - expenseBudget).toFixed(2)}.`
      );
    } else if (nearBudget) {
      alerts.push(
        `Operating expenses have reached ${expenseUtilizationPct}% of the ${currency} ${expenseBudget.toFixed(2)} monthly budget.`
      );
    }

    if (behindPace) {
      alerts.push(
        `PayPal gross sales (${targetProgressPct}% of target) are pacing behind elapsed month progress (~${expectedMonthProgressPct.toFixed(0)}%).`
      );
    }

    if (estimatedOperatingCashFlow < 0) {
      alerts.push(
        `Net PayPal proceeds minus recorded expenses is negative (${currency} ${estimatedOperatingCashFlow.toFixed(2)}) for ${monthKey}.`
      );
    }
  }

  const grossSalesChangePct =
    prevGross > 0
      ? parseFloat((((actualGrossSales - prevGross) / prevGross) * 100).toFixed(1))
      : null;

  return {
    month: monthKey,
    currency,
    salesTarget,
    expenseBudget,
    actualGrossSales,
    completedOrderCount: completedCurr.length,
    refunds,
    refundCount: refundedCurr.length,
    paypalFees,
    netPayPalProceeds,
    manualExpensesTotal,
    expensesByCategory,
    estimatedOperatingCashFlow,
    targetProgressPct,
    salesVariance,
    expenseBudgetVariance,
    expenseUtilizationPct,
    status,
    alerts,
    dataSource: params.dataSource,
    previousMonth: {
      month: prevMonthKey,
      actualGrossSales: prevGross,
      netPayPalProceeds: prevNet,
      manualExpensesTotal: prevManualExpenses,
      grossSalesChangePct,
    },
    calculationNotes: [
      `Data source: ${
        params.dataSource === "paypal_sandbox"
          ? "PayPal Sandbox transactions"
          : params.dataSource === "paypal_live"
          ? "PayPal Live transactions"
          : "PayPal transactions unavailable (unconfigured)"
      } combined with merchant-recorded operating expenses.`,
      "Net PayPal Proceeds = Completed PayPal Gross Sales − PayPal Processing Fees (strictly for the selected currency).",
      "Estimated Operating Cash Flow = Net PayPal Proceeds − Manual Operating Expenses. PayPal transactions may not capture non-PayPal sales channels, and manual expenses exclude PayPal fees.",
      "Refunds are tracked separately from completed gross sales and not silently subtracted from target progress.",
    ],
  };
}

export async function getBudgetSummary(
  month?: string,
  currencyFilter?: string
): Promise<{
  summary: BudgetSummary;
  expenses: MerchantExpense[];
  allTargets: MonthlyBudgetTarget[];
}> {
  const monthKey = normalizeMonthKey(month);
  // Fetch ~90 days to cover current and previous calendar month cleanly
  const txMeta = await fetchTransactionsWithMeta(90);
  const primaryCurrency = selectPrimaryCurrency(txMeta.transactions, currencyFilter);
  const allExpenses = getStoredExpenses(primaryCurrency);
  const target = getStoredBudgetTarget(monthKey, primaryCurrency);

  const summary = computeBudgetSummaryFromRecords({
    month: monthKey,
    currency: primaryCurrency,
    transactions: txMeta.transactions,
    expenses: allExpenses,
    target,
    dataSource: txMeta.source,
  });

  const monthExpenses = allExpenses
    .filter((e) => e.date.slice(0, 7) === monthKey)
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    summary,
    expenses: monthExpenses,
    allTargets: getAllStoredBudgetTargets(),
  };
}

