import { Redis } from "ioredis";

// BullMQ requires a dedicated ioredis connection — it cannot share
// the connection used by other parts of your app.
// Set VALKEY_URL in your .env: redis://localhost:6379
// (Valkey is wire-compatible with Redis; ioredis works out of the box)

if (!process.env.VALKEY_URL) {
  throw new Error("VALKEY_URL environment variable is not set");
}

// maxRetriesPerRequest: null is REQUIRED by BullMQ
export const valkeyConnection = new Redis(process.env.VALKEY_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

valkeyConnection.on("error", (err) => {
  console.error("[Valkey] Connection error:", err.message);
});

valkeyConnection.on("connect", () => {
  console.log("[Valkey] Connected");
});
