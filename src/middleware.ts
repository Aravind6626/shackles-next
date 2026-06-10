import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";

// Configure a global rate limit of 100 requests per second per IP
const globalRateLimiter = createRateLimiter({
  windowMs: 1000, // 1 second
  maxRequests: 100,
  keyPrefix: "global_ratelimit",
});

export async function middleware(request: NextRequest) {
  // Extract client IP address for rate limiting
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";

  // Check rate limit
  if (globalRateLimiter) {
    const { success, remaining, reset } = await globalRateLimiter.limit(`ip:${ip}`);
    
    if (!success) {
      return new NextResponse("Too many requests. Please try again later.", {
        status: 429,
        headers: {
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
          "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      });
    }
  }

  // Continue to next middleware or route handler
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
