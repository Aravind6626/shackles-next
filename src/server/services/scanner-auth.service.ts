import { Permission, Role, StaffRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export type ScannerAuthResult =
  | { ok: true; actor: { id: string; role: Role } }
  | { ok: false; reason: "NOT_AUTHENTICATED" | "NOT_AUTHORIZED"; message: string };

async function getActor(): Promise<ScannerAuthResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { ok: false, reason: "NOT_AUTHENTICATED", message: "Authentication required." };
  }

  const actor = await prisma.user.findUnique({
    where: { id: String(session.userId) },
    select: { id: true, role: true },
  });

  if (!actor) {
    return { ok: false, reason: "NOT_AUTHORIZED", message: "User not found." };
  }

  return { ok: true, actor };
}

async function hasGlobalPermission(role: Role, permission: Permission): Promise<boolean> {
  const entry = await prisma.rolePermission.findUnique({
    where: { role_permission: { role, permission } },
  });
  return Boolean(entry);
}

/**
 * Authorize any staff actor — must have SCAN_QR or MARK_ATTENDANCE permission.
 * Use requireGlobalPermission or requireEventPermission for tighter checks.
 */
export async function authorizeScannerActor(): Promise<ScannerAuthResult> {
  const base = await getActor();
  if (!base.ok) return base;
  if (base.actor.role === Role.ADMIN) return base;

  const canScan =
    (await hasGlobalPermission(base.actor.role, Permission.SCAN_QR)) ||
    (await hasGlobalPermission(base.actor.role, Permission.MARK_ATTENDANCE));

  if (!canScan) {
    return {
      ok: false,
      reason: "NOT_AUTHORIZED",
      message: "You do not have scanner access.",
    };
  }

  return base;
}

/**
 * Require a specific global permission.
 */
export async function requireGlobalPermission(
  permission: Permission
): Promise<ScannerAuthResult> {
  const base = await getActor();
  if (!base.ok) return base;
  if (base.actor.role === Role.ADMIN) return base;

  const allowed = await hasGlobalPermission(base.actor.role, permission);
  if (!allowed) {
    return {
      ok: false,
      reason: "NOT_AUTHORIZED",
      message: "You are not allowed to perform this action.",
    };
  }

  return base;
}

/**
 * Require a specific permission AND that the actor is assigned to the given event.
 * ADMIN bypasses both checks.
 */
export async function requireEventPermission(
  eventId: string,
  permission: Permission
): Promise<ScannerAuthResult> {
  const base = await getActor();
  if (!base.ok) return base;
  if (base.actor.role === Role.ADMIN) return base;

  // Step 1: role must have the required permission globally
  const allowed = await hasGlobalPermission(base.actor.role, permission);
  if (!allowed) {
    return {
      ok: false,
      reason: "NOT_AUTHORIZED",
      message: "Your role does not include this action.",
    };
  }

  // Step 2: actor must be assigned to this specific event
  const staffRole =
    base.actor.role === Role.COORDINATOR
      ? StaffRole.COORDINATOR
      : StaffRole.VOLUNTEER;

  const assignment = await prisma.eventStaffAssignment.findFirst({
    where: {
      eventId,
      userId: base.actor.id,
      staffRole,
    },
    select: { id: true },
  });

  if (!assignment) {
    return {
      ok: false,
      reason: "NOT_AUTHORIZED",
      message: "You are not assigned to this event.",
    };
  }

  return base;
}

/** Alias kept for backward-compatibility with existing call-sites. */
export async function requireScannerActor() {
  return authorizeScannerActor();
}
