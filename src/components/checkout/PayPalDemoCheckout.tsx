"use client";

import { useState, useCallback, useEffect } from "react";
import {
  PayPalScriptProvider,
  PayPalButtons,
  usePayPalScriptReducer,
} from "@paypal/react-paypal-js";
import {
  ShoppingCart,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  PlayCircle,
} from "lucide-react";
import type { Transaction } from "@/types";
import { formatMoney } from "@/components/dashboard/StatusBadge";

interface CatalogProduct {
  id: string;
  name: string;
  amount: string;
  currency: string;
  description: string;
}

const FALLBACK_CATALOG: CatalogProduct[] = [
  {
    id: "demo_10",
    name: "PaySight Demo Product",
    amount: "10.00",
    currency: "USD",
    description: "[SANDBOX] PaySight $10 Demo — test payment, no real money",
  },
  {
    id: "sub_pro",
    name: "PaySight Pro Merchant Plan",
    amount: "49.00",
    currency: "USD",
    description: "[SANDBOX] Monthly AI analytics & real-time monitoring",
  },
  {
    id: "intel_add",
    name: "Channel3 Price Scanner Add-on",
    amount: "29.00",
    currency: "USD",
    description: "[SANDBOX] Competitor tracking for up to 10,000 SKUs",
  },
  {
    id: "exp_pack",
    name: "Agentic Invoicing Expansion",
    amount: "19.00",
    currency: "USD",
    description: "[SANDBOX] Automated invoice creation & dispute shields",
  },
];

interface ButtonAreaProps {
  productId: string;
  capturing: boolean;
  onCapturingChange: (c: boolean) => void;
  onSuccess: (txn: Transaction) => void;
  onError: (msg: string) => void;
  onCancel: () => void;
}

function PayPalButtonArea({
  productId,
  capturing,
  onCapturingChange,
  onSuccess,
  onError,
  onCancel,
}: ButtonAreaProps) {
  const [{ isPending, isRejected }] = usePayPalScriptReducer();

  const createOrder = useCallback(async () => {
    const res = await fetch("/api/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `Order creation failed (HTTP ${res.status})`);
    }
    const data = await res.json();
    return data.id as string;
  }, [productId]);

  const onApprove = useCallback(
    async (data: { orderID: string }) => {
      onCapturingChange(true);
      try {
        const res = await fetch("/api/orders/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: data.orderID,
            productId,
          }),
        });
        const captureData = await res.json();
        if (!res.ok || !captureData.success) {
          throw new Error(captureData.error ?? `Capture failed (HTTP ${res.status})`);
        }
        onSuccess(captureData.transaction as Transaction);
      } catch (err) {
        onError(err instanceof Error ? err.message : "Capture failed");
      } finally {
        onCapturingChange(false);
      }
    },
    [productId, onCapturingChange, onSuccess, onError]
  );

  if (isRejected) {
    return (
      <div className="flex items-start gap-2 text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-3">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">PayPal JS SDK failed to load</p>
          <p className="mt-0.5">
            Verify <code className="font-mono">NEXT_PUBLIC_PAYPAL_CLIENT_ID</code> and
            network access to <code className="font-mono">paypal.com</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {isPending ? (
        <div className="flex items-center justify-center gap-2 py-3 text-xs text-[#626262]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading PayPal SDK…
        </div>
      ) : (
        <PayPalButtons
          disabled={capturing}
          forceReRender={[productId]}
          style={{
            layout: "vertical",
            color: "gold",
            shape: "rect",
            label: "pay",
            height: 44,
          }}
          createOrder={createOrder}
          onApprove={onApprove}
          onCancel={onCancel}
          onError={(err) =>
            onError(String((err as Record<string, unknown>)?.message ?? "PayPal SDK error"))
          }
        />
      )}
    </div>
  );
}

interface PayPalDemoCheckoutProps {
  onPaymentSuccess?: (newTxn: Transaction) => void;
}

