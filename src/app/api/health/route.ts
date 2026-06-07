/**
 * /api/health
 *
 * Liveness + readiness probe for Docker, DigitalOcean App Platform,
 * and any load-balancer health-check that expects an HTTP 200.
 *
 * Returns 200 when the DB is reachable, 503 otherwise.
 * Also checks Valkey connectivity when configured.
 * The response body is structured JSON so dashboards can parse it.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic  = "force-dynamic"; // never cache this route

export async function GET() {
  const start = Date.now();

  // --- Database check ---
  let dbStatus: "ok" | "error" = "error";
  let dbMessage: string | undefined;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "ok";
  } catch (err) {
    dbMessage = err instanceof Error ? err.message : "unknown error";
  }

  // --- Valkey check ---
  let valkeyStatus: "ok" | "error" | "not_configured" = "not_configured";
  let valkeyMessage: string | undefined;

  try {
    // Dynamic import to avoid crashing if Valkey module is not available
    const valkeyModule = await import("@/lib/valkey");
    const valkey = valkeyModule.getValkey ? valkeyModule.getValkey() : (valkeyModule.valkeyConnection || null);

    if (valkey && typeof valkey.ping === "function") {
      await valkey.ping();
      valkeyStatus = "ok";
    } else {
      valkeyStatus = "not_configured";
      valkeyMessage = "Valkey client not available";
    }
  } catch (err) {
    valkeyStatus = "error";
    valkeyMessage = err instanceof Error ? err.message : "unknown error";
  }

  const latencyMs = Date.now() - start;
  const isHealthy = dbStatus === "ok" && valkeyStatus !== "error";
  const httpStatus = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status:    isHealthy ? "healthy" : "degraded",
      checks: {
        db: {
          status: dbStatus,
          ...(dbMessage ? { message: dbMessage } : {}),
        },
        valkey: {
          status: valkeyStatus,
          ...(valkeyMessage ? { message: valkeyMessage } : {}),
        },
      },
      latencyMs,
      timestamp: new Date().toISOString(),
      version:   process.env.npm_package_version ?? "unknown",
    },
    { status: httpStatus }
  );
}
