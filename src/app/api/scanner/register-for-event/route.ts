import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkEventStaff } from "@/lib/session";
import { Permission } from "@prisma/client";
import { getActiveYear } from "@/lib/edition";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { shacklesId, eventId } = body;

    if (!shacklesId || !eventId) {
      return NextResponse.json(
        { success: false, error: "Missing shacklesId or eventId" },
        { status: 400 }
      );
    }

    // Authorize access to this event
    const { allowed, error } = await checkEventStaff(eventId, Permission.SCAN_ATTENDANCE);
    if (!allowed) {
      return NextResponse.json({ success: false, error: error || "Forbidden" }, { status: 403 });
    }

    // Find user by shacklesId
    const user = await prisma.user.findUnique({
      where: { shacklesId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Participant not found" },
        { status: 404 }
      );
    }

    // Check if already registered
    const existingRegistration = await prisma.eventRegistration.findFirst({
      where: { userId: user.id, eventId },
      select: { id: true },
    });

    if (existingRegistration) {
      return NextResponse.json(
        { success: false, error: "Participant already registered for this event" },
        { status: 400 }
      );
    }

    const activeYear = getActiveYear();

    // Create registration without team and without marking attended
    const registration = await prisma.eventRegistration.create({
      data: {
        userId: user.id,
        eventId,
        year: activeYear,
        attended: false,
      },
      select: { id: true },
    });

    return NextResponse.json({
      success: true,
      registrationId: registration.id,
      message: "Participant registered for event. Scan again to mark attendance.",
    });
  } catch (error) {
    console.error("Register for Event Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
