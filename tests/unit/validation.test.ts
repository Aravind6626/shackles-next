import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REQUIRED_ENV = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/testdb",
  SESSION_SECRET: "12345678901234567890123456789012",
  STORAGE_PROVIDER: "local",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

async function loadEnvModule() {
  vi.resetModules();
  return import("@/lib/env-validation");
}

describe("env validation", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws when required core env vars are missing", async () => {
    const envValidation = await loadEnvModule();

    expect(() => envValidation.validateAndGetEnv()).toThrow("Environment validation failed");
  });

  it("returns validated values when required env vars are present", async () => {
    Object.assign(process.env, REQUIRED_ENV);

    const envValidation = await loadEnvModule();
    const env = envValidation.validateAndGetEnv();

    expect(env.DATABASE_URL).toBe(REQUIRED_ENV.DATABASE_URL);
    expect(env.SESSION_SECRET).toBe(REQUIRED_ENV.SESSION_SECRET);
    expect(env.STORAGE_PROVIDER).toBe("local");
    expect(envValidation.getValidatedEnv("NEXT_PUBLIC_APP_URL")).toBe(REQUIRED_ENV.NEXT_PUBLIC_APP_URL);
    expect(envValidation.isFeatureEnabled("ENABLE_SCANNER_BULK_TEAM_FLOW")).toBe(false);
  });
});
