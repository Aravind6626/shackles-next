import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkCanManageMarkingCriteria } from '@/lib/session'

// POST: Add a component to marking criteria
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      eventId,
      name,
      description,
      weightPercentage,
      maxMarksForComponent,
      order,
    } = body

    // Validate input
    if (!eventId || !name || weightPercentage === undefined || !maxMarksForComponent || order === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    // Get criteria for this event
    const criteria = await prisma.markingCriteria.findUnique({
      where: { eventId },
      include: { components: true },
    })

    if (!criteria) {
      return NextResponse.json(
        { error: 'Marking criteria not found' },
        { status: 404 }
      )
    }

    // Check if order already exists
    const existingOrder = await prisma.criteriaComponent.findFirst({
      where: {
        markingCriteriaId: criteria.id,
        order,
      },
      select: { id: true },
    })

    if (existingOrder) {
      return NextResponse.json(
        { error: `Component order ${order} already exists` },
        { status: 409 }
      )
    }

    // Create component
    const component = await prisma.criteriaComponent.create({
      data: {
        markingCriteriaId: criteria.id,
        name,
        description,
        weightPercentage,
        maxMarksForComponent,
        order,
      },
    })

    return NextResponse.json({
      success: true,
      componentId: component.id,
      message: 'Component added successfully',
    })
  } catch (error) {
    console.error('POST /api/marking/component error:', error)
    return NextResponse.json(
      { error: 'Failed to add component' },
      { status: 500 }
    )
  }
}

// DELETE: Remove a component
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get('eventId')
    const componentId = searchParams.get('componentId')

    if (!eventId || !componentId) {
      return NextResponse.json(
        { error: 'eventId and componentId required' },
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

    // Verify component belongs to this event
    const component = await prisma.criteriaComponent.findFirst({
      where: {
        id: componentId,
        criteria: { eventId },
      },
      select: { id: true },
    })

    if (!component) {
      return NextResponse.json(
        { error: 'Component not found for this event' },
        { status: 404 }
      )
    }

    // Delete component
    await prisma.criteriaComponent.delete({
      where: { id: componentId },
    })

    return NextResponse.json({
      success: true,
      message: 'Component deleted successfully',
    })
  } catch (error) {
    console.error('DELETE /api/marking/component error:', error)
    return NextResponse.json(
      { error: 'Failed to delete component' },
      { status: 500 }
    )
  }
}
