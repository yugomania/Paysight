import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import type {
  Invoice,
  MerchantExpense,
  MonthlyBudgetTarget,
  Transaction,
} from "@/types";

export interface DatabaseSchema {
  transactions: Transaction[];
  invoices: Invoice[];
  processedEvents: string[];
  reconciledIds: string[];
  expenses: MerchantExpense[];
  budgetTargets: MonthlyBudgetTarget[];
  lastUpdated: string;
}

export interface StoreRepository {
  getTransactions(): Transaction[];
  saveTransaction(txn: Transaction): void;
  saveTransactionsBatch(txns: Transaction[]): void;
  getInvoices(): Invoice[];
  getInvoiceById(id: string): Invoice | undefined;
  saveInvoice(inv: Invoice): void;
  isEventProcessed(eventId: string): boolean;
  markEventProcessed(eventId: string): void;
  isReconciled(id: string): boolean;
  markReconciled(id: string): void;
  getExpenses(currency?: string): MerchantExpense[];
  saveExpense(expense: MerchantExpense): void;
  deleteExpense(id: string): boolean;
  getBudgetTarget(month: string, currency?: string): MonthlyBudgetTarget | undefined;
  saveBudgetTarget(target: MonthlyBudgetTarget): void;
}

const DEFAULT_DATA_DIR = path.join(process.cwd(), ".data");
const DEFAULT_DB_FILE = path.join(DEFAULT_DATA_DIR, "paysight-db.json");

export function getDbFilePath(): string {
  const custom = process.env.PAYSIGHT_DB_PATH?.trim();
  return custom ? path.resolve(custom) : DEFAULT_DB_FILE;
}

function getCurrentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

// ─── Deterministic Demo Seed Records ─────────────────────────────────────────

function buildSeedTransactions(): Transaction[] {
  const makeFee = (amount: number) => parseFloat((amount * 0.029 + 0.30).toFixed(2));
  const completedSale = (
    id: string,
    daysAgo: number,
    amount: number,
    customerName: string,
    customerEmail: string,
    productName: string,
    productSku: string,
    paymentMethod: Transaction["paymentMethod"],
    note?: string
  ): Transaction => {
    const fee = makeFee(amount);
    return {
      id,
      date: new Date(Date.now() - daysAgo * 86400000).toISOString(),
      amount,
      fee,
      net: parseFloat((amount - fee).toFixed(2)),
      currency: "USD",
      status: "COMPLETED",
      customerName,
      customerEmail,
      productName,
      productSku,
      paymentMethod,
      note,
      source: "demo_sample",
    };
  };

  return [
    completedSale(
      "TXN-8841-01",
      1,
      149.99,
      "Sarah Connor",
      "sarah.c@cyberdyne.io",
      "Premium Noise Cancelling Headphones",
      "SKU-PNH-01",
      "paypal",
      "PayPal Express Checkout"
    ),
    completedSale(
      "TXN-8841-02",
      2,
      89.99,
      "Marcus Vance",
      "marcus@vancecorp.com",
      "Ergonomic Mechanical Keyboard",
      "SKU-EMK-02",
      "card",
      "Credit Card via PayPal"
    ),
    completedSale(
      "TXN-8841-03",
      3,
      119.99,
      "Elena Rostova",
      "elena@rostov.tech",
      "Ultra-Clear 4K Streaming Webcam",
      "SKU-UCW-03",
      "paypal"
    ),
    {
      id: "TXN-8841-04",
      date: new Date(Date.now() - 4 * 86400000).toISOString(),
      amount: 49.99,
      fee: 0,
      net: 49.99,
      currency: "USD",
      status: "PENDING",
      customerName: "David Kim",
      customerEmail: "dkim@innovate.kr",
      productName: "7-in-1 Aluminum USB-C Hub",
      productSku: "SKU-HUB-04",
      paymentMethod: "paylater",
      note: "Awaiting Pay Later settlement",
      source: "demo_sample",
    },
    {
      id: "TXN-8841-05",
      date: new Date(Date.now() - 6 * 86400000).toISOString(),
      amount: 179.99,
      fee: 0,
      net: 0,
      currency: "USD",
      status: "FAILED",
      customerName: "Arthur Dent",
      customerEmail: "arthur@galaxy.org",
      productName: "Mechanical Keyboard Pro",
      productSku: "SKU-MKP-05",
      paymentMethod: "card",
      note: "Card issuer declined transaction",
      source: "demo_sample",
    },
    {
      id: "TXN-8841-06",
      date: new Date(Date.now() - 8 * 86400000).toISOString(),
      amount: 149.99,
      fee: 0,
      net: -149.99,
      currency: "USD",
      status: "REFUNDED",
      customerName: "Chloe Bennett",
      customerEmail: "chloe@designhub.ca",
      productName: "Premium Noise Cancelling Headphones",
      productSku: "SKU-PNH-01",
      paymentMethod: "paypal",
      note: "Customer return within 14-day policy",
      source: "demo_sample",
    },
    completedSale(
      "TXN-8841-07",
      11,
      299.0,
      "Liam O'Connor",
      "liam@dublinfin.ie",
      "Commercial SaaS Analytics License",
      "SKU-LIC-07",
      "paypal"
    ),
    completedSale(
      "TXN-8841-08",
      14,
      59.99,
      "Amara Singh",
      "amara@singhventures.in",
      "Ergonomic Monitor Riser",
      "SKU-EMR-08",
      "venmo"
    ),
    completedSale(
      "TXN-8841-09",
      18,
      149.99,
      "Julian Weber",
      "jweber@berlineng.de",
      "Premium Noise Cancelling Headphones",
      "SKU-PNH-01",
      "paypal"
    ),
    completedSale(
      "TXN-8841-10",
      22,
      89.99,
      "Rachel Green",
      "rachel@centralperk.co",
      "Ergonomic Mechanical Keyboard",
      "SKU-EMK-02",
      "paypal"
    ),
  ];
}

