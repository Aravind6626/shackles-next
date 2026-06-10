import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { getDownloadUrl } from '@/lib/storage-url'
import SubmissionTable from '../_components/SubmissionTable'
import DeadlineManager from '../_components/DeadlineManager'

export default async function PaperSubmissionDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  const session = await getSession()
  if (!session?.userId) redirect('/login')

  const userRole = session.role

  // Authorization check
  if (userRole === 'ADMIN') {
    // Admin has access to all events
  } else if (userRole === 'COORDINATOR') {
    // Coordinator must be assigned to this event
    const assignment = await prisma.eventStaffAssignment.findFirst({
      where: {
        eventId,
        userId: session.userId,
        staffRole: 'COORDINATOR',
      },
      select: { id: true },
    })
    if (!assignment) redirect('/admin/paper-submissions')
  } else {
    redirect('/')
  }

  // Fetch event details
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      date: true,
      type: true,
      participationMode: true,
      requiresDocumentSubmission: true,
      submissionDeadline: true,
    },
  })

  if (!event || !event.requiresDocumentSubmission) {
    redirect('/admin/paper-submissions')
  }

  // Fetch all paper submissions with team and leader details
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

  // Pre-resolve dynamic URLs
  for (const s of submissions) {
    s.abstractUrl = await getDownloadUrl(s.abstractUrl) as string | null;
    s.presentationUrl = await getDownloadUrl(s.presentationUrl) as string | null;
  }

  // Serialize dates to strings for client component
  const serializedSubmissions = submissions.map(s => ({
    id: s.id,
    teamId: s.teamId,
    eventId: s.eventId,
    abstractUrl: s.abstractUrl,
    abstractSubmittedAt: s.abstractSubmittedAt?.toISOString() || null,
    abstractDeadline: s.abstractDeadline?.toISOString() || null,
    selectionStatus: s.selectionStatus as 'PENDING' | 'SELECTED' | 'REJECTED',
    selectedAt: s.selectedAt?.toISOString() || null,
    selectionNote: s.selectionNote,
    presentationUrl: s.presentationUrl,
    presentationSubmittedAt: s.presentationSubmittedAt?.toISOString() || null,
    presentationDeadline: s.presentationDeadline?.toISOString() || null,
    team: s.team,
  }))

  // Stats
  const totalTeams = submissions.length
  const abstractsSubmitted = submissions.filter(s => s.abstractSubmittedAt).length
  const selected = submissions.filter(s => s.selectionStatus === 'SELECTED').length
  const rejected = submissions.filter(s => s.selectionStatus === 'REJECTED').length
  const presentationsSubmitted = submissions.filter(s => s.presentationUrl).length

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Breadcrumb & Header */}
        <div className="mb-6">
          <Link
            href="/admin/paper-submissions"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-3"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to Paper Submissions
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{event.name}</h1>
              <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                {event.type && <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium">{event.type}</span>}
                {event.date && (
                  <span>{event.date.toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
                )}
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  Document Submission
                </span>
              </div>
            </div>
            {abstractsSubmitted > 0 && (
              <a
                href={`/api/admin/download-abstracts/${eventId}`}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Download All (.zip)
              </a>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
            <p className="text-3xl font-bold text-gray-900">{totalTeams}</p>
            <p className="mt-1 text-xs text-gray-500">Total Teams</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center shadow-sm">
            <p className="text-3xl font-bold text-blue-700">{abstractsSubmitted}</p>
            <p className="mt-1 text-xs text-blue-600">Abstracts Submitted</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center shadow-sm">
            <p className="text-3xl font-bold text-green-700">{selected}</p>
            <p className="mt-1 text-xs text-green-600">Selected</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center shadow-sm">
            <p className="text-3xl font-bold text-red-700">{rejected}</p>
            <p className="mt-1 text-xs text-red-600">Rejected</p>
          </div>
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-center shadow-sm">
            <p className="text-3xl font-bold text-purple-700">{presentationsSubmitted}</p>
            <p className="mt-1 text-xs text-purple-600">Presentations</p>
          </div>
        </div>

        {/* Deadline Manager */}
        <div className="mb-6">
          <DeadlineManager eventId={eventId} />
        </div>

        {/* Submissions Table */}
        {submissions.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
            <p className="text-gray-500">No teams have locked yet for this event.</p>
            <p className="mt-2 text-sm text-gray-400">
              Submissions will appear here once teams are locked.
            </p>
          </div>
        ) : (
          <SubmissionTable
            submissions={serializedSubmissions}
            eventId={eventId}
            eventName={event.name}
          />
        )}
      </div>
    </div>
  )
}
