'use client'

import { useState } from 'react'

type PaperSubmissionData = {
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
}

export default function PaperSubmissionCard({
  submission,
  isLeader,
  teamName,
  eventName,
}: {
  submission: PaperSubmissionData
  isLeader: boolean
  teamName: string
  eventName: string
}) {
  const [abstractUrl, setAbstractUrl] = useState(submission.abstractUrl || '')
  const [presentationUrl, setPresentationUrl] = useState(submission.presentationUrl || '')
  const [abstractFile, setAbstractFile] = useState<File | null>(null)
  const [presentationFile, setPresentationFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const now = new Date()
  const abstractDeadline = submission.abstractDeadline ? new Date(submission.abstractDeadline) : null
  const presentationDeadline = submission.presentationDeadline ? new Date(submission.presentationDeadline) : null
  const isAbstractPastDeadline = abstractDeadline ? now > abstractDeadline : false
  const isPresentationPastDeadline = presentationDeadline ? now > presentationDeadline : false

  async function handleAbstractSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!abstractFile) return
    setLoading(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append('file', abstractFile)
      formData.append('type', 'abstract')
      formData.append('teamId', submission.teamId)
      formData.append('eventId', submission.eventId)

      const response = await fetch('/api/upload/paper-submission', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      if (response.ok && result.success) {
        setAbstractUrl(result.url)
        setAbstractFile(null)
        
        const fileInput = document.getElementById('abstract-file-input') as HTMLInputElement
        if (fileInput) fileInput.value = ''

        setMessage({ type: 'success', text: 'Abstract uploaded successfully!' })
      } else {
        setMessage({ type: 'error', text: result.error || 'Upload failed' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong' })
    } finally {
      setLoading(false)
    }
  }

  async function handlePresentationSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!presentationFile) return
    setLoading(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append('file', presentationFile)
      formData.append('type', 'presentation')
      formData.append('teamId', submission.teamId)
      formData.append('eventId', submission.eventId)

      const response = await fetch('/api/upload/paper-submission', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      if (response.ok && result.success) {
        setPresentationUrl(result.url)
        setPresentationFile(null)
        
        const fileInput = document.getElementById('presentation-file-input') as HTMLInputElement
        if (fileInput) fileInput.value = ''

        setMessage({ type: 'success', text: 'Presentation uploaded successfully!' })
      } else {
        setMessage({ type: 'error', text: result.error || 'Upload failed' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {/* Phase 1: Abstract Submission */}
      <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-gray-800">📄 Abstract Submission</h4>
          {abstractUrl ? (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
              Submitted ✓
            </span>
          ) : isAbstractPastDeadline ? (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
              Deadline Passed
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              Pending
            </span>
          )}
        </div>

        {abstractDeadline && (
          <p className="mt-1 text-xs text-gray-500">
            Deadline:{' '}
            <span className={isAbstractPastDeadline ? 'text-red-600 font-medium' : 'text-gray-700 font-medium'}>
              {abstractDeadline.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          </p>
        )}

        {abstractUrl && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-600 font-medium">Uploaded file:</span>
            <a
              href={abstractUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-200"
            >
              📄 Open Abstract
            </a>
          </div>
        )}

        {/* Abstract form: show for leader, if not past deadline or updating existing */}
        {isLeader && !isAbstractPastDeadline && (
          <form onSubmit={handleAbstractSubmit} className="mt-3 flex flex-col sm:flex-row gap-2">
            <input
              id="abstract-file-input"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setAbstractFile(e.target.files?.[0] || null)}
              required={!abstractUrl}
              className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-gray-700 hover:file:bg-gray-200 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !abstractFile}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Uploading...' : abstractUrl ? 'Update File' : 'Upload'}
            </button>
          </form>
        )}

        {!isLeader && !abstractUrl && !isAbstractPastDeadline && (
          <p className="mt-2 text-xs text-gray-500 italic">Your team leader will submit the abstract.</p>
        )}
      </div>

      {/* Phase 2: Selection Status */}
      {submission.selectionStatus !== 'PENDING' && (
        <div className={`rounded-lg border p-3 ${
          submission.selectionStatus === 'SELECTED'
            ? 'border-green-200 bg-green-50/50'
            : 'border-red-100 bg-red-50/50'
        }`}>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-800">
              {submission.selectionStatus === 'SELECTED' ? '🎉 Selected!' : '📋 Review Result'}
            </h4>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              submission.selectionStatus === 'SELECTED'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {submission.selectionStatus === 'SELECTED' ? 'Selected ✓' : 'Not Selected'}
            </span>
          </div>
          {submission.selectionNote && (
            <p className="mt-2 text-xs text-gray-600 italic">
              &ldquo;{submission.selectionNote}&rdquo;
            </p>
          )}
        </div>
      )}

      {submission.selectionStatus === 'PENDING' && abstractUrl && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs text-gray-500">
            ⏳ Your abstract is under review. Results will be announced soon.
          </p>
        </div>
      )}

      {/* Phase 3: Presentation Submission (only for selected teams) */}
      {submission.selectionStatus === 'SELECTED' && (
        <div className="rounded-lg border border-purple-100 bg-purple-50/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-gray-800">🎤 Presentation Submission</h4>
            {presentationUrl ? (
              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                Submitted ✓
              </span>
            ) : isPresentationPastDeadline ? (
              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                Deadline Passed
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                Pending
              </span>
            )}
          </div>

          {presentationDeadline && (
            <p className="mt-1 text-xs text-gray-500">
              Deadline:{' '}
              <span className={isPresentationPastDeadline ? 'text-red-600 font-medium' : 'text-gray-700 font-medium'}>
                {presentationDeadline.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </p>
          )}

          {presentationUrl && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-600 font-medium">Uploaded file:</span>
              <a
                href={presentationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700 transition hover:bg-purple-200"
              >
                🎤 Open Presentation
              </a>
            </div>
          )}

          {isLeader && !isPresentationPastDeadline && (
            <form onSubmit={handlePresentationSubmit} className="mt-3 flex flex-col sm:flex-row gap-2">
              <input
                id="presentation-file-input"
                type="file"
                accept=".pdf,.ppt,.pptx"
                onChange={(e) => setPresentationFile(e.target.files?.[0] || null)}
                required={!presentationUrl}
                className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-gray-700 hover:file:bg-gray-200 focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading || !presentationFile}
                className="rounded-md bg-purple-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Uploading...' : presentationUrl ? 'Update File' : 'Upload'}
              </button>
            </form>
          )}

          {!isLeader && !presentationUrl && !isPresentationPastDeadline && (
            <p className="mt-2 text-xs text-gray-500 italic">Your team leader will submit the presentation link.</p>
          )}
        </div>
      )}

      {/* Feedback message */}
      {message && (
        <div className={`rounded-md p-2 text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}
    </div>
  )
}
