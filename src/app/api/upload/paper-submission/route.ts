import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getStorageProvider, shouldUseDigitalOcean, shouldUseLocal } from "@/lib/storage-provider";
import { createSpacesSignedGetUrl, uploadToSpaces } from "@/lib/digitalocean/spaces";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { createRateLimiter, getClientIdentifier } from "@/lib/rate-limit";

const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "ppt", "pptx"];

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function inferExtension(file: File) {
  const type = file.type?.toLowerCase() || "";
  if (type.includes("pdf")) return "pdf";
  if (type.includes("word") || type.includes("msword")) return "doc";
  if (type.includes("officedocument.wordprocessingml")) return "docx";
  if (type.includes("powerpoint") || type.includes("vnd.ms-powerpoint")) return "ppt";
  if (type.includes("officedocument.presentationml")) return "pptx";

  const name = file.name?.toLowerCase() || "";
  const ext = name.split(".").pop();
  if (ext && ALLOWED_EXTENSIONS.includes(ext)) {
    return ext;
  }
  return "pdf";
}

export async function POST(request: Request) {
  try {
    // Rate Limiting
    const identifier = getClientIdentifier(request);
    const ratelimit = createRateLimiter({ maxRequests: 5, windowMs: 60000 }); // 5 uploads per minute
    if (ratelimit) {
      const { success } = await ratelimit.limit(`upload_paper:${identifier}`);
      if (!success) {
        return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
      }
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const type = formData.get("type"); // "abstract" | "presentation"
    const teamId = formData.get("teamId");
    const eventId = formData.get("eventId");

    if (!(file instanceof File) || !type || !teamId || !eventId) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const fileType = String(type);
    const strTeamId = String(teamId);
    const strEventId = String(eventId);

    if (fileType !== "abstract" && fileType !== "presentation") {
      return NextResponse.json({ error: "Invalid type. Must be 'abstract' or 'presentation'." }, { status: 400 });
    }

    // Enforce size limits
    const maxLimit = fileType === "abstract" ? 10 * 1024 * 1024 : 30 * 1024 * 1024; // 10MB or 30MB
    if (file.size > maxLimit) {
      return NextResponse.json({ error: `File too large. Max size: ${fileType === "abstract" ? "10MB" : "30MB"}.` }, { status: 400 });
    }

    // Verify file extension
    const extension = inferExtension(file);
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return NextResponse.json({ error: "Invalid file type. Only PDF, Word, and PowerPoint files are allowed." }, { status: 400 });
    }

    // Fetch team & submission record to authorize
    const team = await prisma.team.findUnique({
      where: { id: strTeamId },
      include: {
        event: true,
        paperSubmission: true,
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    if (team.eventId !== strEventId || !team.event.requiresDocumentSubmission) {
      return NextResponse.json({ error: "Invalid event or event doesn't require document submission." }, { status: 400 });
    }

    // Authorize: Only team leader can submit
    if (team.leaderUserId !== session.user.id) {
      return NextResponse.json({ error: "Only the team leader is authorized to upload files." }, { status: 403 });
    }

    // Check deadlines
    const now = new Date();
    if (fileType === "abstract") {
      const abstractDeadline = team.paperSubmission?.abstractDeadline || team.event.submissionDeadline;
      if (abstractDeadline && now > new Date(abstractDeadline)) {
        return NextResponse.json({ error: "Submission deadline has passed for abstracts." }, { status: 400 });
      }
    } else {
      // Presentation check
      if (team.paperSubmission?.selectionStatus !== "SELECTED") {
        return NextResponse.json({ error: "Your team must be SELECTED to upload the presentation." }, { status: 400 });
      }
      const presentationDeadline = team.paperSubmission?.presentationDeadline;
      if (presentationDeadline && now > new Date(presentationDeadline)) {
        return NextResponse.json({ error: "Submission deadline has passed for presentations." }, { status: 400 });
      }
    }

    // Set file naming & paths
    const proofFilename = `${fileType}_${randomUUID()}.${extension}`;
    const storagePath = `paper-submissions/${strEventId}/${strTeamId}/${proofFilename}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const storageProvider = getStorageProvider();

    let fullUrl = "";
    if (shouldUseLocal(storageProvider)) {
      const storageDir = path.join(process.cwd(), "storage", "uploads", "paper-submissions", strEventId, strTeamId);
      const filePath = path.join(storageDir, proofFilename);

      await fs.mkdir(storageDir, { recursive: true });
      await fs.writeFile(filePath, bytes);

      fullUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/files/paper-submission/${storagePath}`;
    } else if (shouldUseDigitalOcean(storageProvider)) {
      await uploadToSpaces({
        key: storagePath,
        body: bytes,
        contentType: MIME_TYPES[extension] || "application/octet-stream",
        upsert: true,
      });

      // Instead of generating and storing a 7-day presigned URL, we save the relative object key.
      // This allows the application to generate fresh presigned URLs on-the-fly at read time.
      fullUrl = storagePath;
    } else {
      return NextResponse.json({ error: "Unsupported storage provider configuration." }, { status: 500 });
    }

    // Update PaperSubmission record in DB
    if (fileType === "abstract") {
      await prisma.paperSubmission.upsert({
        where: { teamId: strTeamId },
        update: {
          abstractUrl: fullUrl,
          abstractSubmittedAt: new Date(),
        },
        create: {
          teamId: strTeamId,
          eventId: strEventId,
          abstractUrl: fullUrl,
          abstractSubmittedAt: new Date(),
        },
      });
    } else {
      await prisma.paperSubmission.update({
        where: { teamId: strTeamId },
        data: {
          presentationUrl: fullUrl,
          presentationSubmittedAt: new Date(),
        },
      });
    }

    // Revalidate paths
    revalidatePath("/userDashboard");
    revalidatePath(`/admin/paper-submissions/${strEventId}`);

    return NextResponse.json({
      success: true,
      url: fullUrl,
    });
  } catch (error) {
    console.error("[paper-submission upload] Unhandled error:", error);
    return NextResponse.json({ error: "Failed to upload document. Please try again." }, { status: 500 });
  }
}
