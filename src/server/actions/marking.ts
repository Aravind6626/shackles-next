'use server'

import { prisma } from '@/lib/prisma'
import { requireMarkingCriteriaAccess, requireMarkSubmissionAccess, checkCanManageMarkingCriteria, checkCanSubmitMarks } from '@/lib/session'
import { Permission } from '@prisma/client'
import { z } from 'zod'

// Validation schemas
const CreateMarkingCriteriaSchema = z.object({
  eventId: z.string().cuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  maxMarks: z.number().int().min(1).max(10000),
  numberOfJudges: z.number().int().min(1).max(100),
  components: z.array(z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    weightPercentage: z.number().min(0).max(100),
    maxMarksForComponent: z.number().int().min(1),
    order: z.number().int().min(0),
  })).min(1, 'At least one component required'),
})

const UpdateMarkingCriteriaSchema = z.object({
  eventId: z.string().cuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  maxMarks: z.number().int().min(1).max(10000).optional(),
  numberOfJudges: z.number().int().min(1).max(100).optional(),
})

const AddComponentSchema = z.object({
  eventId: z.string().cuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  weightPercentage: z.number().min(0).max(100),
  maxMarksForComponent: z.number().int().min(1),
  order: z.number().int().min(0),
})

const DeleteComponentSchema = z.object({
  eventId: z.string().cuid(),
  componentId: z.string().cuid(),
})

const SubmitMarksSchema = z.object({
  eventId: z.string().cuid(),
  teamMarks: z.array(z.object({
    teamId: z.string().cuid(),
    componentMarks: z.array(z.object({
      componentId: z.string().cuid(),
      marks: z.number().min(0),
    })).min(1),
  })).min(1),
})

/**
 * Create marking criteria for an event with scoring components
 * SuperAdmin only
 */
