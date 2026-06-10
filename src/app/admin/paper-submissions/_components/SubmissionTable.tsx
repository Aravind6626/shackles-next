'use client'

import { useState, useTransition } from 'react'
import { updateSelectionStatus, publishSelectionResults } from '@/server/actions/paper-submission'

type Submission = {
  id: string
  teamId: string
  eventId: string
  abstractUrl: string | null
  abstractSubmittedAt: string | null
  abstractDeadline: string | null
  selectionStatus: 'PENDING' | 'SELECTED' | 'REJECTED'
  selectedAt: string | null
  selectionNote: string | null
  presentationUrl: string | null
  presentationSubmittedAt: string | null
  presentationDeadline: string | null
  team: {
    id: string
    name: string
    teamCode: string
    memberCount: number
    leaderUserId: string | null
    leader: {
      id: string
      firstName: string
      lastName: string
      email: string
    } | null
  }
}

export default function SubmissionTable({
  submissions: initialSubmissions,
  eventId,
  eventName,
}: {
  submissions: Submission[]
  eventId: string
  eventName: string
}) {
  const [submissions, setSubmissions] = useState(initialSubmissions)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [publishDeadline, setPublishDeadline] = useState('')
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})

  function handleStatusChange(submissionId: string, status: 'SELECTED' | 'REJECTED' | 'PENDING') {
    const note = noteInputs[submissionId] || ''
    startTransition(async () => {
      setMessage(null)
      const result = await updateSelectionStatus({
        submissionId,
        eventId,
        status,
        note: note || undefined,
      })

      if (result.success) {
        setSubmissions(prev =>
          prev.map(s =>
            s.id === submissionId
              ? { ...s, selectionStatus: status, selectionNote: note || null, selectedAt: new Date().toISOString() }
              : s
          )
        )
        setMessage({ type: 'success', text: result.message || 'Status updated' })
      } else {
        setMessage({ type: 'error', text: result.error || 'Update failed' })
      }
    })
  }

  function handlePublish() {
    startTransition(async () => {
      setMessage(null)
      const result = await publishSelectionResults({
        eventId,
        presentationDeadline: publishDeadline || undefined,
      })

      if (result.success) {
        setMessage({ type: 'success', text: result.message || 'Published!' })
      } else {
        setMessage({ type: 'error', text: result.error || 'Publish failed' })
      }
    })
  }

  const selectedCount = submissions.filter(s => s.selectionStatus === 'SELECTED').length
  const rejectedCount = submissions.filter(s => s.selectionStatus === 'REJECTED').length
  const pendingCount = submissions.filter(s => s.selectionStatus === 'PENDING').length
  const decidedCount = selectedCount + rejectedCount

  return (
    <div>
      {/* Message */}
      {message && (
        <div className={`mb-4 rounded-lg p-3 text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Publish Section */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-lg font-semibold text-gray-900">Publish Selection Results</h3>
        <p className="mt-1 text-sm text-gray-500">
          This will send emails to all teams that have been marked as Selected or Rejected.
          ({decidedCount} decided, {pendingCount} still pending)
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Presentation Deadline (for selected teams)
            </label>
            <input
              type="datetime-local"
              value={publishDeadline}
              onChange={(e) => setPublishDeadline(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handlePublish}
            disabled={isPending || decidedCount === 0}
            className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Publishing...' : `Publish Results (${decidedCount} teams)`}
          </button>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-700">Team</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Leader</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Abstract</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Note</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Actions</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Presentation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {submissions.map((sub) => (
              <tr key={sub.id} className="hover:bg-gray-50/50">
                {/* Team */}
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{sub.team.name}</div>
                  <div className="text-xs text-gray-500">{sub.team.teamCode} · {sub.team.memberCount} members</div>
                </td>

                {/* Leader */}
                <td className="px-4 py-3">
                  {sub.team.leader ? (
                    <div>
                      <div className="text-gray-900">{sub.team.leader.firstName} {sub.team.leader.lastName}</div>
                      <div className="text-xs text-gray-500">{sub.team.leader.email}</div>
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>

                {/* Abstract */}
                <td className="px-4 py-3">
                  {sub.abstractUrl ? (
                    <div>
                      <a
                        href={sub.abstractUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                      >
                        📄 View
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                      {sub.abstractSubmittedAt && (
                        <div className="mt-0.5 text-[11px] text-gray-400">
                          {new Date(sub.abstractSubmittedAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      Not submitted
                    </span>
                  )}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    sub.selectionStatus === 'SELECTED'
                      ? 'bg-green-100 text-green-700'
                      : sub.selectionStatus === 'REJECTED'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {sub.selectionStatus === 'SELECTED' ? '✓ Selected'
                      : sub.selectionStatus === 'REJECTED' ? '✗ Rejected'
                      : '⏳ Pending'}
                  </span>
                </td>

                {/* Note */}
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={noteInputs[sub.id] ?? sub.selectionNote ?? ''}
                    onChange={(e) => setNoteInputs(prev => ({ ...prev, [sub.id]: e.target.value }))}
                    placeholder="Add note..."
                    className="w-full max-w-[200px] rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
                  />
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleStatusChange(sub.id, 'SELECTED')}
                      disabled={isPending || sub.selectionStatus === 'SELECTED'}
                      className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                        sub.selectionStatus === 'SELECTED'
                          ? 'bg-green-200 text-green-800 cursor-default'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      } disabled:opacity-50`}
                    >
                      Select
                    </button>
                    <button
                      onClick={() => handleStatusChange(sub.id, 'REJECTED')}
                      disabled={isPending || sub.selectionStatus === 'REJECTED'}
                      className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                        sub.selectionStatus === 'REJECTED'
                          ? 'bg-red-200 text-red-800 cursor-default'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                      } disabled:opacity-50`}
                    >
                      Reject
                    </button>
                    {sub.selectionStatus !== 'PENDING' && (
                      <button
                        onClick={() => handleStatusChange(sub.id, 'PENDING')}
                        disabled={isPending}
                        className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
                        title="Revert to Pending"
                      >
                        Revert
                      </button>
                    )}
                  </div>
                </td>

                {/* Presentation */}
                <td className="px-4 py-3">
                  {sub.selectionStatus === 'SELECTED' ? (
                    sub.presentationUrl ? (
                      <a
                        href={sub.presentationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 font-medium text-xs"
                      >
                        🎤 View
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">Awaiting</span>
                    )
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
