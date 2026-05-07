import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { csvHeaderMap, parseCsv, readCsvField } from "@/lib/csv";
import { logAdminAudit } from "@/lib/admin-audit";
import { getActiveYear } from "@/lib/edition";
import { createRateLimiter } from "@/lib/rate-limit";
import { EventParticipationMode, type Prisma } from "@prisma/client";

const registrationsImportRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 50,
  keyPrefix: "api:admin:csv:registrations:import",
});

async function getAdminContext() {
  const session = await getSession();
  if (!session?.userId) return null;
  const user = await prisma.user.findUnique({ where: { id: String(session.userId) } });
  if (!user || user.role !== "ADMIN") return null;
  return { id: user.id, email: user.email };
}

function normalizeName(name: string) {
  return name.trim().toUpperCase();
}

function normalizeTeamName(name: string) {
  return name.trim().replace(/\s+/g, " ").toUpperCase();
}

function toTeamSize(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.trunc(parsed);
}

function toPositiveInt(value: string, label: string, errors: string[]) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    errors.push(`${label} must be a positive number.`);
    return null;
  }
  return Math.trunc(parsed);
}

function toBool(value: string, fallback = false) {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function hasCsvField(headerMap: Map<string, number>, aliases: string[]) {
  return aliases.some((alias) => headerMap.has(alias.toLowerCase()));
}

function readFirstCsvField(row: string[], headerMap: Map<string, number>, aliases: string[]) {
  for (const alias of aliases) {
    const value = readCsvField(row, headerMap, alias);
    if (value) return value;
  }
  return "";
}

function parseParticipationMode(value: string, errors: string[]) {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === "TEAM") return EventParticipationMode.TEAM;
  if (normalized === "INDIVIDUAL") return EventParticipationMode.INDIVIDUAL;
  errors.push("participationMode must be TEAM or INDIVIDUAL.");
  return null;
}

function normalizeDateTimeInput(value: string) {
  return value.includes(" ") && !value.includes("T") ? value.replace(" ", "T") : value;
}

function datePart(value: string) {
  return value.split(/[ T]/)[0] || value;
}

function combineDateAndTime(dateValue: string, timeValue: string) {
  if (!dateValue) return "";
  if (!timeValue) return normalizeDateTimeInput(dateValue);
  return `${datePart(dateValue)}T${timeValue}`;
}

function parseCsvDate(value: string, label: string, errors: string[]) {
  const parsed = new Date(normalizeDateTimeInput(value));
  if (Number.isNaN(parsed.getTime())) {
    errors.push(`${label} is not a valid date/time.`);
    return null;
  }
  return parsed;
}

function readNumberUpdate(
  row: string[],
  headerMap: Map<string, number>,
  aliases: string[],
  label: string,
  errors: string[]
) {
  if (!hasCsvField(headerMap, aliases)) return { provided: false, value: null };
  return {
    provided: true,
    value: toPositiveInt(readFirstCsvField(row, headerMap, aliases), label, errors),
  };
}

