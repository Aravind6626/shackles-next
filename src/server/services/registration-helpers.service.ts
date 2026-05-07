/**
 * Shared helpers for registration logic
 * - Package eligibility checks
 * - Time clash detection
 * - QR token generation
 */

import { EventCategory, PackageType, Prisma, PrismaClient } from "@prisma/client";
import { getActiveYear } from "@/lib/edition";
import crypto from "node:crypto";

type DbClient = Prisma.TransactionClient | PrismaClient;

/**
 * Domain error types
 */
export class DomainError extends Error {
  constructor(
    public code: string,
    public message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DomainError";
  }
}

/**
 * Check if user has a valid verified package for the active year
 */
export async function getVerifiedPackage(
  db: DbClient,
  userId: string,
  year?: number
) {
  const targetYear = year || getActiveYear();

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      payment: {
        select: {
          status: true,
          packageType: true,
          year: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  if (
    user.payment?.status === "VERIFIED" &&
    user.payment?.year === targetYear &&
    user.payment?.packageType
  ) {
    return {
      packageType: user.payment.packageType as PackageType,
      year: user.payment.year,
    };
  }

  return null;
}

/**
 * Check if user's package allows registration for given event category
 */
export function canAccessEventCategory(
  packageType: PackageType,
  eventCategory?: EventCategory | null
): boolean {
  if (!eventCategory) {
    // If no category is specified, allow access (backward compatibility)
    return true;
  }

  switch (packageType) {
    case "EVENT_ONLY":
      return eventCategory === "EVENT";
    case "WORKSHOP_ONLY":
      return eventCategory === "WORKSHOP";
    case "COMBO":
      return true;
    default:
      return false;
  }
}

/**
 * Check for time clash between a new event and existing registrations
 */
export async function ensureNoTimeClash(
  db: DbClient,
  userId: string,
  newEventId: string,
  year?: number
): Promise<void> {
  const targetYear = year || getActiveYear();

  // Fetch the new event to get its time window
  const newEvent = await db.event.findUnique({
    where: { id: newEventId },
    select: {
      id: true,
      name: true,
      date: true,
      endDate: true,
      allDay: true,
    },
  });

  if (!newEvent) {
    throw new DomainError("EVENT_NOT_FOUND", "Event not found");
  }

  // If new event is all-day, no clash
  if (newEvent.allDay) {
    return;
  }

  // If new event has no time window, can't check for clashes
  if (!newEvent.date || !newEvent.endDate) {
    return;
  }

  // Get all existing registrations for this user in the same year
  const existingRegistrations = await db.eventRegistration.findMany({
    where: {
      userId,
      year: targetYear,
      event: {
        year: targetYear,
      },
    },
    select: {
      event: {
        select: {
          id: true,
          name: true,
          date: true,
          endDate: true,
          allDay: true,
        },
      },
    },
  });

  // Check each existing registration for time overlap
  for (const registration of existingRegistrations) {
    const existingEvent = registration.event;

    // Skip if existing event is all-day
    if (existingEvent.allDay) {
      continue;
    }

    // Skip if existing event has no time window
    if (!existingEvent.date || !existingEvent.endDate) {
      continue;
    }

    // Check for time overlap
    const newStart = newEvent.date.getTime();
    const newEnd = newEvent.endDate.getTime();
    const existingStart = existingEvent.date.getTime();
    const existingEnd = existingEvent.endDate.getTime();

    // Overlap occurs if new event starts before existing event ends AND new event ends after existing event starts
    const hasOverlap = newStart < existingEnd && newEnd > existingStart;

    if (hasOverlap) {
      throw new DomainError(
        "TIME_CLASH",
        `Time conflict with event: ${existingEvent.name}. You are already registered for an event at this time.`,
        {
          conflictingEventId: existingEvent.id,
          conflictingEventName: existingEvent.name,
          newEventId: newEvent.id,
          newEventName: newEvent.name,
        }
      );
    }
  }
}

/**
 * Generate a unique QR token for a user
 * Can be used with the user's shacklesId and year for encoding
 */
export function generateQRToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Generate a short join code for team invitations
 */
export function generateJoinCode(): string {
  // Generate a 6-8 character alphanumeric code
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Validate team size constraints
 */
export function validateTeamSize(
  memberCount: number,
  minSize?: number | null,
  maxSize?: number | null
): { valid: boolean; error?: string } {
  if (minSize && memberCount < minSize) {
    return {
      valid: false,
      error: `Team must have at least ${minSize} members (currently ${memberCount})`,
    };
  }

  if (maxSize && memberCount > maxSize) {
    return {
      valid: false,
      error: `Team cannot have more than ${maxSize} members (currently ${memberCount})`,
    };
  }

  return { valid: true };
}
