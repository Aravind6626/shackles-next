import { Redis } from "ioredis";

const valkeyUrl = process.env.VALKEY_URL || "redis://localhost:6379";

// Avoid connecting during build if possible
const isBuild = process.env.NEXT_PHASE === 'phase-production-build';

/**
 * Shared Valkey connection for BullMQ and general caching.
 * Valkey is wire-compatible with Redis; ioredis works out of the box.
 */
let valkey: Redis | null = null;

export function getValkey() {
  if (valkey) return valkey;

  valkey = new Redis(valkeyUrl, {
    maxRetriesPerRequest: null,
    // Disable lazyConnect so it doesn't try to connect immediately
    lazyConnect: true,
    retryStrategy: (times) => {
      // Don't retry indefinitely during build
      if (isBuild && times > 1) return null;
      return Math.min(times * 50, 2000);
    },
  });

  valkey.on("error", (err) => {
    // Suppress noise during build
    if (!isBuild) {
      console.error("Valkey Connection Error:", err);
    }
  });

  return valkey;
}

// Export for backward compatibility (lazy-initialized on first access)
export const valkeyConnection = getValkey();

// Backward-compatible aliases (used by older imports)
export const getRedis = getValkey;
export const redisConnection = valkeyConnection;
