import { describe, expect, it, vi } from "vitest";
import { createRateLimiter, getClientIdentifier, rateLimitPresets } from "@/lib/rate-limit";

describe("rate-limit", () => {
  it("prefers x-forwarded-for over x-real-ip", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        "x-real-ip": "198.51.100.20",
      },
    });

    expect(getClientIdentifier(request)).toBe("203.0.113.10");
  });

  it("falls back to x-real-ip and then unknown", () => {
    const realIpRequest = new Request("http://localhost", {
      headers: {
        "x-real-ip": "198.51.100.20",
      },
    });

    const unknownRequest = new Request("http://localhost");

    expect(getClientIdentifier(realIpRequest)).toBe("198.51.100.20");
    expect(getClientIdentifier(unknownRequest)).toBe("unknown");
  });

  it("enforces in-memory request limits and resets after a window", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const limiter = createRateLimiter({
      windowMs: 1_000,
      maxRequests: 2,
      keyPrefix: "test:rate-limit",
    });

    const first = await limiter.limit("client-1");
    const second = await limiter.limit("client-1");
    const third = await limiter.limit("client-1");

    expect(first.success).toBe(true);
    expect(first.remaining).toBe(1);
    expect(second.success).toBe(true);
    expect(second.remaining).toBe(0);
    expect(third.success).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.reset).toBeGreaterThan(Date.now());

    expect(rateLimitPresets.registration.maxRequests).toBe(10);

    vi.unstubAllEnvs();
  });
});
