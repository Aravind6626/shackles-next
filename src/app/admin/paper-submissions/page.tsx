import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getActiveYear } from '@/lib/edition'
import Link from 'next/link'

export default async function PaperSubmissionsPage() {
  const session = await getSession()
  if (!session?.userId) redirect('/login')

  const userRole = session.role
  if (userRole !== 'ADMIN' && userRole !== 'COORDINATOR') {
    redirect('/')
  }

  const activeYear = getActiveYear()

  // Get events that require document submission
  let events

  if (userRole === 'ADMIN') {
    // Admin sees all events with document submission enabled
    events = await prisma.event.findMany({
      where: {
        year: activeYear,
        requiresDocumentSubmission: true,
        isArchived: false,
      },
      select: {
        id: true,
        name: true,
        date: true,
        type: true,
        participationMode: true,
        submissionDeadline: true,
        _count: {
          select: {
            paperSubmissions: true,
            teams: true,
          },
        },
        paperSubmissions: {
          select: {
            selectionStatus: true,
            abstractSubmittedAt: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })
  } else {
    // Coordinator sees only assigned events
    const assignments = await prisma.eventStaffAssignment.findMany({
      where: {
        userId: session.userId,
        staffRole: 'COORDINATOR',
        event: {
          year: activeYear,
          requiresDocumentSubmission: true,
          isArchived: false,
        },
      },
      select: { eventId: true },
    })

    const assignedEventIds = assignments.map(a => a.eventId)

    events = await prisma.event.findMany({
      where: {
        id: { in: assignedEventIds },
      },
      select: {
        id: true,
        name: true,
        date: true,
        type: true,
        participationMode: true,
        submissionDeadline: true,
        _count: {
          select: {
            paperSubmissions: true,
            teams: true,
          },
        },
        paperSubmissions: {
          select: {
            selectionStatus: true,
            abstractSubmittedAt: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Paper Submissions</h1>
          <p className="mt-2 text-gray-600">
            Manage document submissions for Paper Presentation events — SHACKLES {activeYear}
          </p>
        </div>

        {events.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
            <p className="text-gray-500">No events with document submission enabled.</p>
            {userRole === 'ADMIN' && (
              <p className="mt-2 text-sm text-gray-400">
                Set <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono">requiresDocumentSubmission</code> to <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono">true</code> in the database for Paper Presentation events.
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-6">
            {events.map((event) => {
              const totalSubmissions = event._count.paperSubmissions
              const abstractsSubmitted = event.paperSubmissions.filter(s => s.abstractSubmittedAt).length
              const selected = event.paperSubmissions.filter(s => s.selectionStatus === 'SELECTED').length
              const rejected = event.paperSubmissions.filter(s => s.selectionStatus === 'REJECTED').length
              const pending = event.paperSubmissions.filter(s => s.selectionStatus === 'PENDING').length

              return (
                <Link
                  key={event.id}
                  href={`/admin/paper-submissions/${event.id}`}
                  className="group block rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                        {event.name}
                      </h2>
                      <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                        {event.type && <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium">{event.type}</span>}
                        {event.date && (
                          <span>{event.date.toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
                        )}
                        <span>{event.participationMode}</span>
                      </div>
                    </div>
                    <svg className="mt-1 h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>

                  {/* Stats */}
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="rounded-lg bg-gray-50 p-3 text-center">
                      <p className="text-2xl font-bold text-gray-900">{event._count.teams}</p>
                      <p className="text-xs text-gray-500">Teams</p>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-3 text-center">
                      <p className="text-2xl font-bold text-blue-700">{abstractsSubmitted}</p>
                      <p className="text-xs text-blue-600">Abstracts</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3 text-center">
                      <p className="text-2xl font-bold text-amber-700">{pending}</p>
                      <p className="text-xs text-amber-600">Pending</p>
                    </div>
                    <div className="rounded-lg bg-green-50 p-3 text-center">
                      <p className="text-2xl font-bold text-green-700">{selected}</p>
                      <p className="text-xs text-green-600">Selected</p>
                    </div>
                    <div className="rounded-lg bg-red-50 p-3 text-center">
                      <p className="text-2xl font-bold text-red-700">{rejected}</p>
                      <p className="text-xs text-red-600">Rejected</p>
                    </div>
                  </div>

                  {event.submissionDeadline && (
                    <p className="mt-3 text-xs text-gray-500">
                      Event Deadline: {event.submissionDeadline.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
