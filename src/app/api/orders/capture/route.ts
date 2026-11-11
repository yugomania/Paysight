import { NextRequest } from "next/server";
import { captureServerSideOrder } from "@/lib/paypal/api";
import { resolveSandboxProduct } from "@/lib/paypal/catalog";

// In-process idempotency set — guards against concurrent duplicate submissions
// within the same server process lifetime.
const captureInFlight = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
    const productId =
      typeof body?.productId === "string" ? body.productId.trim() : undefined;

    if (!orderId) {
      return Response.json({ error: "orderId is required" }, { status: 400 });
    }

    if (productId && !resolveSandboxProduct(productId)) {
      return Response.json(
        { error: `Unknown productId "${productId}"` },
        { status: 400 }
      );
    }

    if (captureInFlight.has(orderId)) {
      return Response.json(
        { error: "Capture already in progress for this order. Please wait." },
        { status: 409 }
      );
    }
    captureInFlight.add(orderId);

    try {
      const result = await captureServerSideOrder(orderId, productId);

      if (!result.success) {
        return Response.json({ error: result.error ?? "Capture failed" }, { status: 400 });
      }

      return Response.json({
        success: true,
        transaction: result.transaction,
      });
    } finally {
      captureInFlight.delete(orderId);
    }
  } catch (err) {
    console.error("[/api/orders/capture] error:", err instanceof Error ? err.message : err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to capture order" },
      { status: 500 }
    );
  }
}
