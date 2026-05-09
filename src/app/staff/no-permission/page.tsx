'use server'

import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function NoPermission() {
  const session = await getSession()
  if (!session?.userId) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M13.477 14.89A6 6 0 110 9c1.946 0 3.72.65 5.17 1.73v8.16h8.307zM15 11.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
        </div>

        <div className="mb-8">
          <p className="text-gray-600 mb-3">
            You don't have permission to access this resource.
          </p>
          <p className="text-gray-600 text-sm">
            Your current role and permissions don't allow you to perform this action.
          </p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
          <p className="text-red-800 text-sm">
            If you believe this is a mistake, please contact your administrator.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href={
              session.role === 'VOLUNTEER'
                ? '/staff/volunteerDashboard'
                : session.role === 'COORDINATOR'
                  ? '/staff/coordinatorDashboard'
                  : '/userDashboard'
            }
            className="block w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-lg transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