function buildEventDetailsUpdate(
  row: string[],
  headerMap: Map<string, number>,
  currentMode: EventParticipationMode
) {
  const errors: string[] = [];
  const data: Prisma.EventUpdateInput = {};

  if (hasCsvField(headerMap, ["eventType", "type"])) {
    data.type = readFirstCsvField(row, headerMap, ["eventType", "type"]).toUpperCase() || null;
  }

  if (hasCsvField(headerMap, ["dayLabel", "eventDay", "day"])) {
    data.dayLabel = readFirstCsvField(row, headerMap, ["dayLabel", "eventDay", "day"]).toUpperCase() || null;
  }

  if (hasCsvField(headerMap, ["participationMode", "mode"])) {
    const participationMode = parseParticipationMode(
      readFirstCsvField(row, headerMap, ["participationMode", "mode"]),
      errors
    );
    if (participationMode) data.participationMode = participationMode;
  }

  const startDateKeys = ["eventDate", "date", "startDate", "eventStartDate", "eventDateTime", "startDateTime"];
  const startTimeKeys = ["eventTime", "time", "startTime", "eventStartTime"];
  const endDateKeys = ["eventEndDate", "endDate", "eventEndDateTime", "endDateTime"];
  const endTimeKeys = ["eventEndTime", "endTime"];

  const hasStartDate = hasCsvField(headerMap, startDateKeys);
  const hasStartTime = hasCsvField(headerMap, startTimeKeys);
  const hasEndDate = hasCsvField(headerMap, endDateKeys);
  const hasEndTime = hasCsvField(headerMap, endTimeKeys);

  const startDateRaw = readFirstCsvField(row, headerMap, startDateKeys);
  const startTimeRaw = readFirstCsvField(row, headerMap, startTimeKeys);
  const endDateRaw = readFirstCsvField(row, headerMap, endDateKeys);
  const endTimeRaw = readFirstCsvField(row, headerMap, endTimeKeys);

  let parsedStart: Date | null = null;
  if (hasStartDate || hasStartTime) {
    if (!startDateRaw && startTimeRaw) {
      errors.push("eventDate is required when eventTime is provided.");
    }

    data.date = startDateRaw
      ? parseCsvDate(combineDateAndTime(startDateRaw, startTimeRaw), "eventDate/eventTime", errors)
      : null;
    parsedStart = data.date instanceof Date ? data.date : null;
  }

  if (hasEndDate || hasEndTime) {
    const effectiveEndDate = endDateRaw || (endTimeRaw && startDateRaw ? datePart(startDateRaw) : "");
    if (!effectiveEndDate && endTimeRaw) {
      errors.push("eventEndDate or eventDate is required when eventEndTime is provided.");
    }

    data.endDate = effectiveEndDate
      ? parseCsvDate(combineDateAndTime(effectiveEndDate, endTimeRaw), "eventEndDate/eventEndTime", errors)
      : null;
  }

  if (parsedStart && data.endDate instanceof Date && data.endDate < parsedStart) {
    errors.push("eventEndDate/eventEndTime cannot be before eventDate/eventTime.");
  }

  if (hasCsvField(headerMap, ["isAllDay", "allDay"])) {
    data.isAllDay = toBool(readFirstCsvField(row, headerMap, ["isAllDay", "allDay"]), false);
  }

  const maxParticipants = readNumberUpdate(
    row,
    headerMap,
    ["maxParticipants", "maxParticipant", "participantLimit", "maxEventParticipants"],
    "maxParticipants",
    errors
  );
  if (maxParticipants.provided) data.maxParticipants = maxParticipants.value;

  const maxTeams = readNumberUpdate(
    row,
    headerMap,
    ["maxTeams", "maxTeam", "teamLimit", "maximumTeams"],
    "maxTeams",
    errors
  );
  if (maxTeams.provided) data.maxTeams = maxTeams.value;

  const teamMinSize = readNumberUpdate(
    row,
    headerMap,
    ["teamMinSize", "minTeamSize", "minParticipants", "minTeamParticipants", "minTeams"],
    "teamMinSize",
    errors
  );
  const teamMaxSize = readNumberUpdate(
    row,
    headerMap,
    ["teamMaxSize", "maxTeamSize", "maxTeamParticipants", "maxParticipantsPerTeam"],
    "teamMaxSize",
    errors
  );

  const nextMode = data.participationMode === EventParticipationMode.TEAM
    ? EventParticipationMode.TEAM
    : data.participationMode === EventParticipationMode.INDIVIDUAL
      ? EventParticipationMode.INDIVIDUAL
      : currentMode;

  if (teamMinSize.provided) data.teamMinSize = nextMode === EventParticipationMode.TEAM ? teamMinSize.value : null;
  if (teamMaxSize.provided) data.teamMaxSize = nextMode === EventParticipationMode.TEAM ? teamMaxSize.value : null;

  const finalTeamMinSize = teamMinSize.provided ? teamMinSize.value : null;
  const finalTeamMaxSize = teamMaxSize.provided ? teamMaxSize.value : null;
  if (finalTeamMinSize != null && finalTeamMaxSize != null && finalTeamMinSize > finalTeamMaxSize) {
    errors.push("teamMinSize cannot be greater than teamMaxSize.");
  }

  return { data, errors };
}

function normalizeEventSlot(date: Date, endDate?: Date | null) {
  const start = date;
  let end = endDate ?? date;

  if (end < start) {
    end = start;
  }

  if (end.getTime() === start.getTime()) {
    end = new Date(end.getTime() + 1);
  }

  return { start, end };
}

function hasScheduleOverlap(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date }
) {
  return a.start < b.end && b.start < a.end;
}

function rawDateUpdate(value: Prisma.EventUpdateInput["date"] | undefined) {
  return value instanceof Date || value === null ? value : undefined;
}

function rawBoolUpdate(value: Prisma.EventUpdateInput["isAllDay"] | undefined) {
  return typeof value === "boolean" ? value : undefined;
}

