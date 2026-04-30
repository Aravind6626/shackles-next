import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, findManyMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: findManyMock,
    },
  },
}));

import { GET } from "@/app/api/offline/participants/route";

describe("integration: offline participants route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-admin users", async () => {
    getSessionMock.mockResolvedValue({ role: "USER" } as never);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: "Unauthorized",
    });
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("returns hashed offline participants for admin users", async () => {
    getSessionMock.mockResolvedValue({ role: "ADMIN" } as never);
    findManyMock.mockResolvedValue([
      {
        id: "user-1",
        firstName: "Asha",
        shacklesId: "SH26G100",
        registrationType: "TEAM",
        kitStatus: "PENDING",
        qrToken: "offline-token-123",
        updatedAt: new Date("2026-04-30T10:00:00.000Z"),
        registrations: [
          {
            attended: true,
            event: {
              name: "Hackathon",
            },
          },
          {
            attended: false,
            event: {
              name: "Workshop",
            },
          },
        ],
      },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      participants?: Array<{
        id: string;
        firstName: string;
        shacklesId: string;
        registrationType: string;
        kitStatus: string;
        qrTokenHash: string | null;
        updatedAt: string;
        events: Array<{ eventName: string; attended: boolean }>;
      }>;
    };

    expect(body.participants).toHaveLength(1);
    expect(body.participants?.[0]).toMatchObject({
      id: "user-1",
      firstName: "Asha",
      shacklesId: "SH26G100",
      registrationType: "TEAM",
      kitStatus: "PENDING",
      qrTokenHash: createHash("sha256").update("offline-token-123").digest("hex"),
      events: [
        { eventName: "Hackathon", attended: true },
        { eventName: "Workshop", attended: false },
      ],
    });
    expect(body.participants?.[0]?.updatedAt).toBe("2026-04-30T10:00:00.000Z");
    expect(findManyMock).toHaveBeenCalledTimes(1);
  });
});