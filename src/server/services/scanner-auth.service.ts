/**
 * Scanner Actor Authorization Service
 * Manages authentication and authorization for scanner operations (ADMIN/COORDINATOR).
 * 
 * NOTE: This is a placeholder implementation to resolve build dependencies.
 * Full implementation should validate that the current user has scanner access permissions.
 */

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Permission } from "@prisma/client";

type ScannerAuthResult =
  | { ok: true; actor: { id: string; email: string; role: string } }
  | { ok: false; reason: "NOT_AUTHENTICATED" | "NOT_AUTHORIZED"; message: string };

/**
 * Verify that the current user has scanner actor permissions (ADMIN or COORDINATOR with SCAN_PARTICIPANT_QR permission)
 */
export async function requireScannerActor(): Promise<ScannerAuthResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      ok: false,
      reason: "NOT_AUTHENTICATED",
      message: "Scanner access requires authentication",
    };
  }

  // Get user's role and permissions
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      role: {
        include: { permissions: true },
      },
    },
  });

  if (!user) {
    return {
      ok: false,
      reason: "NOT_AUTHENTICATED",
      message: "User not found",
    };
  }

  // Check if user is ADMIN or has SCAN_PARTICIPANT_QR permission
  const hasPermission = user.role?.permissions?.some(
    (rp) => rp.permission === Permission.SCAN_PARTICIPANT_QR
  );

  if (!hasPermission) {
    return {
      ok: false,
      reason: "NOT_AUTHORIZED",
      message: "Scanner access requires SCAN_PARTICIPANT_QR permission",
    };
  }

  return {
    ok: true,
    actor: {
      id: user.id,
      email: user.email,
      role: user.role?.name || "UNKNOWN",
    },
  };
}
