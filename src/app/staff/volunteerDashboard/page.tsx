import { getSession, getStaffAssignedEvents } from '@/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getActiveYear } from '@/lib/edition'
import { getKitsIssuedCount } from '@/server/actions/event-logistics'
import Link from 'next/link'
import { Package, User, Mail, ShieldCheck, Calendar, Users, CheckCircle } from 'lucide-react'
import { StaffEventCard } from '@/components/features/StaffEventCard'

export default async function VolunteerDashboard() {
  const activeYear = getActiveYear()
  
  // Verify session
  const session = await getSession()
  if (!session?.userId) {
    redirect('/login')
  }

  // Verify user is a volunteer
  if (session.role !== 'VOLUNTEER') {
    redirect('/')
  }

  // Get assigned events
  const assignedEvents = await getStaffAssignedEvents()

  // Get some stats for the dashboard
  const totalEventsAssigned = assignedEvents.length
  
  const totalParticipants = await Promise.all(
    assignedEvents.map(async (event) => {
      const count = await prisma.eventRegistration.count({
        where: { eventId: event.id },
      })
      return count
    })
  ).then(counts => counts.reduce((a, b) => a + b, 0))

  const totalAttended = await Promise.all(
    assignedEvents.map(async (event) => {
      const count = await prisma.eventRegistration.count({
        where: { eventId: event.id, attended: true },
      })
      return count
    })
  ).then(counts => counts.reduce((a, b) => a + b, 0))

  const isKitDistributionVolunteer = assignedEvents.some(e => e.name === 'KIT DISTRIBUTION')
  
  // Get kit stats if applicable
  let kitsIssuedTotal = 0
  if (isKitDistributionVolunteer) {
    const kitRes = await getKitsIssuedCount()
    if (kitRes.success) {
      kitsIssuedTotal = kitRes.count
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Volunteer Dashboard</h1>
          <p className="text-gray-600 mt-2">SHACKLES {activeYear}</p>
        </div>

        {/* Kit Distribution Featured Action */}
        {isKitDistributionVolunteer && (
          <div className="mb-8 overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-xl border border-blue-400">
            <div className="p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/30 text-blue-100 text-xs font-bold uppercase tracking-wider mb-3">
                  Priority Task
                </div>
                <h2 className="text-3xl font-extrabold text-white mb-2">Kit Distribution</h2>
                <p className="text-blue-100 text-lg max-w-md">
                  You are assigned to Kit Distribution. Use the scanner below to issue kits to participants.
                </p>
              </div>
              <Link
                href="/admin/scanner/kit"
                className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-blue-700 transition-all duration-200 bg-white font-pj rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white hover:bg-blue-50"
              >
                <svg className="w-6 h-6 mr-2 -ml-1 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                Open Kit Scanner
              </Link>
            </div>
          </div>
        )}

        {/* User Info */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Name</p>
              <p className="text-lg font-semibold text-gray-900">
                {session.displayName || session.email}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="text-lg font-semibold text-gray-900">{session.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Role</p>
              <p className="text-lg font-semibold text-blue-600">VOLUNTEER</p>
            </div>

          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
          {isKitDistributionVolunteer ? (
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 border-l-4 border-teal-500 col-span-full sm:col-span-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-gray-600 font-semibold text-sm uppercase tracking-wide">
                  Kits Distributed
                </h3>
                <Package className="text-teal-500" size={20} />
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-gray-900">{kitsIssuedTotal}</p>
              <p className="text-xs text-gray-500 mt-2">Total kits issued across all sessions</p>
            </div>
          ) : (
            <>


              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 border-l-4 border-green-500">
                <h3 className="text-gray-600 font-semibold text-sm uppercase tracking-wide mb-2">
                  Total Participants
                </h3>
                <p className="text-3xl sm:text-4xl font-bold text-gray-900">{totalParticipants}</p>
              </div>

              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 border-l-4 border-purple-500">
                <h3 className="text-gray-600 font-semibold text-sm uppercase tracking-wide mb-2">
                  Marked Attended
                </h3>
                <p className="text-3xl sm:text-4xl font-bold text-gray-900">{totalAttended}</p>
              </div>
            </>
          )}
        </div>

        {/* Assigned Events with Management Controls */}
        {assignedEvents.filter(e => e.name !== 'KIT DISTRIBUTION').length > 0 && (
          <div className="space-y-6 mb-8">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              Your Assigned Events
              <span className="inline-flex items-center justify-center bg-blue-600 text-white text-[10px] font-black w-5 h-5 rounded-full">
                {assignedEvents.filter(e => e.name !== 'KIT DISTRIBUTION').length}
              </span>
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {assignedEvents.filter(e => e.name !== 'KIT DISTRIBUTION').map((event: any) => (
                <StaffEventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        )}


      </div>
    </div>
  )
}



