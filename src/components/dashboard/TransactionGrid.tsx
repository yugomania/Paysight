"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridReadyEvent, ICellRendererParams, RowClickedEvent } from "ag-grid-community";
import type { Transaction } from "@/types";
import { format, parseISO } from "date-fns";
import { Download, Search, Sparkles, X } from "lucide-react";
import {
  ensureAgGridRegistered,
  formatMoney,
  TransactionStatusBadge,
} from "./StatusBadge";

ensureAgGridRegistered();

function StatusDotRenderer({ value }: ICellRendererParams) {
  return (
    <div className="flex items-center h-full">
      <TransactionStatusBadge status={String(value ?? "")} />
    </div>
  );
}

function AmountCellRenderer({ data }: ICellRendererParams<Transaction>) {
  if (!data) return null;
  return (
    <div className="flex items-center h-full">
      <span className="font-mono tabular-nums font-semibold text-[#171717] text-xs">
        {formatMoney(data.amount, data.currency)}
      </span>
    </div>
  );
}

function MethodCellRenderer({ value }: ICellRendererParams) {
  const methodMap: Record<string, string> = {
    paypal: "PayPal",
    card: "Debit/Credit",
    paylater: "Pay Later",
    venmo: "Venmo",
  };
  const label = methodMap[String(value ?? "")] ?? String(value ?? "Other");
  return (
    <div className="flex items-center h-full text-xs">
      <span className="font-medium text-[#171717]">{label}</span>
    </div>
  );
}

interface TransactionGridProps {
  transactions: Transaction[];
  loading: boolean;
  externalSearch?: string;
  onSummarizeTransactions?: () => void;
}

type FilterTab = "ALL" | "COMPLETED" | "PENDING" | "RISK";

