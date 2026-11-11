/**
 * DEFERRED POSTGRESQL / NEON REPOSITORY ADAPTER DESIGN
 *
 * Status: DEFERRED (design + SQL migration delivered in db/migrations/001_init.sql).
 * Why deferred:
 *   The active PaySight runtime calls StoreRepository methods synchronously from
 *   src/lib/paypal/api.ts, src/lib/budget/service.ts, and src/app/api/webhooks/paypal/route.ts
 *   as well as all 8 automated test suites. Introducing an async Postgres driver without
 *   provisioning DATABASE_URL or migrating every service/test boundary to async calls would
 *   destabilize local JSON persistence and offline unit tests.
 *
 * Activation steps when moving beyond single-node JSON persistence:
 *   1. Install `@neondatabase/serverless` or `pg`.
 *   2. Run `db/migrations/001_init.sql` against your Neon PostgreSQL database.
 *   3. Set `DATABASE_URL` in production environment variables.
 *   4. Implement `AsyncStoreRepository` below with parameterized queries (`$1, $2...`)
 *      and `ON CONFLICT DO UPDATE` upserts, and convert repository callers to `await`.
 */

import type {
  Invoice,
  MerchantExpense,
  MonthlyBudgetTarget,
  Transaction,
} from "@/types";

export interface AsyncStoreRepository {
  getTransactions(): Promise<Transaction[]>;
  saveTransaction(txn: Transaction): Promise<void>;
  saveTransactionsBatch(txns: Transaction[]): Promise<void>;
  getInvoices(): Promise<Invoice[]>;
  getInvoiceById(id: string): Promise<Invoice | undefined>;
  saveInvoice(inv: Invoice): Promise<void>;
  isEventProcessed(eventId: string): Promise<boolean>;
  markEventProcessed(eventId: string): Promise<void>;
  isReconciled(id: string): Promise<boolean>;
  markReconciled(id: string): Promise<void>;
  getExpenses(currency?: string): Promise<MerchantExpense[]>;
  saveExpense(expense: MerchantExpense): Promise<void>;
  deleteExpense(id: string): Promise<boolean>;
  getBudgetTarget(month: string, currency?: string): Promise<MonthlyBudgetTarget | undefined>;
  saveBudgetTarget(target: MonthlyBudgetTarget): Promise<void>;
}

export interface PersistenceModeStatus {
  activeDriver: "json_file";
  databaseUrlConfigured: boolean;
  note: string;
}

export function getPersistenceMode(): PersistenceModeStatus {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  return {
    activeDriver: "json_file",
    databaseUrlConfigured: hasDatabaseUrl,
    note: hasDatabaseUrl
      ? "DATABASE_URL is set, but Postgres adapter activation is deferred pending async StoreRepository migration."
      : "Using file-locked local JSON persistence (.data/paysight-db.json).",
  };
}