export function PayPalDemoCheckout({ onPaymentSuccess }: PayPalDemoCheckoutProps) {
  const [catalog, setCatalog] = useState<CatalogProduct[]>(FALLBACK_CATALOG);
  const [selectedId, setSelectedId] = useState<string>("demo_10");
  const [serverLive, setServerLive] = useState<boolean | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [lastTxn, setLastTxn] = useState<Transaction | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [cancelled, setCancelled] = useState(false);

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim() ?? "";

  useEffect(() => {
    fetch("/api/orders/create")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.products) && data.products.length > 0) {
          setCatalog(data.products);
        }
        if (typeof data?.isLive === "boolean") {
          setServerLive(data.isLive);
        }
      })
      .catch(() => setServerLive(false));
  }, []);

  const selectedProduct =
    catalog.find((p) => p.id === selectedId) ?? catalog[0] ?? FALLBACK_CATALOG[0];

  const handleSuccess = useCallback(
    (txn: Transaction) => {
      setLastTxn(txn);
      setErrorMessage("");
      setCancelled(false);
      onPaymentSuccess?.(txn);
    },
    [onPaymentSuccess]
  );

  const handleError = useCallback((msg: string) => {
    setErrorMessage(msg);
    setCancelled(false);
  }, []);

  const handleCancel = useCallback(() => {
    setCancelled(true);
    setErrorMessage("");
  }, []);

  const reset = () => {
    setLastTxn(null);
    setErrorMessage("");
    setCancelled(false);
    setCapturing(false);
  };

  // Explicit Zero-Config Demo Checkout (when PayPal credentials or clientId are absent)
  const executeDemoModeCheckout = async () => {
    setCapturing(true);
    setErrorMessage("");
    setCancelled(false);
    try {
      const createRes = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedProduct.id }),
      });
      const orderData = await createRes.json();
      if (!createRes.ok || !orderData.id) {
        throw new Error(orderData.error || "Demo order creation failed");
      }

      const captureRes = await fetch("/api/orders/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: orderData.id,
          productId: selectedProduct.id,
        }),
      });
      const captureData = await captureRes.json();
      if (!captureRes.ok || !captureData.success) {
        throw new Error(captureData.error || "Demo capture failed");
      }

      handleSuccess(captureData.transaction as Transaction);
    } catch (err) {
      handleError(err instanceof Error ? err.message : "Demo checkout failed");
    } finally {
      setCapturing(false);
    }
  };

  const canRunLivePayPal = Boolean(clientId) && serverLive !== false;

  const checkoutBody = (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#F7F7F8] border border-[#E5E5E5] text-[#171717] flex items-center justify-center">
            <ShoppingCart className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#171717]">
              {canRunLivePayPal ? "PayPal Sandbox Checkout" : "Demo Checkout Simulation"}
            </h3>
            <p className="text-xs text-[#626262]">
              {canRunLivePayPal
                ? "Server-priced SKUs · Buyer popup approval · Verified capture"
                : "Server-priced SKUs · Local Demo Mode simulation (no PayPal charges)"}
            </p>
          </div>
        </div>
        <span
          className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border flex-shrink-0 ${
            canRunLivePayPal
              ? "bg-[#ECFDF3] text-[#15803D] border-[#BBF7D0]"
              : "bg-[#FFF3EB] text-[#C2410C] border-[#FED7AA]"
          }`}
        >
          {canRunLivePayPal ? "PayPal Sandbox" : "Demo Mode"}
        </span>
      </div>

      {/* Authoritative Server Catalog SKU Selector */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#626262]">
          Select Server-Verified Catalog Item
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {catalog.map((item) => {
            const active = item.id === selectedProduct.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={capturing}
                onClick={() => {
                  setSelectedId(item.id);
                  setLastTxn(null);
                  setErrorMessage("");
                }}
                className={`p-3 rounded-lg border text-left transition-all flex items-start justify-between gap-2 ${
                  active
                    ? "bg-[#FFF3EB] border-[#C2410C]"
                    : "bg-[#F7F7F8] border-[#E5E5E5] hover:border-[#D4D4D4]"
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#171717] truncate">
                    {item.name}
                  </div>
                  <div className="text-[11px] text-[#626262] line-clamp-2 mt-0.5">
                    {item.description}
                  </div>
                </div>
                <span className="text-xs font-bold font-mono text-[#C2410C] whitespace-nowrap">
                  ${item.amount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Selection Summary */}
      <div className="bg-[#F7F7F8] border border-[#E5E5E5] rounded-lg p-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#171717]">{selectedProduct.name}</p>
          <p className="text-[11px] font-mono text-[#626262]">SKU: {selectedProduct.id}</p>
        </div>
        <p className="text-sm font-bold text-[#C2410C] font-mono tabular-nums">
          ${selectedProduct.amount} {selectedProduct.currency}
        </p>
      </div>

      {lastTxn && <SuccessPanel txn={lastTxn} onReset={reset} />}

      {!lastTxn && (
        <>
          {capturing && (
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-[#626262]">
              <Loader2 className="w-4 h-4 animate-spin text-[#C2410C]" />
              <span>Verifying and capturing payment on server…</span>
            </div>
          )}

          {cancelled && !capturing && (
            <div className="flex items-center gap-2 text-xs text-[#626262] bg-[#F7F7F8] border border-[#E5E5E5] rounded-lg px-3 py-2">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              Payment cancelled — no charge was made.
            </div>
          )}

          {errorMessage && !capturing && (
            <div className="flex items-start gap-2 text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {canRunLivePayPal ? (
            <>
              <ol className="text-[11px] text-[#626262] list-decimal list-inside space-y-0.5 leading-relaxed">
                <li>Click the PayPal button to open the PayPal Sandbox buyer popup.</li>
                <li>Log in with your personal sandbox buyer account and approve payment.</li>
                <li>The server verifies amount, currency, and captures into your ledger.</li>
              </ol>

              <PayPalButtonArea
                productId={selectedProduct.id}
                capturing={capturing}
                onCapturingChange={setCapturing}
                onSuccess={handleSuccess}
                onError={handleError}
                onCancel={handleCancel}
              />
            </>
          ) : (
            <div className="space-y-3">
              <div className="text-[11px] text-[#626262] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-3">
                PayPal Sandbox credentials are not active on both client and server. Running in{" "}
                <strong>Demo Mode Simulation</strong> — simulated captures are clearly marked{" "}
                <code className="font-mono">demo_sample</code> in the ledger.
              </div>
              <button
                type="button"
                disabled={capturing}
                onClick={executeDemoModeCheckout}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <PlayCircle className="w-4 h-4" />
                <span>
                  Execute Demo Mode Checkout (${selectedProduct.amount} {selectedProduct.currency})
                </span>
              </button>
            </div>
          )}
        </>
      )}

      <p className="text-[10px] text-center text-[#626262] border-t border-[#E5E5E5] pt-3">
        Prices are always resolved server-side from <code className="font-mono">SANDBOX_PRODUCTS</code>.
        No real funds are collected in Sandbox or Demo Mode.
      </p>
    </div>
  );

  if (!canRunLivePayPal) {
    return checkoutBody;
  }

  return (
    <PayPalScriptProvider
      options={{
        clientId,
        currency: selectedProduct.currency,
        intent: "capture",
        components: "buttons",
      }}
    >
      {checkoutBody}
    </PayPalScriptProvider>
  );
}

function SuccessPanel({ txn, onReset }: { txn: Transaction; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-3 border border-[#BBF7D0] bg-[#F0FDF4] rounded-xl px-4">
      <CheckCircle2 className="w-10 h-10 text-[#15803D]" />
      <div>
        <p className="text-sm font-semibold text-[#171717]">
          {txn.source === "paypal_sandbox"
            ? "Sandbox Payment Captured & Verified"
            : "Demo Simulation Recorded"}
        </p>
        <p className="text-[11px] text-[#626262] mt-0.5">
          Added cleanly to your transaction ledger
        </p>
      </div>

      <div className="w-full bg-white border border-[#E5E5E5] rounded-lg p-3 text-left space-y-1.5 text-xs">
        <Row label="Capture ID" value={txn.id} mono />
        <Row label="Product" value={txn.productName} />
        <Row label="Amount" value={formatMoney(txn.amount, txn.currency)} mono />
        {txn.fee != null && <Row label="PayPal Fee" value={formatMoney(txn.fee, txn.currency)} mono />}
        {txn.net != null && <Row label="Net Settlement" value={formatMoney(txn.net, txn.currency)} mono />}
        <Row label="Status" value={txn.status} />
        <Row
          label="Source"
          value={txn.source === "paypal_sandbox" ? "PayPal Sandbox API" : "Demo Sample Store"}
        />
      </div>

      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center gap-1.5 text-xs text-[#C2410C] hover:text-[#9A3412] font-medium"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Run another checkout test
      </button>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[#626262] flex-shrink-0">{label}</span>
      <span className={`text-[#171717] text-right break-all ${mono ? "font-mono tabular-nums" : ""}`}>
        {value}
      </span>
    </div>
  );
}
