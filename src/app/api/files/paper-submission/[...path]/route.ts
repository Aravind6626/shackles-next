import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/**
 * GET /api/files/paper-submission/[...path]
 * Serves paper submission files (abstracts/presentations) from private storage with authentication and access control.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const segments: string[] = resolvedParams.path;

    // 1. Authentication check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!segments || segments.length < 3) {
      return NextResponse.json({ error: "Invalid file path." }, { status: 400 });
    }

    const [eventId, teamId, filename] = segments;

    // 2. Validate path segments — prevent path traversal
    const hasTraversal = segments.some(
      (seg) => seg === ".." || seg === "." || seg.includes("/") || seg.includes("\\")
    );
    if (hasTraversal) {
      return NextResponse.json({ error: "Invalid file path." }, { status: 400 });
    }

    // 3. Authorization Check
    const userRole = session.user.role;
    const isStaff = userRole === "ADMIN" || userRole === "COORDINATOR" || userRole === "VOLUNTEER";

    if (!isStaff) {
      // Check if user is a member of the team
      const registration = await prisma.eventRegistration.findUnique({
        where: {
          userId_eventId: {
            userId: session.user.id,
            eventId: eventId,
          },
        },
        select: { teamId: true },
      });

      if (!registration || registration.teamId !== teamId) {
        return NextResponse.json({ error: "Unauthorized access to this file." }, { status: 403 });
      }
    }

    // 4. Build the absolute path and verify it's inside the storage directory
    const storageRoot = path.join(process.cwd(), "storage", "uploads", "paper-submissions");
    const filePath = path.join(storageRoot, ...segments);
    const resolved = path.resolve(filePath);

    if (!resolved.startsWith(path.resolve(storageRoot))) {
      return NextResponse.json({ error: "Invalid file path." }, { status: 400 });
    }

    // 5. Read and serve the file
    const fileBuffer = await fs.readFile(resolved);
    const ext = path.extname(resolved).replace(".", "").toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
}
