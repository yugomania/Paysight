export interface SandboxProduct {
  id: string;
  name: string;
  amount: string;
  numericAmount: number;
  currency: string;
  description: string;
}

/**
 * Authoritative Server-Side Product Catalog.
 * Amounts and currencies are resolved strictly server-side — never trusted from the browser.
 */
export const SANDBOX_PRODUCTS: Record<string, SandboxProduct> = {
  demo_10: {
    id: "demo_10",
    name: "PaySight Demo Product",
    amount: "10.00",
    numericAmount: 10.0,
    currency: "USD",
    description: "[SANDBOX] PaySight $10 Demo — test payment, no real money",
  },
  sub_pro: {
    id: "sub_pro",
    name: "PaySight Pro Merchant Plan",
    amount: "49.00",
    numericAmount: 49.0,
    currency: "USD",
    description: "[SANDBOX] Monthly AI analytics & real-time monitoring",
  },
  intel_add: {
    id: "intel_add",
    name: "Channel3 Price Scanner Add-on",
    amount: "29.00",
    numericAmount: 29.0,
    currency: "USD",
    description: "[SANDBOX] Competitor tracking for up to 10,000 SKUs",
  },
  exp_pack: {
    id: "exp_pack",
    name: "Agentic Invoicing Expansion",
    amount: "19.00",
    numericAmount: 19.0,
    currency: "USD",
    description: "[SANDBOX] Automated invoice creation & dispute shields",
  },
};

export function resolveSandboxProduct(productId?: string): SandboxProduct | null {
  if (!productId || !productId.trim()) {
    return SANDBOX_PRODUCTS.demo_10;
  }
  return SANDBOX_PRODUCTS[productId.trim()] ?? null;
}

export function extractPayPalSdkError(
  err: unknown,
  fallbackMessage = "PayPal API request failed"
): { message: string; debugId?: string } {
  let message = fallbackMessage;
  let debugId: string | undefined;

  if (err && typeof err === "object") {
    const sdkErr = err as Record<string, unknown>;
    let result = sdkErr.result as Record<string, unknown> | undefined;
    if (!result && typeof sdkErr.body === "string" && sdkErr.body.trim().startsWith("{")) {
      try {
        result = JSON.parse(sdkErr.body) as Record<string, unknown>;
      } catch {
        // Ignore unparseable body
      }
    }
    const headers = sdkErr.headers as Record<string, string> | undefined;
    debugId = headers?.["paypal-debug-id"] ?? (typeof result?.debug_id === "string" ? result.debug_id : undefined);

    if (result?.error_description && typeof result.error_description === "string") {
      message = `${String(result.error ?? "error")}: ${result.error_description}`;
    } else if (result?.message && typeof result.message === "string") {
      message = result.message;
      const details = result.details as Array<Record<string, string>> | undefined;
      if (details?.[0]?.issue) {
        message = `${details[0].issue}: ${details[0].description ?? result.message}`;
      }
    } else if (
      sdkErr.message &&
      typeof sdkErr.message === "string" &&
      sdkErr.message.trim() &&
      sdkErr.message.trim() !== "The error response."
    ) {
      message = sdkErr.message;
    } else if (typeof sdkErr.statusCode === "number") {
      message = `PayPal API error (HTTP ${sdkErr.statusCode})`;
    }
  }

  return { message, debugId };
}

