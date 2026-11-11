import { format } from "date-fns";
import type {
  CompetitorProduct,
  PricingComparison,
  PricingDataSource,
} from "@/types";

const BASE_URL = "https://api.trychannel3.com/v1";
const CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes
const MAX_CACHE_ENTRIES = 100;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<SearchResultMeta>>();

function fromCache(key: string): SearchResultMeta | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return { ...entry.data, fromCache: true };
  }
  if (entry) {
    cache.delete(key);
  }
  return null;
}

function toCache(key: string, data: SearchResultMeta): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function clearPricingCache(): void {
  cache.clear();
}

export function hasValidChannel3Config(): boolean {
  const apiKey = process.env.CHANNEL3_API_KEY?.trim() ?? "";
  return Boolean(
    apiKey &&
      apiKey !== "your_channel3_api_key" &&
      !apiKey.includes("placeholder") &&
      apiKey.length > 8
  );
}

// ─── Matching & Categorization Helpers ───────────────────────────────────────

function checkExactMatch(query: string, candidateTitle: string, brandName?: string): boolean {
  const qTokens = query
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (qTokens.length === 0) return false;
  const cTitle = `${brandName ? `${brandName} ` : ""}${candidateTitle}`.toLowerCase();
  const matches = qTokens.filter((token) => cTitle.includes(token));
  return matches.length >= Math.min(qTokens.length, 3);
}

function mapChannel3ProductRecords(
  rawProducts: unknown,
  cleanQuery: string,
  nowStr: string
): CompetitorProduct[] {
  if (!Array.isArray(rawProducts)) return [];
  const results: CompetitorProduct[] = [];

  for (const item of rawProducts) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const rawTitle = String(p.title || p.name || "").trim();
    if (!rawTitle) continue;

    const brands = Array.isArray(p.brands) ? (p.brands as Array<Record<string, unknown>>) : [];
    const brandName = typeof brands[0]?.name === "string" ? brands[0].name.trim() : "";
    const fullTitle =
      brandName && !rawTitle.toLowerCase().includes(brandName.toLowerCase())
        ? `${brandName} ${rawTitle}`
        : rawTitle;
    const isExact = checkExactMatch(cleanQuery, rawTitle, brandName);

    const images = Array.isArray(p.images) ? (p.images as Array<Record<string, unknown>>) : [];
    const mainImg =
      images.find((img) => img.is_main_image) ?? images[0];
    const imageUrl =
      (typeof mainImg?.cleaned_url === "string" && mainImg.cleaned_url) ||
      (typeof mainImg?.url === "string" && mainImg.url) ||
      (typeof p.image_url === "string" ? p.image_url : undefined);

    const offers = Array.isArray(p.offers) ? (p.offers as Array<Record<string, unknown>>) : [];
    if (offers.length > 0) {
      for (const offer of offers) {
        const priceObj =
          offer.price && typeof offer.price === "object"
            ? (offer.price as Record<string, unknown>)
            : null;
        const priceVal = parseFloat(String(priceObj?.price ?? offer.price ?? "0"));
        if (!Number.isFinite(priceVal) || priceVal <= 0) continue;

        const currency = String(priceObj?.currency ?? offer.currency ?? "USD").toUpperCase();
        const domain = String(
          offer.domain || offer.merchant || offer.retailer || p.retailer || p.store || "Retailer"
        ).trim();
        const availabilityStr = String(offer.availability ?? "");
        const inStock =
          availabilityStr
            ? !availabilityStr.toLowerCase().includes("outofstock") &&
              !availabilityStr.toLowerCase().includes("out_of_stock")
            : offer.in_stock !== false;
        const rawCondition = String(offer.condition ?? p.condition ?? "new").toLowerCase();
        const condition: CompetitorProduct["condition"] =
          rawCondition === "refurbished" || rawCondition === "used" ? rawCondition : "new";

        results.push({
          productName: fullTitle,
          retailer: domain,
          price: parseFloat(priceVal.toFixed(2)),
          currency,
          url: String(
            offer.url || p.url || `https://www.google.com/search?q=${encodeURIComponent(fullTitle)}`
          ),
          inStock,
          imageUrl,
          condition,
          retrievalTime: nowStr,
          isExactMatch: isExact,
          matchConfidence: isExact ? "exact" : "approximate",
        });
      }
      continue;
    }

    // Flat schema fallback (supported for direct product fixtures)
    const flatPrice = parseFloat(String(p.price ?? "0"));
    if (!Number.isFinite(flatPrice) || flatPrice <= 0) continue;
    results.push({
      productName: fullTitle,
      retailer: String(p.retailer || p.store || p.merchant_domain || "Retailer"),
      price: parseFloat(flatPrice.toFixed(2)),
      currency: String(p.currency || "USD").toUpperCase(),
      url: String(p.url || `https://www.google.com/search?q=${encodeURIComponent(fullTitle)}`),
      inStock: p.in_stock !== false,
      imageUrl,
      condition: (p.condition as "new" | "refurbished" | "used") || "new",
      retrievalTime: nowStr,
      isExactMatch: isExact,
      matchConfidence: isExact ? "exact" : "approximate",
    });
  }

  return results.slice(0, 15);
}

export interface SearchResultMeta {
  products: CompetitorProduct[];
  source: PricingDataSource;
  fromCache: boolean;
  errorNote?: string;
}

// ─── Live Channel3 Product Search ────────────────────────────────────────────

