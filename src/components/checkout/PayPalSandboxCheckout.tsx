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

interface PayPalSandboxCheckoutProps {
  onPaymentSuccess?: (newTxn: Transaction) => void;
}

export function PayPalSandboxCheckout({ onPaymentSuccess }: PayPalSandboxCheckoutProps) {
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("starter_10");
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
          setSelectedId(data.products[0].id);
        }
        if (typeof data?.isLive === "boolean") {
          setServerLive(data.isLive);
        }
      })
      .catch(() => {
        setServerLive(false);
        setErrorMessage("Unable to load PayPal Sandbox checkout catalog from server.");
      })
      .finally(() => setLoadingCatalog(false));
  }, []);

  const selectedProduct = catalog.find((p) => p.id === selectedId) ?? catalog[0] ?? null;

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

  const canRunLivePayPal = Boolean(clientId) && serverLive === true && Boolean(selectedProduct);

  const checkoutBody = (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#F7F7F8] border border-[#E5E5E5] text-[#171717] flex items-center justify-center">
            <ShoppingCart className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#171717]">PayPal Sandbox Checkout</h3>
            <p className="text-xs text-[#626262]">
              Server-priced SKUs · Buyer popup approval · Verified capture
            </p>
          </div>
        </div>
        <span
          className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border flex-shrink-0 ${
            canRunLivePayPal
              ? "bg-[#ECFDF3] text-[#15803D] border-[#BBF7D0]"
              : "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]"
          }`}
        >
          {canRunLivePayPal ? "PayPal Sandbox" : serverLive === null ? "Checking…" : "Unconfigured"}
        </span>
      </div>

      {loadingCatalog ? (
        <div className="py-8 flex items-center justify-center gap-2 text-xs text-[#626262]">
          <Loader2 className="w-4 h-4 animate-spin text-[#C2410C]" />
          Loading server product catalog…
        </div>
      ) : (
        <>
          {catalog.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#626262]">
                Select Server-Verified Catalog Item
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {catalog.map((item) => {
                  const active = item.id === selectedProduct?.id;
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
          )}

          {selectedProduct && (
            <div className="bg-[#F7F7F8] border border-[#E5E5E5] rounded-lg p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#171717]">{selectedProduct.name}</p>
                <p className="text-[11px] font-mono text-[#626262]">SKU: {selectedProduct.id}</p>
              </div>
              <p className="text-sm font-bold text-[#C2410C] font-mono tabular-nums">
                ${selectedProduct.amount} {selectedProduct.currency}
              </p>
            </div>
          )}

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

              {canRunLivePayPal && selectedProduct ? (
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
                <div className="flex items-start gap-2 text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">PayPal Sandbox Checkout is not configured</p>
                    <p className="mt-0.5">
                      Set <code className="font-mono">PAYPAL_CLIENT_ID</code>,{" "}
                      <code className="font-mono">PAYPAL_CLIENT_SECRET</code>, and{" "}
                      <code className="font-mono">NEXT_PUBLIC_PAYPAL_CLIENT_ID</code> in{" "}
                      <code className="font-mono">.env.local</code> to enable live buyer approval.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <p className="text-[10px] text-center text-[#626262] border-t border-[#E5E5E5] pt-3">
        Prices are resolved server-side from <code className="font-mono">SANDBOX_PRODUCTS</code>.
        Orders execute live against PayPal Sandbox.
      </p>
    </div>
  );

  if (!canRunLivePayPal || !selectedProduct) {
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
          Sandbox Payment Captured &amp; Verified
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
        <Row label="Source" value="PayPal Sandbox API" />
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
      <span className="text-[#626262]">{label}:</span>
      <span className={`font-medium text-[#171717] text-right ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

