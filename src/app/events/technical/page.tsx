import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getActiveYear } from "@/lib/edition";
import EventCategoryPage from "@/components/features/EventCategoryPage";

export default async function TechnicalEventsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const activeYear = getActiveYear();
  const resolvedParams = (await searchParams) ?? {};

  const getTechnicalEvents = unstable_cache(
    async (year: number) => {
      return prisma.event.findMany({
        where: {
          year,
          type: "TECHNICAL",
          category: "EVENT",
          isActive: true,
          isTemplate: false,
          isArchived: false,
        },
        orderBy: [{ date: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          description: true,
          rulesUrl: true,
          date: true,
          endDate: true,
          participationMode: true,
          teamMinSize: true,
          teamMaxSize: true,
          trainerName: true,
          coordinatorName: true,
          coordinatorPhone: true,
          contactName: true,
          contactPhone: true,
        },
      });
    },
    ["technical-events"],
    { revalidate: 3600, tags: ["events"] }
  );

  const events = await getTechnicalEvents(activeYear);

  const serializedEvents = events.map((e) => ({
    ...e,
    date: e.date?.toISOString() ?? null,
    endDate: e.endDate?.toISOString() ?? null,
  }));

  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading Technical Events...</div>}>
      <EventCategoryPage
        category="TECHNICAL"
        events={serializedEvents}
        inviteToken={typeof resolvedParams.inviteToken === "string" ? resolvedParams.inviteToken : undefined}
        teamCode={typeof resolvedParams.teamCode === "string" ? resolvedParams.teamCode : undefined}
      />
    </Suspense>
  );
}