function buildSeedInvoices(): Invoice[] {
  return [
    {
      id: "INV2-DEMO-001",
      invoiceNumber: "INV-1001",
      recipientName: "Acme Global Partners",
      recipientEmail: "finance@acmepartners.com",
      amount: 2500.0,
      currency: "USD",
      status: "SENT",
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      createdDate: new Date(Date.now() - 2 * 86400000).toISOString(),
      items: [
        {
          name: "Enterprise Merchant Intelligence License",
          quantity: 1,
          unitAmount: 2500.0,
          description: "Annual PaySight subscription tier",
        },
      ],
      source: "demo_sample",
    },
    {
      id: "INV2-DEMO-002",
      invoiceNumber: "INV-1002",
      recipientName: "Starlight Digital Media",
      recipientEmail: "billing@starlight.io",
      amount: 890.0,
      currency: "USD",
      status: "PAID",
      dueDate: new Date(Date.now() - 1 * 86400000).toISOString().split("T")[0],
      createdDate: new Date(Date.now() - 10 * 86400000).toISOString(),
      items: [
        {
          name: "Channel3 SKU Price Radar Integration",
          quantity: 1,
          unitAmount: 890.0,
          description: "Automated catalog tracking",
        },
      ],
      source: "demo_sample",
    },
  ];
}

function buildSeedExpenses(): MerchantExpense[] {
  const month = getCurrentMonthKey();
  const todayDay = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  return [
    {
      id: "EXP-DEMO-01",
      date: `${month}-02`,
      category: "inventory",
      description: "Audio & keyboard wholesale restock (demo)",
      amount: 320.0,
      currency: "USD",
      recurring: false,
      createdAt: now,
    },
    {
      id: "EXP-DEMO-02",
      date: `${month}-05`,
      category: "software",
      description: "Cloud hosting & analytics stack (demo)",
      amount: 79.0,
      currency: "USD",
      recurring: true,
      createdAt: now,
    },
    {
      id: "EXP-DEMO-03",
      date: todayDay,
      category: "shipping",
      description: "Carrier labels & fulfillment packaging (demo)",
      amount: 64.5,
      currency: "USD",
      recurring: false,
      createdAt: now,
    },
  ];
}

function buildSeedBudgetTargets(): MonthlyBudgetTarget[] {
  return [
    {
      month: getCurrentMonthKey(),
      currency: "USD",
      salesTarget: 1500.0,
      expenseBudget: 650.0,
      updatedAt: new Date().toISOString(),
    },
  ];
}

function createInitialDb(): DatabaseSchema {
  return {
    transactions: buildSeedTransactions(),
    invoices: buildSeedInvoices(),
    processedEvents: [],
    reconciledIds: [],
    expenses: buildSeedExpenses(),
    budgetTargets: buildSeedBudgetTargets(),
    lastUpdated: new Date().toISOString(),
  };
}

