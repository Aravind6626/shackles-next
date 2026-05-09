import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkCanManageMarkingCriteria } from '@/lib/session'
import { z } from 'zod'

// GET: Fetch marking criteria for an event
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

    const criteria = await prisma.markingCriteria.findUnique({
      where: { eventId },
      include: {
        components: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!criteria) {
      return NextResponse.json(
        { error: 'Marking criteria not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      criteria: {
        id: criteria.id,
        name: criteria.name,
        description: criteria.description,
        maxMarks: criteria.maxMarks,
        numberOfJudges: criteria.numberOfJudges,
        components: criteria.components,
        createdAt: criteria.createdAt,
        updatedAt: criteria.updatedAt,
      },
    })
  } catch (error) {
    console.error('GET /api/marking/criteria error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch criteria' },
      { status: 500 }
    )
  }
}

// POST: Create marking criteria
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { eventId, name, description, maxMarks, numberOfJudges, components } = body

    // Validate input
    if (!eventId || !name || !maxMarks || !numberOfJudges || !components?.length) {
      return NextResponse.json(
        { error: 'Missing required fields: eventId, name, maxMarks, numberOfJudges, components[]' },
        { status: 400 }
      )
    }

    // Check authorization
    const authCheck = await checkCanManageMarkingCriteria(eventId)
    if (!authCheck.allowed) {
      return NextResponse.json(
        { error: authCheck.error || 'Unauthorized' },
        { status: 403 }
      )
    }

    // Check if criteria already exists
    const existing = await prisma.markingCriteria.findUnique({
      where: { eventId },
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Marking criteria already exists for this event' },
        { status: 409 }
      )
    }

    // Verify weight sum
    const totalWeight = components.reduce((sum: number, c: any) => sum + (c.weightPercentage || 0), 0)
    if (totalWeight !== 100) {
      return NextResponse.json(
        { error: `Component weights must sum to 100% (got ${totalWeight}%)` },
        { status: 400 }
      )
    }

    // Create criteria with components
    const criteria = await prisma.markingCriteria.create({
      data: {
        eventId,
        name,
        description,
        maxMarks,
        numberOfJudges,
        components: {
          createMany: {
            data: components,
          },
        },
      },
      include: {
        components: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return NextResponse.json({
      success: true,
      criteriaId: criteria.id,
      message: `Created marking criteria with ${criteria.components.length} components`,
    })
  } catch (error) {
    console.error('POST /api/marking/criteria error:', error)
    return NextResponse.json(
      { error: 'Failed to create criteria' },
      { status: 500 }
    )
  }
}

// PUT: Update marking criteria
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { eventId, name, description, maxMarks, numberOfJudges } = body

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId required' },
        { status: 400 }
      )
    }

    // Check authorization
    const authCheck = await checkCanManageMarkingCriteria(eventId)
    if (!authCheck.allowed) {
      return NextResponse.json(
        { error: authCheck.error || 'Unauthorized' },
        { status: 403 }
      )
    }

    // Update criteria
    const criteria = await prisma.markingCriteria.update({
      where: { eventId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(maxMarks && { maxMarks }),
        ...(numberOfJudges && { numberOfJudges }),
      },
      include: {
        components: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return NextResponse.json({
      success: true,
      criteriaId: criteria.id,
      message: 'Criteria updated successfully',
    })
  } catch (error) {
    console.error('PUT /api/marking/criteria error:', error)
    return NextResponse.json(
      { error: 'Failed to update criteria' },
      { status: 500 }
    )
  }
}

// DELETE: Delete marking criteria
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get('eventId')

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId required' },
        { status: 400 }
      )
    }

    // Check authorization
    const authCheck = await checkCanManageMarkingCriteria(eventId)
    if (!authCheck.allowed) {
      return NextResponse.json(
        { error: authCheck.error || 'Unauthorized' },
        { status: 403 }
      )
    }

    // Delete criteria (cascades to related records)
    await prisma.markingCriteria.delete({
      where: { eventId },
    })

    return NextResponse.json({
      success: true,
      message: 'Marking criteria deleted successfully',
    })
  } catch (error) {
    console.error('DELETE /api/marking/criteria error:', error)
    return NextResponse.json(
      { error: 'Failed to delete criteria' },
      { status: 500 }
    )
  }
}
