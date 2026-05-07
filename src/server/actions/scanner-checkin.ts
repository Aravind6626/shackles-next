'use server';

import { prisma } from '@/lib/prisma';
import { Permission } from '@prisma/client';
import { requireEventPermission } from '@/server/services/scanner-auth.service';
import { decodeQrPayload, QrPayloadError } from '@/server/services/qr.service';
import { applyAttendanceMark } from '@/server/services/attendance.service';
import { getActiveYear } from '@/lib/edition';

interface CheckinParams {
  eventId: string;
  qrData: string; // encoded QR payload — never a raw userId
}

interface CheckinStatusParams {
  eventId: string;
  userId: string;
}

/**
 * Mark attendance for a participant via QR scan.
 * Requires the caller to be ADMIN or have MARK_ATTENDANCE permission
 * AND be assigned to the event as staff.
 */
export async function checkinParticipant(params: CheckinParams) {
  // 1. RBAC — must be ADMIN, or a COORDINATOR/VOLUNTEER assigned to this event
  const auth = await requireEventPermission(params.eventId, Permission.MARK_ATTENDANCE);
  if (!auth.ok) {
    return { success: false, error: auth.message };
  }

  // 2. Decode QR payload
  let userId: string;
  try {
    const payload = decodeQrPayload(params.qrData);
    if (payload.type !== 'USER') {
      return { success: false, error: 'Invalid QR type — expected a personal check-in QR.' };
    }
    userId = payload.uid;
  } catch (err) {
    if (err instanceof QrPayloadError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  // 3. Verify user exists and QR token is valid for active year
  const activeYear = getActiveYear();
  const user = await prisma.user.findUnique({
    where: { qrToken: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      shacklesId: true,
      payment: { select: { status: true, year: true } },
    },
  });

  if (!user) {
    return { success: false, error: 'QR token not found or invalid.' };
  }

  if (user.payment?.status !== 'VERIFIED' || user.payment?.year !== activeYear) {
    return {
      success: false,
      error: `Payment not verified for ${activeYear}. Please contact the registration desk.`,
    };
  }

  // 4. Look up event name for applyAttendanceMark
  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    select: { name: true },
  });

  if (!event) {
    return { success: false, error: 'Event not found.' };
  }

  // 5. Apply attendance — handles team-lock check + idempotency internally
  const result = await applyAttendanceMark({
    db: prisma,
    userId: user.id,
    eventName: event.name,
    notRegisteredMessage: 'Participant is not registered for this event.',
    alreadyAttendedMessage: `${user.firstName} ${user.lastName} has already been checked in.`,
    markedMessage: `Attendance marked for ${user.firstName} ${user.lastName}.`,
  });

  switch (result.status) {
    case 'EVENT_NOT_FOUND':
      return { success: false, error: result.message };
    case 'NOT_REGISTERED':
      return { success: false, error: result.message };
    case 'TEAM_NOT_COMPLETED':
      return { success: false, error: result.message };
    case 'ALREADY_ATTENDED':
      return {
        success: true,
        alreadyCheckedIn: true,
        data: {
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`,
          shacklesId: user.shacklesId,
          eventId: params.eventId,
          eventName: event.name,
          message: result.message,
        },
      };
    case 'MARKED':
      return {
        success: true,
        alreadyCheckedIn: false,
        data: {
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`,
          shacklesId: user.shacklesId,
          eventId: params.eventId,
          eventName: event.name,
          message: result.message,
        },
      };
  }
}

/**
 * Get check-in status for a participant.
 * Requires MARK_ATTENDANCE permission for the event.
 */
export async function getParticipantCheckinStatus(params: CheckinStatusParams) {
  const auth = await requireEventPermission(params.eventId, Permission.MARK_ATTENDANCE);
  if (!auth.ok) {
    return { success: false, error: auth.message };
  }

  try {
    const registration = await prisma.eventRegistration.findUnique({
      where: {
        userId_eventId: {
          userId: params.userId,
          eventId: params.eventId,
        },
      },
      include: {
        user: { select: { firstName: true, lastName: true, shacklesId: true } },
        event: { select: { name: true } },
        team: { select: { status: true } },
      },
    });

    if (!registration) {
      return { success: false, error: 'Participant not found for this event.' };
    }

    return {
      success: true,
      data: {
        userName: `${registration.user.firstName} ${registration.user.lastName}`,
        shacklesId: registration.user.shacklesId,
        eventName: registration.event.name,
        isCheckedIn: !!registration.attendedAt,
        checkedInAt: registration.attendedAt,
        teamStatus: registration.team?.status ?? null,
      },
    };
  } catch (error) {
    console.error('Check-in status error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get check-in status',
    };
  }
}
