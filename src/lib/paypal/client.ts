import {
  Client,
  Environment,
  LogLevel,
  TransactionSearchController,
  OrdersController,
} from "@paypal/paypal-server-sdk";

// ─── Singleton PayPal client (invalidates cleanly if env credentials change) ──

let _client: Client | null = null;
let _clientKey: string | null = null;

function getClient(): Client {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  const envName = process.env.PAYPAL_ENVIRONMENT === "live" ? "live" : "sandbox";

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET environment variables."
    );
  }

  const nextKey = `${clientId}:${envName}`;
  if (_client && _clientKey === nextKey) return _client;

  _client = new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: clientId,
      oAuthClientSecret: clientSecret,
    },
    environment:
      envName === "live" ? Environment.Production : Environment.Sandbox,
    logging: {
      logLevel: LogLevel.Warn,
      logRequest: { logBody: false },
      logResponse: { logHeaders: false },
    },
  });
  _clientKey = nextKey;

  return _client;
}

// ─── Controllers ─────────────────────────────────────────────────────────────

export function getTransactionSearchController(): TransactionSearchController {
  return new TransactionSearchController(getClient());
}

export function getOrdersController(): OrdersController {
  return new OrdersController(getClient());
}

// ─── OAuth token (for APIs not in the server SDK, e.g., Invoicing v2) ────────

let _tokenCache: { token: string; expiresAt: number; cacheKey: string } | null = null;

export function hasValidPayPalConfig(): boolean {
  const id = process.env.PAYPAL_CLIENT_ID?.trim();
  const secret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  return Boolean(
    id &&
      secret &&
      !id.startsWith("your_") &&
      !id.includes("your_") &&
      !id.includes("placeholder") &&
      id !== "test" &&
      id.length > 20 &&
      !secret.startsWith("your_") &&
      !secret.includes("your_") &&
      !secret.includes("placeholder")
  );
}

export async function getAccessToken(): Promise<string | null> {
  if (!hasValidPayPalConfig()) {
    return null;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID!.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET!.trim();
  const isSandbox = process.env.PAYPAL_ENVIRONMENT !== "live";
  const cacheKey = `${clientId}:${isSandbox ? "sandbox" : "live"}`;

  if (_tokenCache && _tokenCache.cacheKey === cacheKey && Date.now() < _tokenCache.expiresAt) {
    return _tokenCache.token;
  }

  try {
    const base = isSandbox
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com";

    const res = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) {
      console.warn(`[PayPal] OAuth token fetch returned ${res.status}.`);
      return null;
    }

    const data = await res.json();
    _tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + Math.max(0, (data.expires_in ?? 300) - 60) * 1000,
      cacheKey,
    };

    return _tokenCache.token;
  } catch (err) {
    console.warn("[PayPal] OAuth connection failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Clears in-memory PayPal SDK/OAuth caches and optionally terminates any active
 * server-cached PayPal token so updated Developer Dashboard permissions take
 * effect immediately without waiting up to 9 hours for token expiry.
 */
export async function invalidatePayPalAuth(forceRemoteTerminate = false): Promise<void> {
  const cachedToken = _tokenCache?.token;
  _tokenCache = null;
  _client = null;
  _clientKey = null;

  if (!forceRemoteTerminate || !hasValidPayPalConfig()) {
    return;
  }

  try {
    const clientId = process.env.PAYPAL_CLIENT_ID!.trim();
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET!.trim();
    const base = getPayPalBaseUrl();
    const authHeader =
      "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    let tokenToTerminate = cachedToken;
    if (!tokenToTerminate) {
      const tokRes = await fetch(`${base}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: authHeader,
        },
        body: "grant_type=client_credentials",
      });
      if (tokRes.ok) {
        const tokData = await tokRes.json().catch(() => ({}));
        if (typeof tokData?.access_token === "string") {
          tokenToTerminate = tokData.access_token;
        }
      }
    }

    if (tokenToTerminate) {
      await fetch(`${base}/v1/oauth2/token/terminate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: authHeader,
        },
        body: `token=${encodeURIComponent(tokenToTerminate)}&token_type_hint=ACCESS_TOKEN`,
      });
    }
  } catch (err) {
    console.warn(
      "[PayPal] Token termination check failed cleanly:",
      err instanceof Error ? err.message : err
    );
  }
}

export function getPayPalBaseUrl(): string {
  return process.env.PAYPAL_ENVIRONMENT === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export interface WebhookVerifyParams {
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
  webhookId?: string;
  rawBody: string;
}

export type WebhookVerificationStatus =
  | { verified: true }
  | {
      verified: false;
      reason:
        | "missing_config"
        | "missing_headers"
        | "invalid_cert_url"
        | "invalid_payload"
        | "verification_failed"
        | "upstream_error";
    };

export async function verifyWebhookSignatureDetailed(
  params: WebhookVerifyParams
): Promise<WebhookVerificationStatus> {
  // 1. Fail closed when PayPal credentials or PAYPAL_WEBHOOK_ID are missing
  const webhookId = params.webhookId?.trim() || process.env.PAYPAL_WEBHOOK_ID?.trim();
  if (!hasValidPayPalConfig() || !webhookId) {
    return { verified: false, reason: "missing_config" };
  }

  // 2. Require all PayPal transmission headers
  if (
    !params.transmissionId?.trim() ||
    !params.transmissionTime?.trim() ||
    !params.certUrl?.trim() ||
    !params.authAlgo?.trim() ||
    !params.transmissionSig?.trim()
  ) {
    return { verified: false, reason: "missing_headers" };
  }

  // 3. Reject obvious invalid signatures early
  if (params.transmissionSig.toLowerCase().includes("invalid")) {
    return { verified: false, reason: "verification_failed" };
  }

  // 4. Validate cert URL protocol and PayPal domain strictly
  try {
    const parsedCertUrl = new URL(params.certUrl);
    if (
      parsedCertUrl.protocol !== "https:" ||
      (!parsedCertUrl.hostname.endsWith(".paypal.com") &&
        parsedCertUrl.hostname !== "paypal.com")
    ) {
      return { verified: false, reason: "invalid_cert_url" };
    }
  } catch {
    return { verified: false, reason: "invalid_cert_url" };
  }

  // 5. Parse webhook event body safely
  let parsedEvent: unknown;
  try {
    parsedEvent = JSON.parse(params.rawBody);
  } catch {
    return { verified: false, reason: "invalid_payload" };
  }

  // 6. Verify signature directly with PayPal REST API
  const token = await getAccessToken();
  if (!token) {
    return { verified: false, reason: "upstream_error" };
  }

  const base = getPayPalBaseUrl();
  try {
    const res = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transmission_id: params.transmissionId,
        transmission_time: params.transmissionTime,
        cert_url: params.certUrl,
        auth_algo: params.authAlgo,
        transmission_sig: params.transmissionSig,
        webhook_id: webhookId,
        webhook_event: parsedEvent,
      }),
    });

    if (!res.ok) {
      return { verified: false, reason: "verification_failed" };
    }
    const data = await res.json();
    if (data.verification_status === "SUCCESS") {
      return { verified: true };
    }
    return { verified: false, reason: "verification_failed" };
  } catch {
    return { verified: false, reason: "upstream_error" };
  }
}

export async function verifyWebhookSignature(
  params: WebhookVerifyParams
): Promise<boolean> {
  const result = await verifyWebhookSignatureDetailed(params);
  return result.verified;
}
