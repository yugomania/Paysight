import test from "node:test";
import assert from "node:assert/strict";
import {
  clearPricingCache,
  getPricingComparison,
  searchProducts,
} from "../src/lib/channel3/client";

test("Channel3 Market Comparisons: live transparency, matching, and benchmarks", async (t) => {
  t.beforeEach(() => {
    clearPricingCache();
  });

  await t.test("demo fallback mode marks simulated results transparently", async () => {
    const prevKey = process.env.CHANNEL3_API_KEY;
    delete process.env.CHANNEL3_API_KEY;
    try {
      const products = await searchProducts("Anker 737 Power Bank");
      assert.ok(products.length > 0);
      for (const p of products) {
        assert.ok(p.productName);
        assert.ok(p.retailer);
        assert.ok(p.price > 0);
        assert.ok(p.url.startsWith("http"));
        assert.ok(p.matchConfidence === "exact" || p.matchConfidence === "approximate");
      }

      const comp = await getPricingComparison("Sony WH-1000XM5 Wireless Headphones", 139.99);
      assert.equal(comp.isSimulated, true);
      assert.equal(comp.source, "structured_fallback");
      assert.equal(
        (comp.exactMatchesCount ?? 0) + (comp.approximateMatchesCount ?? 0),
        comp.competitorCount
      );
      assert.ok(comp.marketMinPrice > 0 && comp.marketMaxPrice >= comp.marketMinPrice);
      assert.ok(comp.disclaimer?.includes("Demo"));
    } finally {
      if (prevKey === undefined) delete process.env.CHANNEL3_API_KEY;
      else process.env.CHANNEL3_API_KEY = prevKey;
    }
  });

  await t.test("live Channel3 mode never fabricates prices when upstream returns empty or fails", async () => {
    const prevKey = process.env.CHANNEL3_API_KEY;
    const origFetch = globalThis.fetch;
    process.env.CHANNEL3_API_KEY = "c3_live_test_key_123456";

    try {
      // Case 1: Live returns matching items
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            products: [
              {
                name: "Logitech MX Master 3S Wireless Mouse",
                retailer: "Amazon",
                price: 94.99,
                currency: "USD",
                url: "https://amazon.com/dp/mx3s",
                in_stock: true,
              },
              {
                name: "Logitech MX Master 3S Mouse Graphite",
                retailer: "Best Buy",
                price: 99.99,
                currency: "USD",
                url: "https://bestbuy.com/mx3s",
                in_stock: true,
              },
            ],
          }),
          { status: 200 }
        );

      const liveComp = await getPricingComparison("Logitech MX Master 3S", 89.99);
      assert.equal(liveComp.isSimulated, false);
      assert.equal(liveComp.source, "channel3_live");
      assert.equal(liveComp.competitorCount, 2);
      assert.equal(liveComp.marketAvgPrice, 97.49);

      // Case 2: Live Channel3 POST /v1/search nested offers[] schema
      clearPricingCache();
      let capturedMethod = "";
      let capturedUrl = "";
      globalThis.fetch = async (url, init) => {
        capturedUrl = String(url);
        capturedMethod = init?.method || "GET";
        return new Response(
          JSON.stringify({
            products: [
              {
                id: "hrz4MAW",
                title: "WH-1000XM5 Over-Ear Noise Cancelling Bluetooth Headphones",
                brands: [{ id: "PURH", name: "Sony" }],
                images: [{ url: "https://cdn.example.com/sony.jpg", is_main_image: true }],
                offers: [
                  {
                    url: "https://buy.example.com/1",
                    domain: "selfridges.com",
                    price: { price: 340, currency: "USD" },
                    availability: "InStock",
                    condition: "new",
                  },
                  {
                    url: "https://buy.example.com/2",
                    domain: "6ave.com",
                    price: { price: 398, currency: "USD" },
                    availability: "InStock",
                    condition: "new",
                  },
                ],
              },
            ],
          }),
          { status: 200 }
        );
      };

      const nestedComp = await getPricingComparison("Sony WH-1000XM5 Headphones", 299.99);
      assert.equal(capturedMethod, "POST");
      assert.ok(capturedUrl.endsWith("/v1/search"));
      assert.equal(nestedComp.isSimulated, false);
      assert.equal(nestedComp.competitorCount, 2);
      assert.equal(nestedComp.exactMatchesCount, 2);
      assert.equal(nestedComp.marketMinPrice, 340);
      assert.equal(nestedComp.marketMaxPrice, 398);
      assert.equal(nestedComp.competitors[0].retailer, "selfridges.com");

      // Case 3: Live API fails (HTTP 502) -> must NOT fabricate mock catalog entries
      clearPricingCache();
      globalThis.fetch = async () => new Response("Bad Gateway", { status: 502 });
      const errComp = await getPricingComparison("Logitech MX Master 3S", 89.99);
      assert.equal(errComp.isSimulated, false);
      assert.equal(errComp.source, "channel3_live");
      assert.equal(errComp.competitorCount, 0);
      assert.equal(errComp.pricePosition, "unknown");
      assert.ok(errComp.disclaimer?.includes("HTTP 502"));
    } finally {
      globalThis.fetch = origFetch;
      if (prevKey === undefined) delete process.env.CHANNEL3_API_KEY;
      else process.env.CHANNEL3_API_KEY = prevKey;
    }
  });
});