// ─── Cross-Process Synchronous File Lock & Atomic Writes ─────────────────────

const sleepBuffer = new Int32Array(new SharedArrayBuffer(4));

function sleepSync(ms: number): void {
  Atomics.wait(sleepBuffer, 0, 0, ms);
}

function withFileLock<T>(dbFile: string, fn: () => T): T {
  const dir = path.dirname(dbFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const lockFile = `${dbFile}.lock`;
  const maxAttempts = 400; // ~2 seconds max wait
  let acquired = false;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const fd = fs.openSync(lockFile, "wx");
      fs.writeSync(fd, `${process.pid}`);
      fs.closeSync(fd);
      acquired = true;
      break;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== "EEXIST") {
        throw err;
      }
      // Recover stale locks left by crashed processes (> 5s old)
      try {
        const stats = fs.statSync(lockFile);
        if (Date.now() - stats.mtimeMs > 5000) {
          fs.unlinkSync(lockFile);
          continue;
        }
      } catch {
        // Lock was released between checks
        continue;
      }
      sleepSync(5);
    }
  }

  if (!acquired) {
    throw new Error(`Timed out acquiring database lock for ${dbFile}`);
  }

  try {
    return fn();
  } finally {
    try {
      fs.unlinkSync(lockFile);
    } catch {
      // Ignore if already unlinked
    }
  }
}

function normalizeDbSchema(raw: Partial<DatabaseSchema>): DatabaseSchema {
  return {
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
    invoices: Array.isArray(raw.invoices) ? raw.invoices : [],
    processedEvents: Array.isArray(raw.processedEvents) ? raw.processedEvents : [],
    reconciledIds: Array.isArray(raw.reconciledIds) ? raw.reconciledIds : [],
    expenses: Array.isArray(raw.expenses) ? raw.expenses : buildSeedExpenses(),
    budgetTargets: Array.isArray(raw.budgetTargets)
      ? raw.budgetTargets
      : buildSeedBudgetTargets(),
    lastUpdated: typeof raw.lastUpdated === "string" ? raw.lastUpdated : new Date().toISOString(),
  };
}

function writeDbFile(dbFile: string, data: DatabaseSchema): void {
  const dir = path.dirname(dbFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tempFile = `${dbFile}.tmp.${process.pid}.${randomUUID()}`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tempFile, dbFile);
}

function readOrInitDbUnlocked(dbFile: string): DatabaseSchema {
  if (fs.existsSync(dbFile)) {
    try {
      const content = fs.readFileSync(dbFile, "utf-8");
      const parsed = JSON.parse(content) as Partial<DatabaseSchema>;
      return normalizeDbSchema(parsed);
    } catch (err) {
      // Preserve corrupted file instead of silently destroying it
      const backupPath = `${dbFile}.corrupt.${Date.now()}`;
      try {
        fs.copyFileSync(dbFile, backupPath);
        console.error(
          `[PaySight DB] Corrupted JSON detected; backed up to ${backupPath} before re-initializing:`,
          err
        );
      } catch {
        console.error("[PaySight DB] Corrupted JSON detected; re-initializing:", err);
      }
    }
  }

  const initial = createInitialDb();
  writeDbFile(dbFile, initial);
  return initial;
}

function readDb(): DatabaseSchema {
  const dbFile = getDbFilePath();
  if (fs.existsSync(dbFile)) {
    try {
      const content = fs.readFileSync(dbFile, "utf-8");
      return normalizeDbSchema(JSON.parse(content) as Partial<DatabaseSchema>);
    } catch {
      // Fall through to locked recovery
    }
  }
  return withFileLock(dbFile, () => readOrInitDbUnlocked(dbFile));
}

function mutateDb<T>(mutator: (db: DatabaseSchema) => T): T {
  const dbFile = getDbFilePath();
  return withFileLock(dbFile, () => {
    const db = readOrInitDbUnlocked(dbFile);
    const result = mutator(db);
    db.lastUpdated = new Date().toISOString();
    writeDbFile(dbFile, db);
    return result;
  });
}

// ─── Database Accessors ──────────────────────────────────────────────────────

export function getStoredTransactions(): Transaction[] {
  return readDb().transactions;
}

