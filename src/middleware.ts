import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware for Auth.js v5 - handles authorization
 * Protected routes require authentication and appropriate roles
 */
export async function middleware(request: NextRequest) {
  const session = await auth();
  const pathname = request.nextUrl.pathname;

  // Admin routes: require ADMIN role
  if (pathname.startsWith("/admin")) {
    if (!session?.user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const user = session.user as any;
    if (user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // Protected routes: require login
  if (pathname.startsWith("/(protected)")) {
    if (!session?.user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/(protected)/:path*"],
};
