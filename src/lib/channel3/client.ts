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
  isSimulated: boolean;
  fromCache: boolean;
  errorNote?: string;
}

// ─── Search Channel3 or Structured Demo Catalog ──────────────────────────────

export async function searchProductsWithMeta(
  query: string
): Promise<SearchResultMeta> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return {
      products: [],
      source: hasValidChannel3Config() ? "channel3_live" : "structured_fallback",
      isSimulated: !hasValidChannel3Config(),
      fromCache: false,
      errorNote: "Empty search query.",
    };
  }

  const hasLiveKey = hasValidChannel3Config();
  const key = `search:${hasLiveKey ? "live" : "demo"}:${cleanQuery.toLowerCase()}`;
  const cached = fromCache(key);
  if (cached) return cached;

  const nowStr = new Date().toISOString();

  if (hasLiveKey) {
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
          isSimulated: false,
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
        isSimulated: false,
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
        isSimulated: false,
        fromCache: false,
        errorNote: "Channel3 live API request failed. Check network or CHANNEL3_API_KEY.",
      };
    }
  }

  // Demo Mode fallback (only when CHANNEL3_API_KEY is not configured)
  const demoResult = getStructuredDemoCatalog(cleanQuery, nowStr);
  const demoMeta: SearchResultMeta = {
    products: demoResult.products,
    source: demoResult.source,
    isSimulated: true,
    fromCache: false,
  };
  toCache(key, demoMeta);
  return demoMeta;
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
      isSimulated: searchMeta.isSimulated,
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

  const sourceLabel =
    searchMeta.source === "channel3_live"
      ? "Channel3 Live API"
      : searchMeta.source === "structured_fallback"
      ? "Demo Sample Catalog (CHANNEL3_API_KEY not set)"
      : "Demo Simulated Reference (CHANNEL3_API_KEY not set)";

  const disclaimer = `[${sourceLabel}] Benchmarks calculated from ${benchmarkSet.length} retrieved listings (${exactMatches.length} exact, ${approximateMatches.length} approximate) at ${format(new Date(), "HH:mm:ss 'UTC'")}. Not an exhaustive market census.`;

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
    isSimulated: searchMeta.isSimulated,
    fromCache: searchMeta.fromCache,
    disclaimer,
  };
}

// ─── Structured Multi-Retailer Demo Catalog ──────────────────────────────────

