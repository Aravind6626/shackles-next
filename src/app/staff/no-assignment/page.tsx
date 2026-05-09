'use server'

import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function NoAssignment() {
  const session = await getSession()
  if (!session?.userId) {
    redirect('/login')
  }

  // Only show this to staff roles
  if (session.role !== 'VOLUNTEER' && session.role !== 'COORDINATOR') {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">No Events Assigned</h1>
        </div>

        <div className="mb-8">
          <p className="text-gray-600 mb-3">
            Hello <span className="font-semibold">{session.displayName || session.email}</span>,
          </p>
          <p className="text-gray-600">
            You are currently a <span className="font-semibold text-blue-600">{session.role}</span> but you haven't been assigned to any events yet.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <p className="text-blue-800 text-sm">
            Contact your administrator to get assigned to an event. Once assigned, you'll be able to access event-specific tools and dashboards.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/userDashboard"
            className="block w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-lg transition"
          >
            Go to User Dashboard
          </Link>
          <Link
            href="/login"
            className="block w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
          >
            Logout
          </Link>
        </div>
      </div>
    </div>
  )
}