export function saveTransaction(txn: Transaction): void {
  mutateDb((db) => {
    const existingIdx = db.transactions.findIndex((t) => t.id === txn.id);
    if (existingIdx >= 0) {
      db.transactions[existingIdx] = txn;
    } else {
      db.transactions.unshift(txn);
    }
  });
}

export function saveTransactionsBatch(txns: Transaction[]): void {
  if (txns.length === 0) return;
  mutateDb((db) => {
    for (const txn of txns) {
      if (!txn.id) continue;
      const existingIdx = db.transactions.findIndex((t) => t.id === txn.id);
      if (existingIdx >= 0) {
        db.transactions[existingIdx] = txn;
      } else {
        db.transactions.unshift(txn);
      }
    }
  });
}

export function getStoredInvoices(): Invoice[] {
  return readDb().invoices;
}

export function getStoredInvoiceById(id: string): Invoice | undefined {
  return readDb().invoices.find((i) => i.id === id);
}

export function saveInvoice(inv: Invoice): void {
  mutateDb((db) => {
    const existingIdx = db.invoices.findIndex((i) => i.id === inv.id);
    if (existingIdx >= 0) {
      db.invoices[existingIdx] = inv;
    } else {
      db.invoices.unshift(inv);
    }
  });
}

export function isEventProcessed(eventId: string): boolean {
  return readDb().processedEvents.includes(eventId);
}

export function markEventProcessed(eventId: string): void {
  mutateDb((db) => {
    if (!db.processedEvents.includes(eventId)) {
      db.processedEvents.push(eventId);
    }
  });
}

export function isReconciled(id: string): boolean {
  return readDb().reconciledIds.includes(id);
}

export function markReconciled(id: string): void {
  mutateDb((db) => {
    if (!db.reconciledIds.includes(id)) {
      db.reconciledIds.push(id);
    }
  });
}

export function getStoredExpenses(currency?: string): MerchantExpense[] {
  const expenses = readDb().expenses;
  if (!currency) return expenses;
  const upper = currency.toUpperCase();
  return expenses.filter((e) => e.currency.toUpperCase() === upper);
}

export function saveExpense(expense: MerchantExpense): void {
  mutateDb((db) => {
    const idx = db.expenses.findIndex((e) => e.id === expense.id);
    if (idx >= 0) {
      db.expenses[idx] = expense;
    } else {
      db.expenses.unshift(expense);
    }
  });
}

export function deleteStoredExpense(id: string): boolean {
  return mutateDb((db) => {
    const before = db.expenses.length;
    db.expenses = db.expenses.filter((e) => e.id !== id);
    return db.expenses.length < before;
  });
}

export function getStoredBudgetTarget(
  month: string,
  currency = "USD"
): MonthlyBudgetTarget | undefined {
  const upper = currency.toUpperCase();
  return readDb().budgetTargets.find(
    (b) => b.month === month && b.currency.toUpperCase() === upper
  );
}

export function getAllStoredBudgetTargets(): MonthlyBudgetTarget[] {
  return readDb().budgetTargets;
}

export function saveBudgetTarget(target: MonthlyBudgetTarget): void {
  const upper = target.currency.toUpperCase();
  mutateDb((db) => {
    const idx = db.budgetTargets.findIndex(
      (b) => b.month === target.month && b.currency.toUpperCase() === upper
    );
    const normalized: MonthlyBudgetTarget = {
      ...target,
      currency: upper,
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) {
      db.budgetTargets[idx] = normalized;
    } else {
      db.budgetTargets.unshift(normalized);
    }
  });
}

export function getDbStats(): {
  transactionCount: number;
  invoiceCount: number;
  expenseCount: number;
  lastUpdated: string;
} {
  const db = readDb();
  return {
    transactionCount: db.transactions.length,
    invoiceCount: db.invoices.length,
    expenseCount: db.expenses.length,
    lastUpdated: db.lastUpdated,
  };
}

export const jsonStoreRepository: StoreRepository = {
  getTransactions: getStoredTransactions,
  saveTransaction,
  saveTransactionsBatch,
  getInvoices: getStoredInvoices,
  getInvoiceById: getStoredInvoiceById,
  saveInvoice,
  isEventProcessed,
  markEventProcessed,
  isReconciled,
  markReconciled,
  getExpenses: getStoredExpenses,
  saveExpense,
  deleteExpense: deleteStoredExpense,
  getBudgetTarget: getStoredBudgetTarget,
  saveBudgetTarget,
};