function parseTeamStatus(value: string): "DRAFT" | "COMPLETED" | "LOCKED" | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === "DRAFT" || normalized === "COMPLETED" || normalized === "LOCKED") return normalized;
  return null;
}

function parseMemberRole(value: string): "LEADER" | "MEMBER" | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === "LEADER" || normalized === "MEMBER") return normalized;
  return null;
}

export async function POST(request: Request) {
  const admin = await getAdminContext();
  if (!admin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await registrationsImportRateLimiter.limit(`admin:csv:registrations:import:${admin.id}`);
  if (!rateLimitResult.success) {
    return Response.json({ error: "Rate limit exceeded. Please try again later." }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const dryRun = String(formData.get("dryRun") || "").toLowerCase() === "true";

  if (!(file instanceof File)) {
    return Response.json({ error: "CSV file is required." }, { status: 400 });
  }

  const content = await file.text();
  const rows = parseCsv(content);
  if (rows.length < 2) {
    return Response.json({ error: "CSV has no data rows." }, { status: 400 });
  }

  const activeYear = getActiveYear();
  const events = await prisma.event.findMany({
    where: {
      year: activeYear,
      isArchived: false,
      isTemplate: false,
    },
    select: { id: true, name: true, date: true, endDate: true, isAllDay: true, participationMode: true },
  });
  const users = await prisma.user.findMany({ select: { id: true, email: true, phone: true } });

  const eventByName = new Map(events.map((event) => [normalizeName(event.name), event.id]));
  const userByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user.id]));

  const headerMap = csvHeaderMap(rows[0]);
  let imported = 0;
  let skipped = 0;
  const updatedEventIds = new Set<string>();
  const errors: string[] = [];
  const plannedSlotsByUser = new Map<string, Array<{ eventId: string; eventName: string; start: Date; end: Date }>>();

  for (const [rowIndex, row] of rows.slice(1).entries()) {
    const rowNumber = rowIndex + 2;
    const eventName = readCsvField(row, headerMap, "eventName");
    const userEmail = readCsvField(row, headerMap, "userEmail").toLowerCase();

    if (!eventName || !userEmail) {
      skipped += 1;
      continue;
    }

    const eventId = eventByName.get(normalizeName(eventName));
    const userId = userByEmail.get(userEmail);

    if (!eventId || !userId) {
      skipped += 1;
      continue;
    }

    const attended = toBool(readCsvField(row, headerMap, "attended"), false);
    const attendedAtRaw = readCsvField(row, headerMap, "attendedAt");
    const rawTeamName = readCsvField(row, headerMap, "teamName").trim();
    const rawTeamStatus = parseTeamStatus(readCsvField(row, headerMap, "teamStatus"));
    const rawMemberRole = parseMemberRole(readCsvField(row, headerMap, "memberRole"));
    const event = events.find((item) => item.id === eventId);

    if (!event) {
      skipped += 1;
      continue;
    }

    const eventUpdate = buildEventDetailsUpdate(row, headerMap, event.participationMode);
    if (eventUpdate.errors.length > 0) {
      skipped += 1;
      errors.push(...eventUpdate.errors.map((error) => `Row ${rowNumber}: ${error}`));
      continue;
    }

    const hasEventDetails = Object.keys(eventUpdate.data).length > 0;
    if (hasEventDetails) updatedEventIds.add(eventId);

    const effectiveDate = "date" in eventUpdate.data
      ? rawDateUpdate(eventUpdate.data.date)
      : event.date;
    const effectiveEndDate = "endDate" in eventUpdate.data
      ? rawDateUpdate(eventUpdate.data.endDate)
      : event.endDate;
    const effectiveIsAllDay = "isAllDay" in eventUpdate.data
      ? rawBoolUpdate(eventUpdate.data.isAllDay) ?? event.isAllDay
      : event.isAllDay;

    if (!dryRun) {
      if (hasEventDetails) {
        await prisma.event.update({
          where: { id: eventId },
          data: eventUpdate.data,
        });
      }
    }

    let importedSlot: { start: Date; end: Date } | null = null;
    if (effectiveDate && !effectiveIsAllDay) {
      const currentSlot = normalizeEventSlot(effectiveDate, effectiveEndDate);
      importedSlot = currentSlot;

      const plannedConflict = plannedSlotsByUser.get(userId)?.find((slot) => (
        slot.eventId !== eventId && hasScheduleOverlap(currentSlot, slot)
      ));

      if (plannedConflict) {
        skipped += 1;
        errors.push(`Row ${rowNumber}: ${userEmail} is already queued for ${plannedConflict.eventName} in this time slot.`);
        continue;
      }

      const sameUserRegistrations = await prisma.eventRegistration.findMany({
        where: {
          userId,
          eventId: { not: eventId },
          event: {
            year: activeYear,
            isArchived: false,
            isTemplate: false,
            isAllDay: false,
            date: { not: null },
          },
        },
        select: {
          event: {
            select: {
              id: true,
              name: true,
              date: true,
              endDate: true,
            },
          },
        },
      });

      const conflictingRegistration = sameUserRegistrations.find((registration) => {
        if (!registration.event.date) return false;
        const otherSlot = normalizeEventSlot(registration.event.date, registration.event.endDate);
        return hasScheduleOverlap(currentSlot, otherSlot);
      });

      if (conflictingRegistration) {
        skipped += 1;
        errors.push(`Row ${rowNumber}: ${userEmail} is already registered for ${conflictingRegistration.event.name} in this time slot.`);
        continue;
      }
    }

    if (!dryRun) {
      let teamId: string | null = null;
      if (event && eventId && rawTeamName && eventByName.get(normalizeName(event.name)) === eventId) {
        const teamStatus = rawTeamStatus || "DRAFT";
        const normalizedTeam = normalizeTeamName(rawTeamName);
        const userRecord = users.find((u) => u.id === userId);

        const team = await prisma.team.upsert({
          where: {
            eventId_nameNormalized: {
              eventId,
              nameNormalized: normalizedTeam,
            },
          },
          create: {
            eventId,
            name: rawTeamName,
            nameNormalized: normalizedTeam,
            teamCode: crypto.randomBytes(4).toString("hex").toUpperCase(),
            memberCount: 0,
            status: teamStatus,
            leaderUserId: rawMemberRole === "LEADER" ? userId : null,
            leaderContactPhoneSnapshot: rawMemberRole === "LEADER" ? userRecord?.phone || null : null,
            leaderContactEmailSnapshot: rawMemberRole === "LEADER" ? userRecord?.email || null : null,
          },
          update: {
            status: teamStatus,
            leaderUserId: rawMemberRole === "LEADER" ? userId : undefined,
            leaderContactPhoneSnapshot: rawMemberRole === "LEADER" ? userRecord?.phone || null : undefined,
            leaderContactEmailSnapshot: rawMemberRole === "LEADER" ? userRecord?.email || null : undefined,
          },
        });

        teamId = team.id;
      }

      await prisma.eventRegistration.upsert({
        where: {
          userId_eventId: {
            userId,
            eventId,
          },
        },
        create: {
          userId,
          eventId,
          teamId,
          memberRole: rawMemberRole,
          teamName: rawTeamName || null,
          teamSize: toTeamSize(readCsvField(row, headerMap, "teamSize")),
          attended,
          attendedAt: attendedAtRaw ? new Date(attendedAtRaw) : null,
        },
        update: {
          teamId,
          memberRole: rawMemberRole,
          teamName: rawTeamName || null,
          teamSize: toTeamSize(readCsvField(row, headerMap, "teamSize")),
          attended,
          attendedAt: attendedAtRaw ? new Date(attendedAtRaw) : null,
        },
      });
    }

    if (importedSlot) {
      const plannedSlots = plannedSlotsByUser.get(userId) || [];
      plannedSlots.push({ eventId, eventName: event.name, ...importedSlot });
      plannedSlotsByUser.set(userId, plannedSlots);
    }

    imported += 1;
  }

  if (!dryRun) {
    const teams = await prisma.team.findMany({
      select: { id: true },
    });

    for (const team of teams) {
      const count = await prisma.eventRegistration.count({
        where: { teamId: team.id },
      });

      await prisma.team.update({
        where: { id: team.id },
        data: { memberCount: count },
      });
    }
  }

  if (!dryRun) {
    revalidatePath("/admin/event-registrations");
    revalidatePath("/admin/events");
    revalidatePath("/admin/adminDashboard");
    revalidatePath("/userDashboard");
    revalidatePath("/events");
    revalidatePath("/events/technical");
    revalidatePath("/events/non-technical");
    revalidatePath("/events/special");
    revalidatePath("/workshops");
  }

  await logAdminAudit({
    action: "CSV_REGISTRATIONS_IMPORT",
    actorId: admin.id,
    actorEmail: admin.email,
    status: "SUCCESS",
    details: { dryRun, imported, skipped, updatedEvents: updatedEventIds.size, errors: errors.slice(0, 20) },
  });

  return Response.json({ imported, skipped, updatedEvents: updatedEventIds.size, dryRun, errors });
}
