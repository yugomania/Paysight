import { NextRequest } from "next/server";
import { getOrdersController, hasValidPayPalConfig } from "@/lib/paypal/client";
import {
  SANDBOX_PRODUCTS,
  resolveSandboxProduct,
  extractPayPalSdkError,
} from "@/lib/paypal/catalog";
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitExceededResponse,
} from "@/lib/security/rate-limit";
import {
  CheckoutPaymentIntent,
  PaypalWalletContextShippingPreference,
  PaypalExperienceUserAction,
} from "@paypal/paypal-server-sdk";

export { SANDBOX_PRODUCTS };

export async function GET() {
  return Response.json({
    products: Object.values(SANDBOX_PRODUCTS),
    isLive: hasValidPayPalConfig(),
    environment: hasValidPayPalConfig()
      ? process.env.PAYPAL_ENVIRONMENT === "live"
        ? "live"
        : "sandbox"
      : "demo",
  });
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit({
    key: `orders-create:${getClientIdentifier(req)}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return rateLimitExceededResponse(rl);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawProductId =
      typeof body?.productId === "string" ? body.productId.trim() : undefined;

    const product = resolveSandboxProduct(rawProductId);
    if (!product) {
      return Response.json(
        { error: `Unknown product identifier "${rawProductId}".` },
        { status: 400 }
      );
    }

    // Live PayPal Sandbox / Production Order creation
    if (hasValidPayPalConfig()) {
      const ordersController = getOrdersController();
      const response = await ordersController.createOrder({
        body: {
          intent: CheckoutPaymentIntent.Capture,
          purchaseUnits: [
            {
              amount: {
                currencyCode: product.currency,
                value: product.amount,
              },
              description: product.description,
              customId: product.id,
            },
          ],
          paymentSource: {
            paypal: {
              experienceContext: {
                brandName: "PaySight",
                shippingPreference: PaypalWalletContextShippingPreference.NoShipping,
                userAction: PaypalExperienceUserAction.PayNow,
              },
            },
          },
        },
      });

      const order = response.result;
      return Response.json({
        id: order.id,
        status: order.status,
        productId: product.id,
        productName: product.name,
        amount: product.amount,
        currency: product.currency,
        environment: process.env.PAYPAL_ENVIRONMENT === "live" ? "live" : "sandbox",
        isLive: true,
      });
    }

    // Zero-Config Demo Mode fallback when PayPal Sandbox credentials are absent
    const demoOrderId = `ORD-DEMO-${Date.now().toString().slice(-8)}`;
    return Response.json({
      id: demoOrderId,
      status: "CREATED",
      productId: product.id,
      productName: product.name,
      amount: product.amount,
      currency: product.currency,
      environment: "demo",
      isLive: false,
    });
  } catch (err) {
    const { message, debugId } = extractPayPalSdkError(err, "Failed to create PayPal order");
    console.error("[/api/orders/create] error:", message, debugId ? `(debug_id: ${debugId})` : "");
    return Response.json(
      { error: message, debug_id: debugId },
      { status: 500 }
    );
  }
}
