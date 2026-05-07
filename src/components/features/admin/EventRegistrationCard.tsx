'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { MemberDeleteForm, TeamDeleteForm } from './EventRegistrationDeleteForms';

type EventRegistration = {
  id: string;
  userId: string;
  eventId: string;
  teamId: string | null;
  memberRole: string | null;
  teamName: string | null;
  teamSize: number;
  attended: boolean;
  attendedAt: Date | null;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
  team: {
    id: string;
    name: string;
    leaderUserId: string | null;
  } | null;
};

type EventWithRegistrations = {
  id: string;
  name: string;
  type: string | null;
  registrations: EventRegistration[];
};

interface EventRegistrationCardProps {
  event: EventWithRegistrations;
}

export default function EventRegistrationCard({ event }: EventRegistrationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const teamMap = new Map<string, { id: string; name: string; memberCount: number }>();
  for (const reg of event.registrations) {
    if (!reg.teamId) continue;
    const existing = teamMap.get(reg.teamId);
    if (existing) {
      existing.memberCount += 1;
      continue;
    }

    teamMap.set(reg.teamId, {
      id: reg.teamId,
      name: reg.team?.name || reg.teamName || 'Team',
      memberCount: 1,
    });
  }

  const teamsInEvent = Array.from(teamMap.values());
  const totalRegistrations = event.registrations.reduce((sum, reg) => sum + (reg.teamId ? 1 : reg.teamSize || 1), 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="flex items-start justify-between gap-4 p-6">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-1 text-left hover:bg-gray-100 rounded transition-colors -m-1 p-1"
          >
            <div className="flex items-center gap-3">
              <ChevronDown
                size={20}
                className={`shrink-0 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-gray-900 truncate">{event.name}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  <span className="inline-block bg-gray-200 px-2 py-1 rounded text-xs font-semibold mr-2">
                    {event.type || 'N/A'}
                  </span>
                  <span className="text-gray-700">{totalRegistrations} registration{totalRegistrations !== 1 ? 's' : ''}</span>
                </p>
              </div>
            </div>
          </button>
          <a
            href={`/api/admin/csv/registrations/export?eventId=${encodeURIComponent(event.id)}`}
            className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
          >
            Download CSV
          </a>
        </div>
      </div>

      {isExpanded && (
        <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[600px]">
          {event.registrations.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No participants yet</p>
          ) : (
            <>
              {teamsInEvent.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Teams ({teamsInEvent.length})</p>
                  <div className="space-y-2">
                    {teamsInEvent.map((team) => (
                      <div key={team.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{team.name}</p>
                          <p className="text-xs text-gray-600">{team.memberCount} member{team.memberCount !== 1 ? 's' : ''}</p>
                        </div>
                        <TeamDeleteForm teamId={team.id} teamName={team.name} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {event.registrations.some((reg) => !reg.teamId) && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Individual Participants</p>
                  <div className="space-y-2">
                    {event.registrations
                      .filter((reg) => !reg.teamId)
                      .map((reg) => (
                        <div key={reg.id} className="rounded-lg border border-gray-200 p-3 flex items-center justify-between gap-2 group hover:bg-gray-50">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900">
                              {reg.user.firstName} {reg.user.lastName}
                            </p>
                            <p className="text-xs text-gray-600">{reg.user.email}</p>
                          </div>
                          <MemberDeleteForm
                            registrationId={reg.id}
                            fullName={`${reg.user.firstName} ${reg.user.lastName}`}
                            hasTeam={Boolean(reg.teamId)}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {event.registrations.some((reg) => reg.teamId) && (
                <div className="space-y-3 pt-4 border-t border-gray-200">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Team Members</p>
                  <div className="space-y-2">
                    {event.registrations
                      .filter((reg) => reg.teamId)
                      .map((reg) => (
                        <div key={reg.id} className="rounded-lg border border-gray-200 p-3 flex items-start justify-between gap-2 group hover:bg-gray-50">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900">
                              {reg.user.firstName} {reg.user.lastName}
                            </p>
                            <p className="text-xs text-gray-600">
                              {reg.teamName} •{' '}
                              <span className="font-medium">
                                {reg.memberRole === 'LEADER' || reg.team?.leaderUserId === reg.userId ? 'Leader' : 'Member'}
                              </span>
                            </p>
                          </div>
                          <MemberDeleteForm
                            registrationId={reg.id}
                            fullName={`${reg.user.firstName} ${reg.user.lastName}`}
                            hasTeam={Boolean(reg.teamId)}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
