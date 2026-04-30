#!/usr/bin/env tsx
/**
 * Database Cleanup Script
 * Removes soft-deleted and orphaned records from past years
 * Usage: tsx scripts/cleanup-stale-records.ts
 */

import { prisma } from "@/lib/prisma";
import { getActiveYear } from "@/lib/edition";

const YEARS_TO_KEEP = 2; // Keep current + 2 previous years

async function main() {
  console.log("[Cleanup] Starting database cleanup...");

  const activeYear = getActiveYear();
  const cutoffYear = activeYear - YEARS_TO_KEEP;

  console.log(`[Cleanup] Active year: ${activeYear}`);
  console.log(`[Cleanup] Cutoff year: ${cutoffYear}`);
  console.log(`[Cleanup] Removing records from year ${cutoffYear} and earlier...\n`);

  try {
    // Count records before cleanup
    const countBefore = {
      users: await prisma.user.count(),
      eventRegistrations: await prisma.eventRegistration.count(),
      payments: await prisma.payment.count(),
      teams: await prisma.team.count(),
    };

    console.log("Records before cleanup:");
    console.log(`  Users: ${countBefore.users}`);
    console.log(`  Event Registrations: ${countBefore.eventRegistrations}`);
    console.log(`  Payments: ${countBefore.payments}`);
    console.log(`  Teams: ${countBefore.teams}\n`);

    // Get list of events from cutoff year and earlier that are archived
    const oldArchivedEvents = await prisma.event.findMany({
      where: {
        year: { lte: cutoffYear },
        isArchived: true,
      },
      select: { id: true, year: true, name: true },
    });

    console.log(
      `[Cleanup] Found ${oldArchivedEvents.length} archived events from year ${cutoffYear} and earlier`
    );

    if (oldArchivedEvents.length === 0) {
      console.log("[Cleanup] No old archived events found. Nothing to cleanup.\n");
      console.log("[Cleanup] Cleanup completed successfully!");
      return;
    }

    const oldEventIds = oldArchivedEvents.map((e) => e.id);

    // Transaction to clean up old records
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete old event registrations
      const deletedRegistrations = await tx.eventRegistration.deleteMany({
        where: {
          eventId: { in: oldEventIds },
        },
      });

      // 2. Delete old team invites
      const deletedInvites = await tx.teamInvite.deleteMany({
        where: {
          team: {
            eventId: { in: oldEventIds },
          },
        },
      });

      // 3. Delete old teams
      const deletedTeams = await tx.team.deleteMany({
        where: {
          eventId: { in: oldEventIds },
        },
      });

      // 4. Delete old payments (archived users only)
      const deletedPayments = await tx.payment.deleteMany({
        where: {
          user: {
            registrationType: { not: undefined }, // Registered users in old years
            registrations: {
              none: {
                // No registrations in current year
                event: {
                  year: activeYear,
                },
              },
            },
          },
        },
      });

      // 5. Delete old accommodations
      const deletedAccommodations = await tx.accommodation.deleteMany({
        where: {
          user: {
            registrations: {
              none: {
                event: {
                  year: { gte: cutoffYear },
                },
              },
            },
          },
        },
      });

      return {
        registrations: deletedRegistrations.count,
        invites: deletedInvites.count,
        teams: deletedTeams.count,
        payments: deletedPayments.count,
        accommodations: deletedAccommodations.count,
      };
    });

    console.log("\nRecords deleted:");
    console.log(`  Event Registrations: ${result.registrations}`);
    console.log(`  Team Invites: ${result.invites}`);
    console.log(`  Teams: ${result.teams}`);
    console.log(`  Payments: ${result.payments}`);
    console.log(`  Accommodations: ${result.accommodations}`);

    // Count records after cleanup
    const countAfter = {
      users: await prisma.user.count(),
      eventRegistrations: await prisma.eventRegistration.count(),
      payments: await prisma.payment.count(),
      teams: await prisma.team.count(),
    };

    console.log("\nRecords after cleanup:");
    console.log(`  Users: ${countAfter.users} (${countAfter.users - countBefore.users > 0 ? "+" : ""}${countAfter.users - countBefore.users})`);
    console.log(
      `  Event Registrations: ${countAfter.eventRegistrations} (${countAfter.eventRegistrations - countBefore.eventRegistrations})`
    );
    console.log(`  Payments: ${countAfter.payments} (${countAfter.payments - countBefore.payments})`);
    console.log(`  Teams: ${countAfter.teams} (${countAfter.teams - countBefore.teams})`);

    console.log("\n[Cleanup] Cleanup completed successfully!");
  } catch (error) {
    console.error("[Cleanup] Error during cleanup:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
