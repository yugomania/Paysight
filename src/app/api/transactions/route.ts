import {
  fetchTransactionsWithMeta,
  getMerchantKPIs,
  getRevenueTimeSeries,
} from "@/lib/paypal/api";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawDays = parseInt(searchParams.get("days") ?? "30", 10);
  const days = Number.isFinite(rawDays) ? Math.max(1, Math.min(365, rawDays)) : 30;
  const type = searchParams.get("type") ?? "transactions";
  const currency = searchParams.get("currency")?.trim() || undefined;

  try {
    if (type === "kpis") {
      const kpis = await getMerchantKPIs(days, currency);
      return Response.json(kpis);
    }
    if (type === "revenue") {
      const data = await getRevenueTimeSeries(days, currency);
      return Response.json(data);
    }
    if (type === "meta") {
      const meta = await fetchTransactionsWithMeta(days);
      return Response.json(meta);
    }

    const meta = await fetchTransactionsWithMeta(days);
    const headers: Record<string, string> = {
      "X-PaySight-Source": meta.source,
      "X-PaySight-Partial": String(meta.isPartial),
    };
    if (meta.dataWarning) {
      headers["X-PaySight-Warning"] = meta.dataWarning;
    }
    return Response.json(meta.transactions, { headers });
  } catch (err) {
    console.error("[/api/transactions] error:", err);
    return Response.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}
