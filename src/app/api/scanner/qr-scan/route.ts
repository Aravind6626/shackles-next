import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkEventStaff } from "@/lib/session";
import { processQRScan } from "@/server/services/qr-management.service";
import { Permission, Role } from "@prisma/client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { qrData, stationId, eventId, operationType } = body;

    if (!qrData || !stationId || !operationType) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    // Determine required permission based on operation type
    const requiredPermission: Permission = operationType === 'KIT' ? Permission.KIT_ISSUANCE : Permission.SCAN_ATTENDANCE;

    // For event-specific operations, authorize via checkEventStaff
    if (eventId) {
      const { allowed, error } = await checkEventStaff(eventId, requiredPermission);
      if (!allowed) {
        return NextResponse.json({ success: false, error: error || "Forbidden" }, { status: 403 });
      }
    }

    const result = await processQRScan(prisma, {
      qrData,
      stationId,
      eventId,
      operationType,
      timestamp: new Date(),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("QR Scan Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
