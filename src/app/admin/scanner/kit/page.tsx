import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export default async function KitScannerPage({
  searchParams,
}: {
  searchParams: { eventId?: string }
}) {
  const session = await getSession()
  if (!session?.userId) {
    redirect('/login')
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: String(session.userId) },
    select: { role: true },
  })

  if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'COORDINATOR' && currentUser.role !== 'VOLUNTEER')) {
    redirect('/login')
  }

  const eventId = searchParams.eventId

  if (eventId) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, name: true },
    })

    if (!event) {
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 text-center">
            <p className="text-red-600 font-semibold">Event not found</p>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <p className="text-sm text-gray-600 uppercase tracking-wide">FOR KIT DISTRIBUTION</p>
          <h1 className="text-3xl font-bold text-gray-900">Issue Kit</h1>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-center py-12">
            Kit distribution scanner component coming soon. This page is reserved for kit issuance operations.
          </p>
        </div>
      </div>
    </div>
  )
}
