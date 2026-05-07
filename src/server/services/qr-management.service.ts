/**
 * QR Token Management Service
 * - Generate QR tokens when payment is verified
 * - Handle QR scans at various stations
 * - Track scan history
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { generateQRToken } from "@/server/services/registration-helpers.service";
import { getActiveYear } from "@/lib/edition";
import { QrPayloadError, decodeQrPayload } from "@/server/services/qr.service";

type DbClient = Prisma.TransactionClient | PrismaClient;

export interface QRScanPayload {
  qrToken?: string;
  qrData?: string;
  stationId: string;
  eventId?: string;
  operationType: "ATTENDANCE" | "KIT" | "OTHER";
  timestamp?: Date;
}

export interface QRScanResult {
  success: boolean;
  userId?: string;
  shacklesId?: string;
  userName?: string;
  message?: string;
  error?: string;
}

/**
 * Generate and store QR token for a user when payment is verified
 * Called when admin marks payment as VERIFIED for a year
 */
export async function generateQRTokenForUser(
  db: DbClient,
  userId: string,
  year: number
): Promise<{ token: string; error?: string }> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return { token: "", error: "User not found" };
    }

    const token = generateQRToken();

    // Store the token on the user
    await db.user.update({
      where: { id: userId },
      data: {
        qrToken: token,
        qrTokenExpiry: new Date(year + 1, 0, 1), // Expires at start of next year
      },
    });

    return { token };
  } catch (err) {
    console.error("Error generating QR token:", err);
    return { token: "", error: String(err) };
  }
}

/**
 * Process a QR scan
 * Returns user info and records the scan in RegistrationOperation
 */
export async function processQRScan(
  db: DbClient,
  payload: QRScanPayload
): Promise<QRScanResult> {
  const activeYear = getActiveYear();

  try {
    const scanValue = payload.qrData?.trim() || payload.qrToken?.trim() || "";
    if (!scanValue) {
      return {
        success: false,
        error: "QR token not found or invalid",
      };
    }

    let userLookupToken = scanValue;

    try {
      const structured = decodeQrPayload(scanValue);
      if (structured.type === "USER") {
        userLookupToken = structured.uid;
      } else {
        return {
          success: false,
          error: "Invalid QR type for this scanner action",
        };
      }
    } catch (error) {
      if (!(error instanceof QrPayloadError)) {
        throw error;
      }
    }

    // Find user by QR token
    const user = await db.user.findUnique({
      where: { qrToken: userLookupToken },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        shacklesId: true,
        email: true,
        phone: true,
        payment: {
          select: {
            status: true,
            year: true,
          },
        },
      },
    });

    if (!user) {
      if (userLookupToken !== scanValue) {
        const fallbackUser = await db.user.findUnique({
          where: { id: userLookupToken },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            shacklesId: true,
            email: true,
            phone: true,
            payment: {
              select: {
                status: true,
                year: true,
              },
            },
          },
        });

        if (fallbackUser) {
          return processStructuredScan(db, payload, fallbackUser, activeYear);
        }
      }

      return {
        success: false,
        error: "QR token not found or invalid",
      };
    }

    return processStructuredScan(db, payload, user, activeYear);
  } catch (err) {
    console.error("Error processing QR scan:", err);
    return {
      success: false,
      error: `Scan processing failed: ${String(err)}`,
    };
  }
}

async function processStructuredScan(
  db: DbClient,
  payload: QRScanPayload,
  user: {
    id: string;
    firstName: string;
    lastName: string;
    shacklesId: string | null;
    email: string;
    phone: string;
    payment: { status: string; year: number | null } | null;
  },
  activeYear: number,
): Promise<QRScanResult> {
  // Verify payment is current
  if (user.payment?.status !== "VERIFIED" || user.payment?.year !== activeYear) {
    return {
      success: false,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      error: "Payment not verified for current year",
    };
  }

    const userName = `${user.firstName} ${user.lastName}`;

    // Handle different operation types
    if (payload.operationType === "ATTENDANCE" && payload.eventId) {
      // Mark attendance on event registration
      const eventRegistration = await db.eventRegistration.findUnique({
        where: {
          userId_eventId: {
            userId: user.id,
            eventId: payload.eventId,
          },
        },
      });

      if (!eventRegistration) {
        return {
          success: false,
          userId: user.id,
          shacklesId: user.shacklesId || undefined,
          userName,
          error: "Not registered for this event",
        };
      }

      // Update attendance
      await db.eventRegistration.update({
        where: { id: eventRegistration.id },
        data: {
          attended: true,
          attendedAt: new Date(),
          stationId: payload.stationId,
        },
      });
    } else if (payload.operationType === "KIT") {
      // Mark kit as issued
      await db.user.update({
        where: { id: user.id },
        data: {
          kitStatus: "ISSUED",
          kitIssuedAt: new Date(),
          kitIssuedBy: payload.stationId,
        },
      });
    }

    // Log the scan operation
    await db.registrationOperation.create({
      data: {
        operationId: `SCAN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        stationId: payload.stationId,
        operationType: payload.operationType === "ATTENDANCE" ? "ATTENDANCE" : "KIT",
        participantId: user.id,
        status: "APPLIED",
        processedAt: payload.timestamp || new Date(),
      },
    });

    return {
      success: true,
      userId: user.id,
      shacklesId: user.shacklesId || undefined,
      userName,
      message: `${payload.operationType === "KIT" ? "Kit issued" : "Attendance marked"} for ${userName}`,
    };
  }

/**
 * Get QR scan history for a user
 */
export async function getQRScanHistory(
  db: DbClient,
  userId: string,
  limit = 50
) {
  try {
    const scans = await db.registrationOperation.findMany({
      where: {
        participantId: userId,
        operationType: { in: ["ATTENDANCE", "KIT"] },
      },
      orderBy: { processedAt: "desc" },
      take: limit,
      select: {
        id: true,
        operationType: true,
        stationId: true,
        processedAt: true,
        status: true,
      },
    });

    return { success: true, scans };
  } catch (err) {
    console.error("Error fetching QR scan history:", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Validate QR token format and existence
 */
export async function validateQRToken(
  db: DbClient,
  qrToken: string
): Promise<{ valid: boolean; userId?: string; message?: string }> {
  try {
    const user = await db.user.findUnique({
      where: { qrToken },
      select: {
        id: true,
        payment: { select: { status: true, year: true } },
      },
    });

    if (!user) {
      return { valid: false, message: "QR token not found" };
    }

    const activeYear = getActiveYear();
    if (user.payment?.status !== "VERIFIED" || user.payment?.year !== activeYear) {
      return { valid: false, message: "Payment not current" };
    }

    return { valid: true, userId: user.id };
  } catch (err) {
    console.error("Error validating QR token:", err);
    return { valid: false, message: String(err) };
  }
}
