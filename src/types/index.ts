// ─── PayPal Transaction Types ───────────────────────────────────────────────

export type DataSourceKind = "paypal_sandbox" | "demo_sample";

export interface Transaction {
  id: string;
  date: string; // ISO 8601 string (UTC)
  amount: number; // Gross amount (positive magnitude)
  fee?: number; // Provider fee (positive magnitude)
  net?: number; // Net = amount - fee (negative for refunds)
  currency: string; // ISO 4217
  status: "COMPLETED" | "PENDING" | "FAILED" | "REFUNDED" | "DENIED";
  customerName: string;
  customerEmail: string;
  productName: string;
  productSku?: string;
  paymentMethod: "paypal" | "card" | "paylater" | "venmo";
  invoiceId?: string;
  note?: string;
  source?: DataSourceKind;
}

export interface CurrencyMetricsBreakdown {
  gross: number;
  fees: number;
  net: number;
  count: number;
  refundCount: number;
  refundAmount: number;
}

export interface MerchantKPIs {
  totalRevenue30d: number; // Gross completed volume for primary currency
  totalRevenue30dChange: number;
  transactionCount30d: number;
  transactionCount30dChange: number;
  averageOrderValue: number;
  averageOrderValueChange: number;
  disputeRate: number;
  disputeRateChange: number;
  disputeCount?: number;
  currency: string;
  // Advanced granular analytics (strictly scoped to `currency`)
  grossVolume30d: number;
  netVolume30d: number;
  totalFees30d: number;
  refundCount30d: number;
  refundAmount30d: number;
  reportingPeriod: string;
  reportingDays: number;
  reportingTimezone: string;
  hasPreviousPeriodData: boolean;
  isPartialData?: boolean;
  dataWarning?: string;
  source: DataSourceKind;
  lastUpdated: string;
  currencyTotals: Record<string, CurrencyMetricsBreakdown>;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  transactions: number;
  refunds?: number;
  currency?: string;
}

export interface ProductRevenue {
  productName: string;
  revenue: number;
  units: number;
  averagePrice: number;
}

// ─── Invoice Types ───────────────────────────────────────────────────────────

export interface Invoice {
  id: string;
  invoiceNumber: string;
  recipientName: string;
  recipientEmail: string;
  amount: number;
  currency: string;
  status: "DRAFT" | "SENT" | "PAID" | "CANCELLED" | "REFUNDED";
  dueDate: string;
  createdDate: string;
  items: InvoiceItem[];
  note?: string;
  paymentUrl?: string;
  source?: DataSourceKind;
}

export interface InvoiceItem {
  name: string;
  quantity: number;
  unitAmount: number;
  description?: string;
}

export interface CreateInvoiceInput {
  recipientName: string;
  recipientEmail: string;
  items: InvoiceItem[];
  currency?: string;
  note?: string;
  dueDate?: string;
  autoSend?: boolean; // Must be false unless explicitly authorized
  confirmationToken?: string; // Token bound to exact proposal details
}

export interface InvoiceProposal {
  id: string;
  recipientName: string;
  recipientEmail: string;
  items: InvoiceItem[];
  totalAmount: number;
  currency: string;
  dueDate: string;
  note?: string;
  missingFields: string[];
  isValid: boolean;
  confirmationToken: string;
  status: "PROPOSAL_PENDING_CONFIRMATION";
}

// ─── Dispute Types ───────────────────────────────────────────────────────────

export interface Dispute {
  id: string;
  transactionId: string;
  reason: string;
  status: "OPEN" | "WAITING_FOR_SELLER" | "WAITING_FOR_BUYER" | "RESOLVED" | "UNDER_REVIEW";
  amount: number;
  currency: string;
  openedDate: string;
  updatedDate: string;
  buyerName: string;
  isLiveVerified?: boolean;
  source?: DataSourceKind;
}

// ─── Channel3 / Competitor Pricing Types ────────────────────────────────────

export type PricingDataSource =
  | "channel3_live"
  | "structured_fallback"
  | "synthetic_fallback";

export interface CompetitorProduct {
  productName: string;
  retailer: string;
  price: number;
  currency: string;
  url: string;
  inStock: boolean;
  imageUrl?: string;
  brand?: string;
  model?: string;
  condition?: "new" | "refurbished" | "used";
  retrievalTime?: string;
  isExactMatch?: boolean;
  matchConfidence?: "exact" | "approximate";
}

export interface PricingComparison {
  yourProductName: string;
  yourPrice: number;
  yourSku?: string;
  currency: string;
  marketMinPrice: number;
  marketMaxPrice: number;
  marketAvgPrice: number;
  priceDifference: number;
  priceDifferencePct: number | null;
  competitorCount: number;
  pricePosition: "competitive" | "high" | "low" | "unknown";
  competitors: CompetitorProduct[];
  exactMatchesCount?: number;
  approximateMatchesCount?: number;
  comparisonTimestamp?: string;
  source: PricingDataSource;
  isSimulated: boolean;
  fromCache?: boolean;
  disclaimer?: string;
}

// ─── Merchant Budget Intelligence Types ─────────────────────────────────────

export type ExpenseCategory =
  | "inventory"
  | "marketing"
  | "software"
  | "shipping"
  | "operations"
  | "taxes"
  | "other";

export interface MerchantExpense {
  id: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency: string;
  recurring?: boolean;
  createdAt: string;
}

export interface MonthlyBudgetTarget {
  month: string; // YYYY-MM
  currency: string;
  salesTarget: number;
  expenseBudget: number;
  updatedAt: string;
}

export interface BudgetCategoryBreakdown {
  category: ExpenseCategory;
  total: number;
  sharePct: number;
  count: number;
}

export interface BudgetSummary {
  month: string; // YYYY-MM
  currency: string;
  salesTarget: number;
  expenseBudget: number;
  actualGrossSales: number;
  completedOrderCount: number;
  refunds: number;
  refundCount: number;
  paypalFees: number;
  netPayPalProceeds: number;
  manualExpensesTotal: number;
  expensesByCategory: BudgetCategoryBreakdown[];
  estimatedOperatingCashFlow: number; // netPayPalProceeds - manualExpensesTotal (clearly distinct from non-PayPal sales/profit)
  targetProgressPct: number | null;
  salesVariance: number;
  expenseBudgetVariance: number;
  expenseUtilizationPct: number | null;
  status: "ON_TRACK" | "BEHIND_TARGET" | "OVER_BUDGET" | "AT_RISK" | "UNCONFIGURED";
  alerts: string[];
  dataSource: DataSourceKind;
  previousMonth: {
    month: string;
    actualGrossSales: number;
    netPayPalProceeds: number;
    manualExpensesTotal: number;
    grossSalesChangePct: number | null;
  };
  calculationNotes: string[];
}

// ─── AI Chat Types ───────────────────────────────────────────────────────────

export interface ChartDataResponse {
  chartType: "line" | "bar" | "pie" | "none";
  data: unknown;
  title?: string;
}

// ─── Dashboard State ─────────────────────────────────────────────────────────

export type DateRangeOption = "7d" | "30d" | "90d";

export interface DashboardFilters {
  dateRange: DateRangeOption;
  status?: Transaction["status"];
  paymentMethod?: Transaction["paymentMethod"];
}
