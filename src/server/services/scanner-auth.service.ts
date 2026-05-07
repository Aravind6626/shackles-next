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

async function hasGlobalPermission(role: Role, permission: Permission) {
  const entry = await prisma.rolePermission.findUnique({
    where: {
      role_permission: {
        role,
        permission,
      },
    },
  });

  return Boolean(entry);
}

export async function authorizeScannerActor(): Promise<ScannerAuthResult> {
  const base = await getActor();
  if (!base.ok) {
    return base;
  }

  if (base.actor.role === Role.ADMIN) {
    return base;
  }

  const accessible = await prisma.rolePermission.findFirst({
    where: { role: base.actor.role },
    select: { role: true },
  });

  if (!accessible) {
    return { ok: false, reason: "NOT_AUTHORIZED", message: "You are not allowed to perform this action." };
  }

  return base;
}

export async function requireGlobalPermission(permission: Permission): Promise<ScannerAuthResult> {
  const base = await getActor();
  if (!base.ok) {
    return base;
  }

  if (base.actor.role === Role.ADMIN) {
    return base;
  }

  const allowed = await hasGlobalPermission(base.actor.role, permission);
  if (!allowed) {
    return { ok: false, reason: "NOT_AUTHORIZED", message: "You are not allowed to perform this action." };
  }

  return base;
}

export async function requireEventPermission(
  eventId: string,
  permission: Permission
): Promise<ScannerAuthResult> {
  const base = await getActor();
  if (!base.ok) {
    return base;
  }

  if (base.actor.role === Role.ADMIN) {
    return base;
  }

  const allowed = await hasGlobalPermission(base.actor.role, permission);
  if (!allowed) {
    return { ok: false, reason: "NOT_AUTHORIZED", message: "Your role does not include this action." };
  }

  const staffRole = base.actor.role === Role.COORDINATOR ? StaffRole.COORDINATOR : StaffRole.VOLUNTEER;
  const assignment = await prisma.eventStaffAssignment.findFirst({
    where: {
      eventId,
      userId: base.actor.id,
      staffRole,
    },
    select: { id: true },
  });

  if (!assignment) {
    return { ok: false, reason: "NOT_AUTHORIZED", message: "You are not assigned to this event." };
  }

  return base;
}

export async function requireScannerActor() {
  return authorizeScannerActor();
}
