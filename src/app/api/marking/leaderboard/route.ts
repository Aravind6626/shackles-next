import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

// GET: Fetch leaderboard with aggregated team marks
// SuperAdmin only
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get('eventId')

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId required' },
        { status: 400 }
      )
    }

    // Check if user is SuperAdmin
    const session = await getSession()
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only SuperAdmin can view leaderboard' },
        { status: 403 }
      )
    }

    // Get marking criteria with team marks
    const criteria = await prisma.markingCriteria.findUnique({
      where: { eventId },
      include: {
        components: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
            order: true,
            weightPercentage: true,
            maxMarksForComponent: true,
          },
        },
        teamMarks: {
          where: { isSubmitted: true },
          include: {
            team: {
              select: {
                id: true,
                name: true,
                memberCount: true,
              },
            },
            componentMarks: {
              include: {
                component: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: [
            { totalMarks: 'desc' },
            { createdAt: 'desc' },
          ],
        },
      },
    })

    if (!criteria) {
      return NextResponse.json(
        { error: 'No marking criteria found for this event' },
        { status: 404 }
      )
    }

    // Build leaderboard with ranks
    const leaderboard = criteria.teamMarks.map((tm, index) => ({
      rank: index + 1,
      teamId: tm.team.id,
      teamName: tm.team.name,
      memberCount: tm.team.memberCount,
      totalMarks: Number(tm.totalMarks),
      submittedAt: tm.submittedAt,
      componentMarks: tm.componentMarks.map(cm => ({
        componentId: cm.component.id,
        componentName: cm.component.name,
        averageMarks: Number(cm.averageMarks),
        judgeCount: cm.judgeCount,
      })),
    }))

    return NextResponse.json({
      success: true,
      leaderboard: {
        eventId,
        criteriaName: criteria.name,
        maxMarks: criteria.maxMarks,
        numberOfJudges: criteria.numberOfJudges,
        components: criteria.components,
        teams: leaderboard,
        totalTeamsSubmitted: leaderboard.length,
      },
    })
  } catch (error) {
    console.error('GET /api/marking/leaderboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}
