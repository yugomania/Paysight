import { NextRequest } from "next/server";
import { z } from "zod";
import {
  EXPENSE_CATEGORIES,
  getBudgetSummary,
  normalizeMonthKey,
  recordMerchantExpense,
  removeMerchantExpense,
  updateMonthlyBudgetTarget,
} from "@/lib/budget/service";
import type { ExpenseCategory } from "@/types";

const addExpenseSchema = z.object({
  action: z.literal("add_expense"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  category: z.enum(EXPENSE_CATEGORIES as [ExpenseCategory, ...ExpenseCategory[]]),
  description: z.string().min(1, "Description is required").max(200),
  amount: z.number().positive("Amount must be greater than zero"),
  currency: z.string().min(3).max(3).optional().default("USD"),
  recurring: z.boolean().optional().default(false),
  month: z.string().optional(),
});

const updateTargetSchema = z.object({
  action: z.literal("update_target"),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM").optional(),
  currency: z.string().min(3).max(3).optional().default("USD"),
  salesTarget: z.number().min(0, "Sales target cannot be negative"),
  expenseBudget: z.number().min(0, "Expense budget cannot be negative"),
});

const deleteExpenseSchema = z.object({
  action: z.literal("delete_expense"),
  id: z.string().min(1, "Expense id is required"),
  month: z.string().optional(),
  currency: z.string().min(3).max(3).optional().default("USD"),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month = normalizeMonthKey(searchParams.get("month") ?? undefined);
    const currency = searchParams.get("currency")?.trim() || undefined;
    const data = await getBudgetSummary(month, currency);
    return Response.json(data);
  } catch (err) {
    console.error("[/api/budget] GET error:", err);
    return Response.json({ error: "Failed to load budget intelligence" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body?.action === "add_expense") {
      const parsed = addExpenseSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid expense payload" },
          { status: 400 }
        );
      }
      const expense = recordMerchantExpense(parsed.data);
      const month = parsed.data.month || parsed.data.date.slice(0, 7);
      const budgetData = await getBudgetSummary(month, parsed.data.currency);
      return Response.json({ success: true, expense, ...budgetData });
    }

    if (body?.action === "update_target") {
      const parsed = updateTargetSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid budget target payload" },
          { status: 400 }
        );
      }
      const target = updateMonthlyBudgetTarget(parsed.data);
      const budgetData = await getBudgetSummary(target.month, target.currency);
      return Response.json({ success: true, target, ...budgetData });
    }

    if (body?.action === "delete_expense") {
      const parsed = deleteExpenseSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid delete payload" },
          { status: 400 }
        );
      }
      const deleted = removeMerchantExpense(parsed.data.id);
      if (!deleted) {
        return Response.json({ error: "Expense record not found" }, { status: 404 });
      }
      const budgetData = await getBudgetSummary(parsed.data.month, parsed.data.currency);
      return Response.json({ success: true, ...budgetData });
    }

    return Response.json(
      { error: "Unsupported budget action. Expected add_expense, update_target, or delete_expense." },
      { status: 400 }
    );
  } catch (err) {
    console.error("[/api/budget] POST error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to update budget data" },
      { status: 400 }
    );
  }
}