export async function searchProductsWithMeta(
  query: string
): Promise<SearchResultMeta> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return {
      products: [],
      source: hasValidChannel3Config() ? "channel3_live" : "channel3_unavailable",
      fromCache: false,
      errorNote: "Empty search query.",
    };
  }

  if (!hasValidChannel3Config()) {
    return {
      products: [],
      source: "channel3_unavailable",
      fromCache: false,
      errorNote:
        "CHANNEL3_API_KEY is not configured in .env.local. Live market pricing is unavailable.",
    };
  }

  const key = `search:live:${cleanQuery.toLowerCase()}`;
  const cached = fromCache(key);
  if (cached) return cached;

  const nowStr = new Date().toISOString();
  const apiKey = process.env.CHANNEL3_API_KEY!.trim();

  try {
    const res = await fetch(`${BASE_URL}/search`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: cleanQuery, limit: 10 }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return {
        products: [],
        source: "channel3_live",
        fromCache: false,
        errorNote: `Channel3 API returned HTTP ${res.status}. Live listings unavailable.`,
      };
    }

    const data = await res.json();
    const rawProducts = Array.isArray(data)
      ? data
      : data.products ?? data.items ?? data.results ?? [];
    const products = mapChannel3ProductRecords(rawProducts, cleanQuery, nowStr);

    const liveMeta: SearchResultMeta = {
      products,
      source: "channel3_live",
      fromCache: false,
      errorNote:
        products.length === 0
          ? `No comparable Channel3 listings returned for "${cleanQuery}".`
          : undefined,
    };
    toCache(key, liveMeta);
    return liveMeta;
  } catch (err) {
    console.warn(
      "[Channel3] Live request failed:",
      err instanceof Error ? err.message : err
    );
    return {
      products: [],
      source: "channel3_live",
      fromCache: false,
      errorNote: "Channel3 live API request failed. Check network or CHANNEL3_API_KEY.",
    };
  }
}

export async function searchProducts(query: string): Promise<CompetitorProduct[]> {
  const res = await searchProductsWithMeta(query);
  return res.products;
}

// ─── Build Pricing Comparison with Defined Comparable Subset ────────────────

export async function getPricingComparison(
  productName: string,
  yourPrice: number,
  yourSku?: string
): Promise<PricingComparison> {
  const safePrice = Number.isFinite(yourPrice) && yourPrice >= 0 ? yourPrice : 0;
  const searchMeta = await searchProductsWithMeta(productName);
  const competitors = searchMeta.products;
  const nowStr = new Date().toISOString();

  if (competitors.length === 0) {
    return {
      yourProductName: productName,
      yourPrice: parseFloat(safePrice.toFixed(2)),
      yourSku,
      currency: "USD",
      marketMinPrice: 0,
      marketMaxPrice: 0,
      marketAvgPrice: 0,
      priceDifference: 0,
      priceDifferencePct: null,
      competitorCount: 0,
      pricePosition: "unknown",
      competitors: [],
      exactMatchesCount: 0,
      approximateMatchesCount: 0,
      comparisonTimestamp: nowStr,
      source: searchMeta.source,
      fromCache: searchMeta.fromCache,
      disclaimer:
        searchMeta.errorNote ||
        "No comparable listings retrieved for this query. Try a more specific brand or model.",
    };
  }

  const exactMatches = competitors.filter((c) => c.isExactMatch && c.price > 0);
  const approximateMatches = competitors.filter((c) => !c.isExactMatch && c.price > 0);

  // Prefer exact matches if >= 2 exist; otherwise use all retrieved comparable items
  const benchmarkSet =
    exactMatches.length >= 2
      ? exactMatches
      : competitors.filter((c) => c.price > 0);
  const prices = benchmarkSet.map((c) => c.price);

  const marketMinPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const marketMaxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const marketAvgPrice =
    prices.length > 0
      ? prices.reduce((s, p) => s + p, 0) / prices.length
      : 0;

  let pricePosition: PricingComparison["pricePosition"] = "unknown";
  if (marketAvgPrice > 0 && safePrice > 0) {
    if (safePrice > marketAvgPrice * 1.12) pricePosition = "high";
    else if (safePrice < marketAvgPrice * 0.88) pricePosition = "low";
    else pricePosition = "competitive";
  }

  const priceDifference = parseFloat((safePrice - marketAvgPrice).toFixed(2));
  const priceDifferencePct =
    marketAvgPrice > 0
      ? parseFloat((((safePrice - marketAvgPrice) / marketAvgPrice) * 100).toFixed(1))
      : null;

  const disclaimer = `[Channel3 Live API] Benchmarks calculated from ${benchmarkSet.length} retrieved listings (${exactMatches.length} exact, ${approximateMatches.length} approximate) at ${format(new Date(), "HH:mm:ss 'UTC'")}. Not an exhaustive market census.`;

  return {
    yourProductName: productName,
    yourPrice: parseFloat(safePrice.toFixed(2)),
    yourSku,
    currency: benchmarkSet[0]?.currency || "USD",
    marketMinPrice: parseFloat(marketMinPrice.toFixed(2)),
    marketMaxPrice: parseFloat(marketMaxPrice.toFixed(2)),
    marketAvgPrice: parseFloat(marketAvgPrice.toFixed(2)),
    priceDifference,
    priceDifferencePct,
    competitorCount: competitors.length,
    pricePosition,
    competitors,
    exactMatchesCount: exactMatches.length,
    approximateMatchesCount: approximateMatches.length,
    comparisonTimestamp: nowStr,
    source: searchMeta.source,
    fromCache: searchMeta.fromCache,
    disclaimer,
  };
}
