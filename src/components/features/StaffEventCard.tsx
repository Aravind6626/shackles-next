'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LeaderboardView } from './LeaderboardView'
import { 
  QrCode, 
  Users, 
  FileText, 
  Trophy, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  ShieldCheck,
  Calendar
} from 'lucide-react'

interface StaffEventCardProps {
  event: {
    id: string
    name: string
    date: string | Date
    type: string | null
    participationMode: string | null
    staffRole: 'VOLUNTEER' | 'COORDINATOR'
  }
}

export function StaffEventCard({ event }: StaffEventCardProps) {
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const isCoordinator = event.staffRole === 'COORDINATOR'

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-md">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                isCoordinator ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {event.staffRole}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Calendar size={12} />
                {new Date(event.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">{event.name}</h3>
            {event.type && (
              <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">
                {event.type} • {event.participationMode || 'N/A'}
              </p>
            )}
          </div>

          <Link
            href={`/admin/scanner?eventId=${event.id}`}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-xl transition shadow-lg shadow-blue-100 text-sm w-full sm:w-auto justify-center"
          >
            <QrCode size={18} />
            Start Scanner
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {isCoordinator && (
            <>
              <Link
                href={`/admin/event-registrations/${event.id}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-slate-500 shadow-sm group-hover:text-blue-600 transition-colors">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Manage Teams</p>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">Registration Control</p>
                </div>
                <ExternalLink size={14} className="ml-auto text-slate-300" />
              </Link>

              <Link
                href={`/admin/marking/allocate?eventId=${event.id}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-slate-500 shadow-sm group-hover:text-violet-600 transition-colors">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Allocate Marks</p>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">Scoring Console</p>
                </div>
                <ExternalLink size={14} className="ml-auto text-slate-300" />
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setShowLeaderboard(!showLeaderboard)}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all border ${
            showLeaderboard 
              ? 'bg-slate-900 text-white border-slate-900' 
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <Trophy size={16} />
          {showLeaderboard ? 'Hide Leaderboard' : 'View Live Leaderboard'}
          {showLeaderboard ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {showLeaderboard && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-6 animate-in slide-in-from-top-4 duration-300">
          <LeaderboardView eventId={event.id} />
        </div>
      )}
    </div>
  )
}
