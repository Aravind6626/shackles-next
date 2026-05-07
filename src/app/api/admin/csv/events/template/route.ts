import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { stringifyCsvRow } from "@/lib/csv";

async function getAdminContext() {
  const session = await getSession();
  if (!session?.userId) return null;
  const user = await prisma.user.findUnique({ where: { id: String(session.userId) } });
  if (!user || user.role !== "ADMIN") return null;
  return { id: user.id };
}

export async function GET() {
  const admin = await getAdminContext();
  if (!admin) {
    return new Response("Unauthorized", { status: 401 });
  }

  const lines = [
    stringifyCsvRow([
      "name",
      "type",
      "dayLabel",
      "date",
      "time",
      "endDate",
      "endTime",
      "description",
      "rulesUrl",
      "coordinatorName",
      "coordinatorPhone",
      "trainerName",
      "contactName",
      "contactPhone",
      "participationMode",
      "teamMinSize",
      "teamMaxSize",
      "maxTeams",
      "maxParticipants",
      "isAllDay",
      "isActive",
    ]),
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="events-import-template-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
