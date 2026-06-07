'use server'

import { z } from "zod";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { createRateLimiter, rateLimitPresets } from "@/lib/rate-limit";

const loginRateLimiter = createRateLimiter({
  ...rateLimitPresets.auth,
  keyPrefix: "ratelimit:login",
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginUser(prevState: unknown, formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  const loggedInRole: string | null = null;

  const result = LoginSchema.safeParse(data);
  if (!result.success) {
    return { error: "Invalid email or password format." };
  }

  const { email, password } = result.data;

  // FIX 4: Rate limit before DB lookup to prevent brute force
  const rateLimitResult = await loginRateLimiter.limit(email.toLowerCase());
  if (!rateLimitResult.success) {
    return { error: "Too many login attempts. Please try again later." };
  }

  let targetPath = "/userDashboard";

  try {
    // Look up user to determine redirect path
    const user = await prisma.user.findUnique({ 
      where: { email },
      include: {
        staffAssignments: {
          select: { eventId: true, staffRole: true },
          take: 1, // Just need to know if assigned to any event
        }
      }
    });
    if (user) {
      if (user.role === "ADMIN") {
        targetPath = "/admin/adminDashboard";
      } else if (user.role === "COORDINATOR") {
        // If coordinator has event assignments, send to coordinator dashboard
        if (user.staffAssignments.length > 0) {
          targetPath = "/staff/coordinatorDashboard";
        } else {
          targetPath = "/staff/no-assignment";
        }
      } else if (user.role === "VOLUNTEER") {
        // If volunteer has event assignments, send to volunteer dashboard
        if (user.staffAssignments.length > 0) {
          targetPath = "/staff/volunteerDashboard";
        } else {
          targetPath = "/staff/no-assignment";
        }
      }
    }
  } catch (err) {
    console.error("Database error during login prep:", err);
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: targetPath,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid credentials." };
        default:
          return { error: "Something went wrong." };
      }
    }
    // Re-throw NEXT_REDIRECT error so Next.js redirects properly
    throw error;
  }
}