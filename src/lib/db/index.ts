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

function createInitialDb(): DatabaseSchema {
  return {
    transactions: [],
    invoices: [],
    processedEvents: [],
    reconciledIds: [],
    expenses: [],
    budgetTargets: [],
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
  const txns = Array.isArray(raw.transactions)
    ? raw.transactions.filter((t) => (t as { source?: string })?.source !== "demo_sample")
    : [];
  const invs = Array.isArray(raw.invoices)
    ? raw.invoices.filter(
        (i) => (i as { source?: string })?.source !== "demo_sample" && !i.id?.startsWith("INV2-DEMO-")
      )
    : [];
  const exps = Array.isArray(raw.expenses)
    ? raw.expenses.filter((e) => !e.id?.startsWith("EXP-DEMO-"))
    : [];

  return {
    transactions: txns,
    invoices: invs,
    processedEvents: Array.isArray(raw.processedEvents) ? raw.processedEvents : [],
    reconciledIds: Array.isArray(raw.reconciledIds) ? raw.reconciledIds : [],
    expenses: exps,
    budgetTargets: Array.isArray(raw.budgetTargets) ? raw.budgetTargets : [],
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
