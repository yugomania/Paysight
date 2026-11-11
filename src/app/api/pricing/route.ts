import { getPricingComparison } from "@/lib/channel3/client";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const product = searchParams.get("product")?.trim() ?? "";
  const rawPrice = searchParams.get("price") ?? "0";
  const price = parseFloat(rawPrice);

  if (!product) {
    return Response.json({ error: "product param required" }, { status: 400 });
  }
  if (!Number.isFinite(price) || price < 0) {
    return Response.json(
      { error: "price param must be a non-negative number" },
      { status: 400 }
    );
  }

  try {
    const comparison = await getPricingComparison(product, price);
    return Response.json(comparison);
  } catch (err) {
    console.error("[/api/pricing] error:", err);
    return Response.json({ error: "Failed to fetch pricing" }, { status: 500 });
  }
}