function getStructuredDemoCatalog(
  query: string,
  retrievalTime: string
): { products: CompetitorProduct[]; source: PricingDataSource } {
  const q = query.toLowerCase();

  const wrap = (
    items: Omit<CompetitorProduct, "retrievalTime" | "matchConfidence">[]
  ): { products: CompetitorProduct[]; source: PricingDataSource } => ({
    source: "structured_fallback",
    products: items.map((item) => ({
      ...item,
      retrievalTime,
      matchConfidence: item.isExactMatch ? "exact" : "approximate",
    })),
  });

  if (q.includes("headphone") || q.includes("audio") || q.includes("noise") || q.includes("sony") || q.includes("bose")) {
    return wrap([
      {
        productName: "Sony WH-1000XM5 Wireless Noise Canceling Headphones",
        retailer: "Best Buy",
        price: 159.99,
        currency: "USD",
        url: "https://www.bestbuy.com/site/sony-wh-1000xm5",
        inStock: true,
        brand: "Sony",
        condition: "new",
        isExactMatch: true,
      },
      {
        productName: "Bose QuietComfort 45 Over-Ear Noise-Cancelling Headphones",
        retailer: "Amazon",
        price: 149.0,
        currency: "USD",
        url: "https://www.amazon.com/dp/B098FKXT8L",
        inStock: true,
        brand: "Bose",
        condition: "new",
        isExactMatch: true,
      },
      {
        productName: "Sennheiser Momentum 4 Wireless ANC Headphones",
        retailer: "B&H Photo",
        price: 179.95,
        currency: "USD",
        url: "https://www.bhphotovideo.com/c/product/sennheiser-momentum-4",
        inStock: true,
        brand: "Sennheiser",
        condition: "new",
        isExactMatch: true,
      },
      {
        productName: "Anker Soundcore Space One Noise Cancelling Headphones",
        retailer: "Walmart",
        price: 99.99,
        currency: "USD",
        url: "https://www.walmart.com/ip/anker-soundcore-space-one",
        inStock: true,
        brand: "Anker",
        condition: "new",
        isExactMatch: false,
      },
    ]);
  }

  if (q.includes("keyboard") || q.includes("mechanical") || q.includes("ergonomic")) {
    return wrap([
      {
        productName: "Keychron Q1 Pro Wireless Custom Mechanical Keyboard",
        retailer: "Amazon",
        price: 94.99,
        currency: "USD",
        url: "https://www.amazon.com/dp/keychron-q1",
        inStock: true,
        brand: "Keychron",
        condition: "new",
        isExactMatch: true,
      },
      {
        productName: "Logitech MX Mechanical Wireless Illuminated Keyboard",
        retailer: "Best Buy",
        price: 99.99,
        currency: "USD",
        url: "https://www.bestbuy.com/site/logitech-mx-mechanical",
        inStock: true,
        brand: "Logitech",
        condition: "new",
        isExactMatch: true,
      },
      {
        productName: "Epomaker RT100 Retro Ergonomic Mechanical Keyboard",
        retailer: "Newegg",
        price: 84.99,
        currency: "USD",
        url: "https://www.newegg.com/p/epomaker-rt100",
        inStock: true,
        brand: "Epomaker",
        condition: "new",
        isExactMatch: true,
      },
      {
        productName: "Razer BlackWidow V4 Tenkeyless Gaming Keyboard",
        retailer: "Target",
        price: 119.99,
        currency: "USD",
        url: "https://www.target.com/p/razer-blackwidow",
        inStock: false,
        brand: "Razer",
        condition: "new",
        isExactMatch: false,
      },
    ]);
  }

  if (q.includes("webcam") || q.includes("camera") || q.includes("4k")) {
    return wrap([
      {
        productName: "Elgato Facecam Pro 4K60 Ultra HD Webcam",
        retailer: "B&H Photo",
        price: 129.99,
        currency: "USD",
        url: "https://www.bhphotovideo.com/c/product/elgato-facecam-pro",
        inStock: true,
        brand: "Elgato",
        condition: "new",
        isExactMatch: true,
      },
      {
        productName: "Logitech Brio 4K Ultra HD Pro Business Webcam",
        retailer: "Amazon",
        price: 119.0,
        currency: "USD",
        url: "https://www.amazon.com/dp/B01N5UOYC4",
        inStock: true,
        brand: "Logitech",
        condition: "new",
        isExactMatch: true,
      },
      {
        productName: "AnkerWork B600 Video Bar 2K Streaming Cam",
        retailer: "Best Buy",
        price: 109.99,
        currency: "USD",
        url: "https://www.bestbuy.com/site/ankerwork-b600",
        inStock: true,
        brand: "AnkerWork",
        condition: "new",
        isExactMatch: false,
      },
    ]);
  }

  if (q.includes("hub") || q.includes("usb")) {
    return wrap([
      {
        productName: "Anker 7-in-1 Aluminum USB-C Hub Adapter",
        retailer: "Amazon",
        price: 39.99,
        currency: "USD",
        url: "https://www.amazon.com/s?k=anker+7+in+1+usb+c+hub",
        inStock: true,
        brand: "Anker",
        condition: "new",
        isExactMatch: true,
      },
      {
        productName: "Satechi Aluminum Multi-Port V2 USB-C Hub",
        retailer: "Best Buy",
        price: 59.99,
        currency: "USD",
        url: "https://www.bestbuy.com/site/searchpage.jsp?st=satechi+usb+c+hub",
        inStock: true,
        brand: "Satechi",
        condition: "new",
        isExactMatch: true,
      },
      {
        productName: "UGREEN Revodok 7-in-1 USB-C Hub",
        retailer: "Walmart",
        price: 34.99,
        currency: "USD",
        url: "https://www.walmart.com/search?q=ugreen+usb+c+hub",
        inStock: true,
        brand: "UGREEN",
        condition: "new",
        isExactMatch: false,
      },
    ]);
  }

  if (q.includes("anker") || q.includes("power bank")) {
    return wrap([
      {
        productName: "Anker 737 Power Bank (PowerCore 24K)",
        retailer: "Amazon",
        price: 119.99,
        currency: "USD",
        url: "https://www.amazon.com/s?k=Anker+737+Power+Bank",
        inStock: true,
        brand: "Anker",
        condition: "new",
        isExactMatch: true,
      },
      {
        productName: "Anker 737 Portable Charger 140W USB-C",
        retailer: "Best Buy",
        price: 139.99,
        currency: "USD",
        url: "https://www.bestbuy.com/site/searchpage.jsp?st=Anker+737+Power+Bank",
        inStock: true,
        brand: "Anker",
        condition: "new",
        isExactMatch: true,
      },
      {
        productName: "Baseus Blade 100W Laptop Power Bank",
        retailer: "Walmart",
        price: 89.99,
        currency: "USD",
        url: "https://www.walmart.com/search?q=laptop+power+bank",
        inStock: true,
        brand: "Baseus",
        condition: "new",
        isExactMatch: false,
      },
    ]);
  }

  if (q.includes("mx master") || q.includes("mouse") || q.includes("logitech")) {
    return wrap([
      {
        productName: "Logitech MX Master 3S Performance Wireless Mouse",
        retailer: "Amazon",
        price: 94.99,
        currency: "USD",
        url: "https://www.amazon.com/s?k=Logitech+MX+Master+3S",
        inStock: true,
        brand: "Logitech",
        condition: "new",
        isExactMatch: true,
      },
      {
        productName: "Logitech MX Master 3S Bluetooth Mouse",
        retailer: "Best Buy",
        price: 99.99,
        currency: "USD",
        url: "https://www.bestbuy.com/site/searchpage.jsp?st=Logitech+MX+Master+3S",
        inStock: true,
        brand: "Logitech",
        condition: "new",
        isExactMatch: true,
      },
      {
        productName: "Keychron M6 Wireless Ergonomic Mouse",
        retailer: "B&H Photo",
        price: 69.0,
        currency: "USD",
        url: "https://www.bhphotovideo.com/c/search?Ntt=wireless+ergonomic+mouse",
        inStock: true,
        brand: "Keychron",
        condition: "new",
        isExactMatch: false,
      },
    ]);
  }

  // Clearly labelled synthetic fallback ONLY in Demo Mode when CHANNEL3_API_KEY is unconfigured
  const basePrice = 65.0;
  return {
    source: "synthetic_fallback",
    products: [
      {
        productName: `${query} (Demo Simulated Listing A)`,
        retailer: "Amazon (Demo Reference)",
        price: parseFloat((basePrice * 1.05).toFixed(2)),
        currency: "USD",
        url: `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
        inStock: true,
        condition: "new",
        retrievalTime,
        isExactMatch: true,
        matchConfidence: "exact",
      },
      {
        productName: `${query} (Demo Simulated Listing B)`,
        retailer: "Best Buy (Demo Reference)",
        price: parseFloat((basePrice * 0.95).toFixed(2)),
        currency: "USD",
        url: `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(query)}`,
        inStock: true,
        condition: "new",
        retrievalTime,
        isExactMatch: true,
        matchConfidence: "exact",
      },
      {
        productName: `${query} (Demo Simulated Alternative)`,
        retailer: "Walmart (Demo Reference)",
        price: parseFloat((basePrice * 0.9).toFixed(2)),
        currency: "USD",
        url: `https://www.walmart.com/search?q=${encodeURIComponent(query)}`,
        inStock: true,
        condition: "new",
        retrievalTime,
        isExactMatch: false,
        matchConfidence: "approximate",
      },
    ],
  };
}
