import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

// GET: Fetch marks for a specific team
// Coordinator can view their event teams; SuperAdmin can view any team
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get('eventId')
    const teamId = searchParams.get('teamId')

    if (!eventId || !teamId) {
      return NextResponse.json(
        { error: 'eventId and teamId required' },
        { status: 400 }
      )
    }

    // Check authorization
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // SuperAdmin can view all; Coordinator must be assigned
    if (session.role !== 'ADMIN') {
      const assignment = await prisma.eventStaffAssignment.findFirst({
        where: {
          eventId,
          userId: session.userId,
          staffRole: 'COORDINATOR',
        },
        select: { id: true },
      })

      if (!assignment) {
        return NextResponse.json(
          { error: 'Not assigned to this event' },
          { status: 403 }
        )
      }
    }

    // Verify team belongs to event
    const team = await prisma.team.findFirst({
      where: { id: teamId, eventId },
      select: { id: true, name: true },
    })

    if (!team) {
      return NextResponse.json(
        { error: 'Team not found for this event' },
        { status: 404 }
      )
    }

    // Get team marks
    const teamMark = await prisma.teamMark.findFirst({
      where: { teamId, criteria: { eventId } },
      include: {
        componentMarks: {
          include: {
            component: {
              select: {
                id: true,
                name: true,
                maxMarksForComponent: true,
              },
            },
          },
        },
        criteria: {
          select: {
            id: true,
            name: true,
            maxMarks: true,
            numberOfJudges: true,
          },
        },
      },
    })

    if (!teamMark) {
      return NextResponse.json({
        success: true,
        marks: null,
        message: 'No marks submitted for this team yet',
      })
    }

    return NextResponse.json({
      success: true,
      marks: {
        teamId,
        teamName: team.name,
        totalMarks: Number(teamMark.totalMarks),
        isSubmitted: teamMark.isSubmitted,
        submittedAt: teamMark.submittedAt,
        criteria: teamMark.criteria,
        componentMarks: teamMark.componentMarks.map(cm => ({
          componentId: cm.componentId,
          componentName: cm.component.name,
          averageMarks: Number(cm.averageMarks),
          maxMarks: cm.component.maxMarksForComponent,
          judgeCount: cm.judgeCount,
        })),
      },
    })
  } catch (error) {
    console.error('GET /api/marking/team-marks error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch team marks' },
      { status: 500 }
    )
  }
}
