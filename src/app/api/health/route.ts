import { getDbStats } from "@/lib/db";
import { getPersistenceMode } from "@/lib/db/postgres.deferred";
import { hasValidPayPalConfig } from "@/lib/paypal/client";
import { hasValidGeminiConfig } from "@/lib/ai/orchestrator";
import { hasValidChannel3Config } from "@/lib/channel3/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dbStats = getDbStats();
    const persistence = getPersistenceMode();
    const paypalConfigured = hasValidPayPalConfig();
    const webhookConfigured = Boolean(process.env.PAYPAL_WEBHOOK_ID?.trim());

    return Response.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: paypalConfigured
        ? process.env.PAYPAL_ENVIRONMENT === "live"
          ? "live"
          : "sandbox"
        : "unconfigured",
      persistence: {
        driver: persistence.activeDriver,
        databaseUrlConfigured: persistence.databaseUrlConfigured,
        ephemeralWarning:
          process.env.NODE_ENV === "production" && persistence.activeDriver === "json_file",
        dbStats,
      },
      integrations: {
        paypalConfigured,
        webhookVerificationConfigured: paypalConfigured && webhookConfigured,
        geminiConfigured: hasValidGeminiConfig(),
        channel3Configured: hasValidChannel3Config(),
      },
    });
  } catch (err) {
    console.error("[/api/health] error:", err instanceof Error ? err.message : err);
    return Response.json(
      { status: "degraded", error: "Health check encountered a persistence error" },
      { status: 500 }
    );
  }
}

