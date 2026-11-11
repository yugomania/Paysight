-- PaySight PostgreSQL / Neon Production Schema (001_init)
-- Mirrors src/types/index.ts and src/lib/db/index.ts DatabaseSchema cleanly.

CREATE TABLE IF NOT EXISTS paysight_transactions (
  id TEXT PRIMARY KEY,
  txn_date TIMESTAMPTZ NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  fee NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  net NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('COMPLETED', 'PENDING', 'FAILED', 'REFUNDED', 'DENIED')),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('paypal', 'card', 'paylater', 'venmo')),
  invoice_id TEXT,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'paypal_sandbox' CHECK (source IN ('paypal_sandbox', 'demo_sample')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paysight_transactions_date_currency
  ON paysight_transactions (txn_date DESC, currency);

CREATE TABLE IF NOT EXISTS paysight_invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'SENT', 'PAID', 'CANCELLED', 'REFUNDED')),
  due_date TEXT NOT NULL DEFAULT '',
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  note TEXT,
  payment_url TEXT,
  source TEXT NOT NULL DEFAULT 'paypal_sandbox' CHECK (source IN ('paypal_sandbox', 'demo_sample')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paysight_invoices_status_due
  ON paysight_invoices (status, due_date);

CREATE TABLE IF NOT EXISTS paysight_processed_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paysight_reconciled_ids (
  capture_id TEXT PRIMARY KEY,
  reconciled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paysight_expenses (
  id TEXT PRIMARY KEY,
  expense_date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('inventory', 'marketing', 'software', 'shipping', 'operations', 'taxes', 'other')),
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  recurring BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paysight_expenses_month_currency
  ON paysight_expenses (expense_date DESC, currency);

CREATE TABLE IF NOT EXISTS paysight_budget_targets (
  month CHAR(7) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  sales_target NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (sales_target >= 0),
  expense_budget NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (expense_budget >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (month, currency)
);

