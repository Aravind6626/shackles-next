import { NextRequest, NextResponse } from "next/server";
import { assertAdminOrCoordinator } from "@/server/actions/paper-submission";
import { prisma } from "@/lib/prisma";
import { ZipArchive } from "archiver";
import { Readable } from "stream";
import { createRateLimiter } from "@/lib/rate-limit";
import { getSpacesClient, getSpacesConfig } from "@/lib/digitalocean/spaces";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export const maxDuration = 300; // 5 minutes max duration for large downloads
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    
    // Rate Limiting
    const ratelimit = createRateLimiter({ maxRequests: 2, windowMs: 60000 }); // 2 downloads per minute per admin
    if (ratelimit) {
      // In app/api routes using NextRequest, we can use IP or a generic admin identifier
      // Since assertAdminOrCoordinator checks session, we'll use IP as a fallback
      const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
      const { success } = await ratelimit.limit(`download_abstracts:${ip}`);
      if (!success) {
        return new NextResponse("Too many requests. Please try again later.", { status: 429 });
      }
    }

    const auth = await assertAdminOrCoordinator(eventId);

    if (auth.error) {
      return new NextResponse(auth.error, { status: 403 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { name: true },
    });

    if (!event) {
      return new NextResponse("Event not found", { status: 404 });
    }

    const submissions = await prisma.paperSubmission.findMany({
      where: {
        eventId,
        abstractUrl: { not: null },
      },
      include: {
        team: {
          select: {
            name: true,
            teamCode: true,
          },
        },
      },
    });

    if (submissions.length === 0) {
      return new NextResponse("No abstracts found for this event.", {
        status: 404,
      });
    }

    // Set up Archiver stream using Archiver v8 ZipArchive
    const archive = new ZipArchive({
      zlib: { level: 5 }, // Moderate compression
    });

    // Create a TransformStream to convert Node.js stream to Web Stream for Next.js response
    const { readable, writable } = new TransformStream();
    
    // Pipe archiver data to the writable side of the TransformStream
    const writer = writable.getWriter();
    archive.on("data", (chunk) => {
      writer.write(chunk);
    });
    
    archive.on("end", () => {
      writer.close();
    });
    
    archive.on("error", (err) => {
      console.error("Archiver error:", err);
      writer.abort(err);
    });

    // Process files asynchronously while streaming
    (async () => {
      for (const sub of submissions) {
        if (!sub.abstractUrl) continue;
        
        try {
          let nodeStream: Readable;
          let ext = 'pdf';

          if (sub.abstractUrl.startsWith("http://") || sub.abstractUrl.startsWith("https://")) {
            // Legacy HTTP URL fetch
            const response = await fetch(sub.abstractUrl);
            if (!response.ok || !response.body) {
              console.error(`Failed to fetch abstract for team ${sub.team.teamCode}: ${response.statusText}`);
              continue;
            }
            const urlObj = new URL(sub.abstractUrl);
            ext = urlObj.pathname.split('.').pop() || 'pdf';
            // @ts-ignore
            nodeStream = Readable.fromWeb(response.body);
          } else if (sub.abstractUrl.startsWith("/api/")) {
            // Legacy Local API URL
            const fullUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${sub.abstractUrl}`;
            const response = await fetch(fullUrl);
            if (!response.ok || !response.body) continue;
            ext = sub.abstractUrl.split('.').pop() || 'pdf';
            // @ts-ignore
            nodeStream = Readable.fromWeb(response.body);
          } else {
            // Raw S3/Spaces Object Key (New Secure Format)
            const client = getSpacesClient();
            const config = getSpacesConfig();
            const command = new GetObjectCommand({
              Bucket: config.bucket,
              Key: sub.abstractUrl,
            });
            const response = await client.send(command);
            if (!response.Body) continue;
            
            ext = sub.abstractUrl.split('.').pop() || 'pdf';
            nodeStream = response.Body as Readable;
          }
          
          // Sanitize team name for filename
          const safeTeamName = sub.team.name.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
          const fileName = `${safeTeamName}_${sub.team.teamCode}_Abstract.${ext}`;
          
          archive.append(nodeStream, { name: fileName });
          
        } catch (err) {
          console.error(`Error processing abstract for ${sub.team.teamCode}:`, err);
        }
      }
      
      archive.finalize();
    })();

    // Return the response immediately while the archive is built in the background
    const safeEventName = event.name.replace(/[^a-zA-Z0-9]/g, "_");
    
    return new NextResponse(readable, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="Abstracts_${safeEventName}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Bulk download error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
