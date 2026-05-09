import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkEventStaff } from "@/lib/session";
import { Permission } from "@prisma/client";
import { getActiveYear } from "@/lib/edition";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { scannedShacklesId, memberShacklesIds, eventId } = body;

    if (!scannedShacklesId || !memberShacklesIds || !eventId) {
      return NextResponse.json(
        { success: false, error: "Missing scannedShacklesId, memberShacklesIds, or eventId" },
        { status: 400 }
      );
    }

    if (!Array.isArray(memberShacklesIds)) {
      return NextResponse.json(
        { success: false, error: "memberShacklesIds must be an array" },
        { status: 400 }
      );
    }

    // Authorize access to this event
    const { allowed, error } = await checkEventStaff(eventId, Permission.SCAN_ATTENDANCE);
    if (!allowed) {
      return NextResponse.json({ success: false, error: error || "Forbidden" }, { status: 403 });
    }

    // Fetch event to get team size constraints
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        type: true,
        teamMinSize: true,
        teamMaxSize: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      );
    }

    // Find captain by shacklesId
    const captain = await prisma.user.findUnique({
      where: { shacklesId: scannedShacklesId },
      select: { id: true },
    });

    if (!captain) {
      return NextResponse.json(
        { success: false, error: "Captain (scanned user) not found" },
        { status: 404 }
      );
    }

    // Find all members by shacklesIds
    const members = await prisma.user.findMany({
      where: { shacklesId: { in: memberShacklesIds } },
      select: { id: true, shacklesId: true },
    });

    if (members.length !== memberShacklesIds.length) {
      const foundIds = new Set(members.map((m) => m.shacklesId));
      const missingIds = memberShacklesIds.filter((id) => !foundIds.has(id));
      return NextResponse.json(
        { success: false, error: `Members not found: ${missingIds.join(", ")}` },
        { status: 404 }
      );
    }

    // Validate team size
    const totalSize = 1 + memberShacklesIds.length;
    if (event.teamMinSize && totalSize < event.teamMinSize) {
      return NextResponse.json(
        { success: false, error: `Team size ${totalSize} is below minimum ${event.teamMinSize}` },
        { status: 400 }
      );
    }
    if (event.teamMaxSize && totalSize > event.teamMaxSize) {
      return NextResponse.json(
        { success: false, error: `Team size ${totalSize} exceeds maximum ${event.teamMaxSize}` },
        { status: 400 }
      );
    }

    // Ensure no duplicates (captain not in members, and members are unique)
    const memberIds = members.map((m) => m.id);
    if (memberIds.includes(captain.id)) {
      return NextResponse.json(
        { success: false, error: "Captain cannot be in team members list" },
        { status: 400 }
      );
    }
    if (new Set(memberIds).size !== memberIds.length) {
      return NextResponse.json(
        { success: false, error: "Duplicate members in team" },
        { status: 400 }
      );
    }

    const activeYear = getActiveYear();

    // Check that none of these users are already in a team for this event
    const existingRegs = await prisma.eventRegistration.findMany({
      where: {
        eventId,
        userId: { in: [captain.id, ...memberIds] },
      },
      select: { userId: true, teamId: true },
    });

    for (const reg of existingRegs) {
      if (reg.teamId) {
        return NextResponse.json(
          { success: false, error: "One or more team members already in a team for this event" },
          { status: 400 }
        );
      }
    }

    // Transaction: create team and registrations
    const team = await prisma.team.create({
      data: {
        eventId,
        status: "OPEN", // Teams start OPEN; volunteer must manually lock before attendance marking
        year: activeYear,
      },
    });

    // Create registrations for all team members (captain + members)
    const allTeamUserIds = [captain.id, ...memberIds];
    await prisma.eventRegistration.createMany({
      data: allTeamUserIds.map((userId) => ({
        userId,
        eventId,
        teamId: team.id,
        year: activeYear,
        attended: false,
      })),
    });

    return NextResponse.json({
      success: true,
      teamId: team.id,
      totalMembers: totalSize,
      message: "Team created successfully. Team must be locked before marking attendance.",
    });
  } catch (error) {
    console.error("Create Team Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