export async function createMarkingCriteria(
  input: z.infer<typeof CreateMarkingCriteriaSchema>
) {
  try {
    // Validate input
    const validated = CreateMarkingCriteriaSchema.parse(input)

    // Check authorization
    const authCheck = await checkCanManageMarkingCriteria(validated.eventId)
    if (!authCheck.allowed) {
      return { success: false, error: authCheck.error || 'Unauthorized' }
    }

    // Check if criteria already exists for this event
    const existing = await prisma.markingCriteria.findUnique({
      where: { eventId: validated.eventId },
      select: { id: true },
    })

    if (existing) {
      return { success: false, error: 'Marking criteria already exists for this event' }
    }

    // Verify all components have valid weight percentages that sum appropriately
    const totalWeight = validated.components.reduce((sum, c) => sum + c.weightPercentage, 0)
    if (totalWeight !== 100) {
      return { success: false, error: `Component weights must sum to 100% (currently ${totalWeight}%)` }
    }

    // Create criteria with components in transaction
    const criteria = await prisma.markingCriteria.create({
      data: {
        eventId: validated.eventId,
        name: validated.name,
        description: validated.description,
        maxMarks: validated.maxMarks,
        numberOfJudges: validated.numberOfJudges,
        components: {
          createMany: {
            data: validated.components,
          },
        },
      },
      include: {
        components: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return {
      success: true,
      criteriaId: criteria.id,
      message: `Created marking criteria with ${criteria.components.length} components`,
    }
  } catch (error) {
    console.error('createMarkingCriteria error:', error)
    return { success: false, error: 'Failed to create marking criteria' }
  }
}

/**
 * Get marking criteria and components for an event
 */
export async function getMarkingCriteria(eventId: string) {
  try {
    const criteria = await prisma.markingCriteria.findUnique({
      where: { eventId },
      include: {
        components: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!criteria) {
      return { success: false, error: 'No marking criteria found for this event' }
    }

    return {
      success: true,
      criteria: {
        id: criteria.id,
        name: criteria.name,
        description: criteria.description,
        maxMarks: criteria.maxMarks,
        numberOfJudges: criteria.numberOfJudges,
        components: criteria.components.map(c => ({
          id: c.id,
          name: c.name,
          description: c.description,
          weightPercentage: c.weightPercentage,
          maxMarksForComponent: c.maxMarksForComponent,
          order: c.order,
        })),
        createdAt: criteria.createdAt,
      },
    }
  } catch (error) {
    console.error('getMarkingCriteria error:', error)
    return { success: false, error: 'Failed to fetch marking criteria' }
  }
}

/**
 * Update marking criteria details
 * SuperAdmin only
 */
export async function updateMarkingCriteria(
  input: z.infer<typeof UpdateMarkingCriteriaSchema>
) {
  try {
    const validated = UpdateMarkingCriteriaSchema.parse(input)

    // Check authorization
    const authCheck = await checkCanManageMarkingCriteria(validated.eventId)
    if (!authCheck.allowed) {
      return { success: false, error: authCheck.error || 'Unauthorized' }
    }

    // Update criteria
    const criteria = await prisma.markingCriteria.update({
      where: { eventId: validated.eventId },
      data: {
        ...(validated.name && { name: validated.name }),
        ...(validated.description !== undefined && { description: validated.description }),
        ...(validated.maxMarks && { maxMarks: validated.maxMarks }),
        ...(validated.numberOfJudges && { numberOfJudges: validated.numberOfJudges }),
      },
      include: {
        components: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return { success: true, criteriaId: criteria.id, message: 'Criteria updated successfully' }
  } catch (error) {
    console.error('updateMarkingCriteria error:', error)
    return { success: false, error: 'Failed to update marking criteria' }
  }
}

/**
 * Delete marking criteria for an event
 * SuperAdmin only
 */
export async function deleteMarkingCriteria(eventId: string) {
  try {
    // Check authorization
    const authCheck = await checkCanManageMarkingCriteria(eventId)
    if (!authCheck.allowed) {
      return { success: false, error: authCheck.error || 'Unauthorized' }
    }

    // Delete criteria (cascades to components, team marks, component marks, judge markings)
    await prisma.markingCriteria.delete({
      where: { eventId },
    })

    return { success: true, message: 'Marking criteria deleted successfully' }
  } catch (error) {
    console.error('deleteMarkingCriteria error:', error)
    return { success: false, error: 'Failed to delete marking criteria' }
  }
}

/**
 * Add a scoring component to existing criteria
 * SuperAdmin only
 */
export async function addComponent(input: z.infer<typeof AddComponentSchema>) {
  try {
    const validated = AddComponentSchema.parse(input)

    // Check authorization
    const authCheck = await checkCanManageMarkingCriteria(validated.eventId)
    if (!authCheck.allowed) {
      return { success: false, error: authCheck.error || 'Unauthorized' }
    }

    // Get current criteria to check weights
    const criteria = await prisma.markingCriteria.findUnique({
      where: { eventId: validated.eventId },
      include: { components: true },
    })

    if (!criteria) {
      return { success: false, error: 'Marking criteria not found' }
    }

    // Check if order already exists
    const existingOrder = await prisma.criteriaComponent.findFirst({
      where: {
        markingCriteriaId: criteria.id,
        order: validated.order,
      },
      select: { id: true },
    })

    if (existingOrder) {
      return { success: false, error: `Component order ${validated.order} already exists` }
    }

    // Create component
    const component = await prisma.criteriaComponent.create({
      data: {
        markingCriteriaId: criteria.id,
        name: validated.name,
        description: validated.description,
        weightPercentage: validated.weightPercentage,
        maxMarksForComponent: validated.maxMarksForComponent,
        order: validated.order,
      },
    })

    return {
      success: true,
      componentId: component.id,
      message: 'Component added successfully',
    }
  } catch (error) {
    console.error('addComponent error:', error)
    return { success: false, error: 'Failed to add component' }
  }
}

/**
 * Delete a scoring component
 * SuperAdmin only
 */
export async function deleteComponent(input: z.infer<typeof DeleteComponentSchema>) {
  try {
    const validated = DeleteComponentSchema.parse(input)

    // Check authorization
    const authCheck = await checkCanManageMarkingCriteria(validated.eventId)
    if (!authCheck.allowed) {
      return { success: false, error: authCheck.error || 'Unauthorized' }
    }

    // Verify component belongs to event's criteria
    const component = await prisma.criteriaComponent.findFirst({
      where: {
        id: validated.componentId,
        criteria: { eventId: validated.eventId },
      },
      select: { id: true },
    })

    if (!component) {
      return { success: false, error: 'Component not found for this event' }
    }

    // Delete component (cascades to judge markings for this component)
    await prisma.criteriaComponent.delete({
      where: { id: validated.componentId },
    })

    return { success: true, message: 'Component deleted successfully' }
  } catch (error) {
    console.error('deleteComponent error:', error)
    return { success: false, error: 'Failed to delete component' }
  }
}

/**
 * Get leaderboard with aggregated team marks
 * SuperAdmin only - judge identities hidden
 */
export async function getLeaderboard(eventId: string) {
  try {
    const criteria = await prisma.markingCriteria.findUnique({
      where: { eventId },
      include: {
        components: {
          orderBy: { order: 'asc' },
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
            componentMarks: true,
          },
          orderBy: { totalMarks: 'desc' },
        },
      },
    })

    if (!criteria) {
      return { success: false, error: 'No marking criteria found' }
    }

    // Check authorization - SuperAdmin only for leaderboard
    const session = await requireMarkingCriteriaAccess(eventId)
    if (!session) {
      return { success: false, error: 'Unauthorized' }
    }

    return {
      success: true,
      leaderboard: {
        eventId,
        maxMarks: criteria.maxMarks,
        components: criteria.components,
        teams: criteria.teamMarks.map((tm, index) => ({
          rank: index + 1,
          teamId: tm.team.id,
          teamName: tm.team.name,
          memberCount: tm.team.memberCount,
          totalMarks: Number(tm.totalMarks),
          submittedAt: tm.submittedAt,
          componentMarks: tm.componentMarks.map(cm => ({
            componentId: cm.componentId,
            averageMarks: Number(cm.averageMarks),
          })),
        })),
      },
    }
  } catch (error) {
    console.error('getLeaderboard error:', error)
    return { success: false, error: 'Failed to fetch leaderboard' }
  }
}
