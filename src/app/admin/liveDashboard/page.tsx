import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getActiveYear } from "@/lib/edition";
import { getCachedDashboardStats } from "@/lib/cached-queries";
import LiveSyncRefresher from "@/components/common/LiveSyncRefresher";
import { LeaderboardView } from "@/components/features/LeaderboardView";

export default async function LiveDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ eventId?: string }>;
}) {
  const session = await getSession();
  if (!session || !session.userId) {
    redirect("/login");
  }

  if (session.role !== "ADMIN") {
    redirect("/");
  }

  const activeYear = getActiveYear();
  const params = searchParams ? await searchParams : undefined;
  const selectedEventId = params?.eventId;

  const { events, totalRegistrations } =
    await getCachedDashboardStats();

  const leaderboardEvents = await prisma.event.findMany({
    where: {
      year: activeYear,
      isArchived: false,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      type: true,
      date: true,
      participationMode: true,
      teamMinSize: true,
      teamMaxSize: true,
      maxParticipants: true,
      registrations: {
        select: {
          id: true,
          teamSize: true,
          attended: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ date: "asc" }, { name: "asc" }],
  });

  const selectedEvent = selectedEventId
    ? leaderboardEvents.find((event) => event.id === selectedEventId)
    : leaderboardEvents[0];

  const liveEventCount = events.filter((event) => event.isActive && !event.isArchived).length;
 const activeRegistrations = events.reduce(
  (sum, event) => sum + event.registrations.length,
  0
);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <LiveSyncRefresher intervalMs={10000} />
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Live Dashboard</h1>
          <p className="text-gray-600 mt-2 text-sm sm:text-base">
            Real-time event stats and scoring for SHACKLES {activeYear}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white rounded-lg shadow-md p-5 border-l-4 border-cyan-500">
            <p className="text-xs uppercase tracking-wide font-semibold text-gray-500">Total Registrations</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{totalRegistrations}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-5 border-l-4 border-violet-500">
            <p className="text-xs uppercase tracking-wide font-semibold text-gray-500">Active Events</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{liveEventCount}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-1">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Live Event Stats</h2>
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-600">Active Registrations</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{activeRegistrations}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-600">Selected Event</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  {selectedEvent ? selectedEvent.name : "No event selected"}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">Events</h3>
              <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                {leaderboardEvents.map((event) => {
                  const isSelected = selectedEvent?.id === event.id;
                  const registrationCount = event.registrations.reduce(
                    (sum, registration) => sum + (registration.teamSize || 1),
                    0
                  );

                  return (
                    <Link
                      key={event.id}
                      href={`/admin/liveDashboard?eventId=${event.id}`}
                      className={`block rounded-lg border px-4 py-3 transition ${
                        isSelected
                          ? "border-cyan-500 bg-cyan-50"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">{event.name}</p>
                          <p className="text-xs text-gray-500">
                            {(event.type || "GENERAL").toUpperCase()} | {event.participationMode}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">{registrationCount}</p>
                          <p className="text-xs text-gray-500">registrations</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Live Scoreboard</h2>
                  <p className="text-sm text-gray-600">
                    Aggregated marks and ranking for the selected event.
                  </p>
                </div>
                <Link
                  href="/admin/marking"
                  className="inline-flex items-center justify-center rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  Open Marking Hub
                </Link>
              </div>

              {selectedEvent ? (
                <LeaderboardView eventId={selectedEvent.id} />
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-600">
                  Select an event to view live scores.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
