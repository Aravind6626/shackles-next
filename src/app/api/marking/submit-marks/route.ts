import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkCanSubmitMarks } from '@/lib/session'
import { z } from 'zod'

// Schema for bulk mark submission
const SubmitMarksSchema = z.object({
  eventId: z.string().cuid(),
  teamMarks: z.array(z.object({
    teamId: z.string().cuid(),
    judgeId: z.string().cuid().optional().describe('Judge ID if marking as judge; omit for admin aggregate'),
    componentMarks: z.array(z.object({
      componentId: z.string().cuid(),
      marks: z.number().min(0),
    })).min(1),
  })).min(1),
})

// POST: Submit marks for teams
// Coordinator or SuperAdmin can submit
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate input
    let validated
    try {
      validated = SubmitMarksSchema.parse(body)
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid request body', details: e },
        { status: 400 }
      )
    }

    const { eventId, teamMarks } = validated

    // Check authorization
    const authCheck = await checkCanSubmitMarks(eventId)
    if (!authCheck.allowed) {
      return NextResponse.json(
        { error: authCheck.error || 'Unauthorized' },
        { status: 403 }
      )
    }

    // Get criteria and components for validation
    const criteria = await prisma.markingCriteria.findUnique({
      where: { eventId },
      include: {
        components: true,
      },
    })

    if (!criteria) {
      return NextResponse.json(
        { error: 'Marking criteria not found for this event' },
        { status: 404 }
      )
    }

    // Validate components exist and marks are within bounds
    for (const tm of teamMarks) {
      for (const cm of tm.componentMarks) {
        const component = criteria.components.find(c => c.id === cm.componentId)
        if (!component) {
          return NextResponse.json(
            { error: `Component ${cm.componentId} not found` },
            { status: 400 }
          )
        }
        if (cm.marks > component.maxMarksForComponent) {
          return NextResponse.json(
            { error: `Marks for component ${component.name} exceed max (${component.maxMarksForComponent})` },
            { status: 400 }
          )
        }
      }
    }

    // Process marks in transaction
    const results: Array<{
  teamId: string;
  teamName?: string;
  success: boolean;
  error?: string;
  totalMarks?: number;
  componentMarksCount?: number;
}> = []

await prisma.$transaction(async (tx) => {
  for (const tm of teamMarks) {
    try {
      const team = await tx.team.findFirst({
        where: { id: tm.teamId, eventId },
        select: { id: true, name: true },
      })

      if (!team) {
        results.push({ teamId: tm.teamId, success: false, error: 'Team not found for this event' })
        continue
      }

      let teamMark = await tx.teamMark.findFirst({
        where: { teamId: tm.teamId, markingCriteriaId: criteria.id },
      })

      if (!teamMark) {
        teamMark = await tx.teamMark.create({
          data: { teamId: tm.teamId, markingCriteriaId: criteria.id, isSubmitted: false },
        })
      }

      if (tm.judgeId) {
        for (const cm of tm.componentMarks) {
          const existing = await tx.judgeMarking.findFirst({
            where: {
              teamId: tm.teamId,
              markingCriteriaId: criteria.id,
              componentId: cm.componentId,
              judgeId: tm.judgeId,
            },
            select: { id: true },
          })
          if (!existing) {
            await tx.judgeMarking.create({
              data: {
                teamId: tm.teamId,
                markingCriteriaId: criteria.id,
                componentId: cm.componentId,
                judgeId: tm.judgeId,
                marksAwarded: cm.marks,
              },
            })
          }
        }
      }

      let totalMarks = 0
      const componentUpdates = []

      for (const component of criteria.components) {
        const marksForComponent = tm.componentMarks.find(m => m.componentId === component.id)
        if (!marksForComponent) continue

        // ✅ FIX 4 applied here: weight-adjusted total
        const weighted = (marksForComponent.marks / component.maxMarksForComponent) * component.weightPercentage
        totalMarks += weighted

        // ✅ FIX 5 applied here: true average if judgeId present
        let finalAverage = marksForComponent.marks
        if (tm.judgeId) {
          const allJudgeMarks = await tx.judgeMarking.findMany({
            where: { teamId: tm.teamId, markingCriteriaId: criteria.id, componentId: component.id },
          })
          finalAverage = allJudgeMarks.reduce((s, j) => s + Number(j.marksAwarded), 0) / allJudgeMarks.length
        }

        const componentMark = await tx.componentMark.findFirst({
          where: { teamMarkId: teamMark.id, componentId: component.id },
        })

        if (componentMark) {
          await tx.componentMark.update({
            where: { id: componentMark.id },
            data: {
              averageMarks: finalAverage,
              judgeCount: tm.judgeId ? componentMark.judgeCount + 1 : 1,
            },
          })
        } else {
          await tx.componentMark.create({
            data: {
              teamMarkId: teamMark.id,
              componentId: component.id,
              averageMarks: finalAverage,
              judgeCount: 1,
            },
          })
        }

        componentUpdates.push({ componentId: component.id, marks: marksForComponent.marks })
      }

      await tx.teamMark.update({
        where: { id: teamMark.id },
        data: { totalMarks, isSubmitted: true, submittedAt: new Date() },
      })

      results.push({
        teamId: tm.teamId,
        teamName: team.name,
        success: true,
        totalMarks,
        componentMarksCount: componentUpdates.length,
      })
    } catch (error) {
      console.error(`Error submitting marks for team ${tm.teamId}:`, error)
      results.push({ teamId: tm.teamId, success: false, error: 'Failed to submit marks' })
    }
  }
})

    // Check if any succeeded
    const succeeded = results.filter(r => r.success).length
    const failed = results.length - succeeded

    return NextResponse.json({
      success: true,
      message: `Submitted marks for ${succeeded}/${results.length} teams`,
      results,
      summary: { succeeded, failed, total: results.length },
    })
  } catch (error) {
    console.error('POST /api/marking/submit-marks error:', error)
    return NextResponse.json(
      { error: 'Failed to submit marks' },
      { status: 500 }
    )
  }
}
