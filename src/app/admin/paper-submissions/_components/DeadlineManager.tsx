'use client'

import { useState, useTransition } from 'react'
import { setAbstractDeadline, setPresentationDeadline } from '@/server/actions/paper-submission'

export default function DeadlineManager({ eventId }: { eventId: string }) {
  const [abstractDl, setAbstractDl] = useState('')
  const [presentationDl, setPresentationDl] = useState('')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function handleSetAbstractDeadline() {
    if (!abstractDl) return
    startTransition(async () => {
      setMessage(null)
      const result = await setAbstractDeadline({
        eventId,
        deadline: new Date(abstractDl).toISOString(),
      })
      if (result.success) {
        setMessage({ type: 'success', text: result.message || 'Deadline updated' })
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed' })
      }
    })
  }

  function handleSetPresentationDeadline() {
    if (!presentationDl) return
    startTransition(async () => {
      setMessage(null)
      const result = await setPresentationDeadline({
        eventId,
        deadline: new Date(presentationDl).toISOString(),
      })
      if (result.success) {
        setMessage({ type: 'success', text: result.message || 'Deadline updated' })
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed' })
      }
    })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-lg font-semibold text-gray-900">Deadline Management</h3>
      <p className="mt-1 text-sm text-gray-500">
        Update deadlines for all teams in this event.
      </p>

      {message && (
        <div className={`mt-3 rounded-md p-2 text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* Abstract Deadline */}
        <div className="rounded-lg border border-blue-100 bg-blue-50/30 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📄 Abstract Deadline
          </label>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={abstractDl}
              onChange={(e) => setAbstractDl(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleSetAbstractDeadline}
              disabled={isPending || !abstractDl}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? '...' : 'Set'}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-gray-500">Applies to all teams.</p>
        </div>

        {/* Presentation Deadline */}
        <div className="rounded-lg border border-purple-100 bg-purple-50/30 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            🎤 Presentation Deadline
          </label>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={presentationDl}
              onChange={(e) => setPresentationDl(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <button
              onClick={handleSetPresentationDeadline}
              disabled={isPending || !presentationDl}
              className="rounded-md bg-purple-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? '...' : 'Set'}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-gray-500">Applies to selected teams only.</p>
        </div>
      </div>
    </div>
  )
}