export function TransactionGrid({
  transactions,
  loading,
  externalSearch = "",
  onSummarizeTransactions,
}: TransactionGridProps) {
  const gridRef = useRef<AgGridReact<Transaction>>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  const [localSearch, setLocalSearch] = useState("");
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedTxn) {
        setSelectedTxn(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedTxn]);

  const filteredData = useMemo(() => {
    let list = transactions;

    if (activeFilter === "COMPLETED") {
      list = list.filter((t) => t.status === "COMPLETED");
    } else if (activeFilter === "PENDING") {
      list = list.filter((t) => t.status === "PENDING");
    } else if (activeFilter === "RISK") {
      list = list.filter(
        (t) => t.status === "FAILED" || t.status === "DENIED" || t.status === "REFUNDED"
      );
    }

    const matchesQuery = (t: Transaction, q: string) =>
      t.id.toLowerCase().includes(q) ||
      t.customerName.toLowerCase().includes(q) ||
      t.customerEmail.toLowerCase().includes(q) ||
      t.productName.toLowerCase().includes(q) ||
      t.currency.toLowerCase().includes(q);

    const extQ = externalSearch.trim().toLowerCase();
    const locQ = localSearch.trim().toLowerCase();

    if (extQ) {
      list = list.filter((t) => matchesQuery(t, extQ));
    }
    if (locQ) {
      list = list.filter((t) => matchesQuery(t, locQ));
    }

    return list;
  }, [transactions, activeFilter, externalSearch, localSearch]);

  const columnDefs = useMemo<ColDef<Transaction>[]>(
    () => [
      {
        field: "date",
        headerName: "Timestamp",
        width: 140,
        sortable: true,
        sort: "desc",
        valueFormatter: ({ value }) => {
          try {
            return format(parseISO(value), "MMM d, HH:mm");
          } catch {
            return value;
          }
        },
        cellClass: "text-[#626262] text-xs flex items-center font-medium",
      },
      {
        field: "id",
        headerName: "Order / Capture ID",
        width: 155,
        cellClass: "text-[#171717] text-xs font-mono flex items-center",
      },
      {
        field: "customerName",
        headerName: "Customer",
        flex: 1,
        minWidth: 160,
        cellRenderer: ({ data }: ICellRendererParams<Transaction>) => (
          <div className="flex flex-col justify-center h-full">
            <span className="text-xs font-semibold text-[#171717] leading-tight">
              {data?.customerName}
            </span>
            <span className="text-[11px] text-[#626262] truncate leading-tight">
              {data?.customerEmail}
            </span>
          </div>
        ),
      },
      {
        field: "productName",
        headerName: "Purchased Product",
        flex: 1,
        minWidth: 170,
        cellClass: "text-[#171717] text-xs flex items-center font-medium",
      },
      {
        field: "amount",
        headerName: "Amount",
        width: 120,
        sortable: true,
        cellRenderer: AmountCellRenderer,
      },
      {
        field: "currency",
        headerName: "CCY",
        width: 75,
        cellClass: "text-[#626262] text-xs font-mono flex items-center",
      },
      {
        field: "status",
        headerName: "Payment Status",
        width: 140,
        cellRenderer: StatusDotRenderer,
      },
      {
        field: "paymentMethod",
        headerName: "Rail",
        width: 115,
        cellRenderer: MethodCellRenderer,
      },
    ],
    []
  );

  const onGridReady = useCallback((params: GridReadyEvent) => {
    params.api.sizeColumnsToFit();
  }, []);

  const exportCSV = useCallback(() => {
    gridRef.current?.api.exportDataAsCsv({ fileName: "paysight-ledger.csv" });
  }, []);

  const counts = useMemo(
    () => ({
      all: transactions.length,
      completed: transactions.filter((t) => t.status === "COMPLETED").length,
      pending: transactions.filter((t) => t.status === "PENDING").length,
      risk: transactions.filter(
        (t) => t.status === "FAILED" || t.status === "DENIED" || t.status === "REFUNDED"
      ).length,
    }),
    [transactions]
  );

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden flex flex-col">
      <div className="p-4 border-b border-[#E5E5E5] flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center p-1 bg-[#F7F7F8] rounded-lg border border-[#E5E5E5] text-xs">
          <button
            type="button"
            onClick={() => setActiveFilter("ALL")}
            className={`px-3 py-1.5 rounded font-medium transition-colors ${
              activeFilter === "ALL"
                ? "bg-white text-[#171717] border border-[#E5E5E5] shadow-xs font-semibold"
                : "text-[#626262] hover:text-[#171717]"
            }`}
          >
            All <span className="opacity-70 ml-0.5 text-[10px]">({counts.all})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("COMPLETED")}
            className={`px-3 py-1.5 rounded font-medium transition-colors ${
              activeFilter === "COMPLETED"
                ? "bg-white text-[#171717] border border-[#E5E5E5] shadow-xs font-semibold"
                : "text-[#626262] hover:text-[#171717]"
            }`}
          >
            Completed <span className="opacity-70 ml-0.5 text-[10px]">({counts.completed})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("PENDING")}
            className={`px-3 py-1.5 rounded font-medium transition-colors ${
              activeFilter === "PENDING"
                ? "bg-white text-[#171717] border border-[#E5E5E5] shadow-xs font-semibold"
                : "text-[#626262] hover:text-[#171717]"
            }`}
          >
            Pending <span className="opacity-70 ml-0.5 text-[10px]">({counts.pending})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("RISK")}
            className={`px-3 py-1.5 rounded font-medium transition-colors ${
              activeFilter === "RISK"
                ? "bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] shadow-xs font-semibold"
                : "text-[#626262] hover:text-[#B91C1C]"
            }`}
          >
            Exceptions <span className="opacity-70 ml-0.5 text-[10px]">({counts.risk})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#626262]" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Filter ledger..."
              aria-label="Filter transaction ledger"
              className="bg-white border border-[#E5E5E5] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#171717] placeholder:text-[#626262] focus:outline-none focus:ring-2 focus:ring-[#FFF3EB] focus:border-[#C2410C] w-36 sm:w-48"
            />
          </div>

          {onSummarizeTransactions && (
            <button
              type="button"
              onClick={onSummarizeTransactions}
              title="Summarise transactions with PaySight Copilot"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFF3EB] hover:bg-[#FFE7D6] text-[#C2410C] border border-[#FED7AA] text-xs font-semibold shadow-xs transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#C2410C]" />
              <span className="hidden sm:inline">Summarise with AI</span>
            </button>
          )}

          <button
            type="button"
            onClick={exportCSV}
            title="Export to CSV"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-[#F7F7F8] text-[#171717] border border-[#E5E5E5] text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      <div className="ag-theme-quartz" style={{ height: 420, width: "100%" }}>
        <AgGridReact<Transaction>
          theme="legacy"
          ref={gridRef}
          rowData={loading ? null : filteredData}
          columnDefs={columnDefs}
          defaultColDef={{ resizable: true, suppressMovable: false }}
          onGridReady={onGridReady}
          onRowClicked={(e: RowClickedEvent<Transaction>) => {
            if (e.data) setSelectedTxn(e.data);
          }}
          pagination
          paginationPageSize={10}
          paginationPageSizeSelector={[10, 20, 50, 100]}
          loading={loading}
          overlayLoadingTemplate='<span class="text-[#626262] text-xs">Accessing transaction ledger…</span>'
          overlayNoRowsTemplate='<span class="text-[#626262] text-xs">No records matching active filter</span>'
          animateRows
        />
      </div>

      <div className="px-4 py-2 bg-white border-t border-[#E5E5E5] text-[11px] text-[#626262] flex items-center justify-between">
        <span>Showing {filteredData.length} of {transactions.length} transactions</span>
        <span className="font-medium text-[#171717]">Click any row for settlement breakdown</span>
      </div>

      {/* Transaction Detail Modal */}
      {selectedTxn && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Transaction ${selectedTxn.id}`}
          onClick={() => setSelectedTxn(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white border border-[#E5E5E5] rounded-xl shadow-xl overflow-hidden text-xs"
          >
            <div className="px-5 py-3.5 border-b border-[#E5E5E5] flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-[#171717]">Transaction Detail</h4>
                <p className="text-[11px] font-mono text-[#626262]">{selectedTxn.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTxn(null)}
                aria-label="Close transaction detail"
                className="p-1.5 rounded-lg text-[#626262] hover:text-[#171717] hover:bg-[#F7F7F8]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <TransactionStatusBadge status={selectedTxn.status} />
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#F7F7F8] border border-[#E5E5E5] text-[#171717]">
                  {selectedTxn.source === "paypal_live" ? "PayPal Live" : "PayPal Sandbox"}
                </span>
              </div>

              <div className="bg-[#F7F7F8] border border-[#E5E5E5] rounded-lg p-3 space-y-1.5">
                <DetailRow label="Gross Amount" value={formatMoney(selectedTxn.amount, selectedTxn.currency)} mono />
                <DetailRow
                  label="PayPal Fee"
                  value={formatMoney(selectedTxn.fee ?? 0, selectedTxn.currency)}
                  mono
                />
                <DetailRow
                  label="Net Settlement"
                  value={formatMoney(
                    selectedTxn.net ?? selectedTxn.amount - (selectedTxn.fee ?? 0),
                    selectedTxn.currency
                  )}
                  mono
                />
                <DetailRow label="Currency" value={selectedTxn.currency} mono />
                <DetailRow label="Payment Method" value={selectedTxn.paymentMethod} />
              </div>

              <div className="space-y-1.5">
                <DetailRow label="Customer" value={selectedTxn.customerName} />
                <DetailRow label="Email" value={selectedTxn.customerEmail} mono />
                <DetailRow label="Product" value={selectedTxn.productName} />
                {selectedTxn.productSku && (
                  <DetailRow label="SKU" value={selectedTxn.productSku} mono />
                )}
                {selectedTxn.invoiceId && (
                  <DetailRow label="Invoice ID" value={selectedTxn.invoiceId} mono />
                )}
                <DetailRow label="Timestamp (UTC)" value={selectedTxn.date} mono />
                {selectedTxn.note && <DetailRow label="Note" value={selectedTxn.note} />}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[#626262] flex-shrink-0">{label}</span>
      <span className={`text-[#171717] text-right break-all ${mono ? "font-mono" : "font-medium"}`}>
        {value}
      </span>
    </div>
  );
}
