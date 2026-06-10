'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { PaperSelectionStatus } from '@prisma/client'
import {
  sendPaperSelectionResultEmail,
} from '@/server/services/email.service'

// ─── Helpers ─────────────────────────────────────────────────────────────────

export async function assertAdminOrCoordinator(eventId: string) {
  const session = await getSession()
  if (!session?.userId) {
    return { error: 'Authentication required', session: null }
  }

  // ADMIN always allowed
  if (session.role === 'ADMIN') {
    return { error: null, session }
  }

  // COORDINATOR must be assigned to this event
  if (session.role === 'COORDINATOR') {
    const assignment = await prisma.eventStaffAssignment.findFirst({
      where: {
        eventId,
        userId: session.userId,
        staffRole: 'COORDINATOR',
      },
      select: { id: true },
    })

    if (assignment) {
      return { error: null, session }
    }
  }

  return { error: 'Insufficient permissions', session: null }
}



// ─── Admin/Coordinator Actions ───────────────────────────────────────────────

/**
 * Get all paper submissions for an event
 */
export async function getPaperSubmissions(eventId: string) {
  const auth = await assertAdminOrCoordinator(eventId)
  if (auth.error) {
    return { success: false, error: auth.error }
  }

  const submissions = await prisma.paperSubmission.findMany({
    where: { eventId },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          teamCode: true,
          memberCount: true,
          leaderUserId: true,
          leader: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return { success: true, submissions }
}

/**
 * Update selection status for a single submission
 */
export async function updateSelectionStatus(input: {
  submissionId: string
  eventId: string
  status: 'SELECTED' | 'REJECTED' | 'PENDING'
  note?: string
}) {
  const auth = await assertAdminOrCoordinator(input.eventId)
  if (auth.error) {
    return { success: false, error: auth.error }
  }

  const submission = await prisma.paperSubmission.findUnique({
    where: { id: input.submissionId },
    select: { id: true, eventId: true },
  })

  if (!submission || submission.eventId !== input.eventId) {
    return { success: false, error: 'Submission not found' }
  }

  await prisma.paperSubmission.update({
    where: { id: input.submissionId },
    data: {
      selectionStatus: input.status as PaperSelectionStatus,
      selectedAt: input.status === 'PENDING' ? null : new Date(),
      selectedBy: input.status === 'PENDING' ? null : auth.session!.userId,
      selectionNote: input.note || null,
    },
  })

  revalidatePath(`/admin/paper-submissions/${input.eventId}`)
  return { success: true, message: `Team marked as ${input.status}` }
}

/**
 * Publish selection results — sends emails to ALL teams with their status
 */
export async function publishSelectionResults(input: {
  eventId: string
  presentationDeadline?: string // ISO date string
}) {
  const auth = await assertAdminOrCoordinator(input.eventId)
  if (auth.error) {
    return { success: false, error: auth.error }
  }

  const presentationDeadline = input.presentationDeadline
    ? new Date(input.presentationDeadline)
    : null

  // Get all submissions with team members for this event
  const submissions = await prisma.paperSubmission.findMany({
    where: {
      eventId: input.eventId,
      selectionStatus: { not: 'PENDING' }, // Only publish decided ones
    },
    include: {
      team: {
        select: {
          id: true,
          teamCode: true,
          name: true,
          members: {
            select: {
              memberRole: true,
              user: {
                select: {
                  email: true,
                  firstName: true,
                },
              },
            },
          },
        },
      },
      event: {
        select: { name: true },
      },
    },
  })

  if (submissions.length === 0) {
    return { success: false, error: 'No submissions have been reviewed yet' }
  }

  // Update presentation deadline for selected teams
  if (presentationDeadline) {
    await prisma.paperSubmission.updateMany({
      where: {
        eventId: input.eventId,
        selectionStatus: 'SELECTED',
      },
      data: {
        presentationDeadline,
      },
    })
  }

  // Send emails to all team members
  const emailPromises: Promise<any>[] = []

  for (const submission of submissions) {
    for (const member of submission.team.members) {
      emailPromises.push(
        sendPaperSelectionResultEmail({
          memberEmail: member.user.email,
          memberName: member.user.firstName,
          teamId: submission.team.id,
          teamName: submission.team.name,
          eventName: submission.event.name,
          selectionStatus: submission.selectionStatus as 'SELECTED' | 'REJECTED',
          selectionNote: submission.selectionNote,
          presentationDeadline:
            submission.selectionStatus === 'SELECTED' ? presentationDeadline : null,
          isLeader: member.memberRole === 'LEADER',
        })
      )
    }
  }

  await Promise.allSettled(emailPromises)

  revalidatePath(`/admin/paper-submissions/${input.eventId}`)
  revalidatePath('/userDashboard')

  return {
    success: true,
    message: `Selection results published. Emails sent to ${submissions.length} teams.`,
  }
}

/**
 * Set abstract deadline for all submissions of an event
 */
export async function setAbstractDeadline(input: {
  eventId: string
  deadline: string // ISO date string
}) {
  const auth = await assertAdminOrCoordinator(input.eventId)
  if (auth.error) {
    return { success: false, error: auth.error }
  }

  const deadline = new Date(input.deadline)
  if (isNaN(deadline.getTime())) {
    return { success: false, error: 'Invalid deadline date' }
  }

  await prisma.paperSubmission.updateMany({
    where: { eventId: input.eventId },
    data: { abstractDeadline: deadline },
  })

  revalidatePath(`/admin/paper-submissions/${input.eventId}`)
  return { success: true, message: 'Abstract deadline updated' }
}

/**
 * Set presentation deadline for selected teams
 */
export async function setPresentationDeadline(input: {
  eventId: string
  deadline: string // ISO date string
}) {
  const auth = await assertAdminOrCoordinator(input.eventId)
  if (auth.error) {
    return { success: false, error: auth.error }
  }

  const deadline = new Date(input.deadline)
  if (isNaN(deadline.getTime())) {
    return { success: false, error: 'Invalid deadline date' }
  }

  await prisma.paperSubmission.updateMany({
    where: {
      eventId: input.eventId,
      selectionStatus: 'SELECTED',
    },
    data: { presentationDeadline: deadline },
  })

  revalidatePath(`/admin/paper-submissions/${input.eventId}`)
  return { success: true, message: 'Presentation deadline updated' }
}
