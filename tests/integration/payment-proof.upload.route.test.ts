import { beforeEach, describe, expect, it, vi } from "vitest";

const { mkdirMock, writeFileMock, uploadToSpacesMock, createSpacesSignedGetUrlMock } = vi.hoisted(() => ({
  mkdirMock: vi.fn(),
  writeFileMock: vi.fn(),
  uploadToSpacesMock: vi.fn(),
  createSpacesSignedGetUrlMock: vi.fn(),
}));

vi.mock("node:crypto", () => ({
  randomUUID: () => "uuid-1234",
}));

vi.mock("fs", () => ({
  promises: {
    mkdir: mkdirMock,
    writeFile: writeFileMock,
  },
}));

vi.mock("@/lib/storage-provider", () => ({
  getStorageProvider: () => "local",
  shouldUseLocal: () => true,
  shouldUseDigitalOcean: () => false,
}));

vi.mock("@/lib/digitalocean/spaces", () => ({
  uploadToSpaces: uploadToSpacesMock,
  createSpacesSignedGetUrl: createSpacesSignedGetUrlMock,
}));

vi.mock("@/lib/safe-log", () => ({
  safeLogError: vi.fn(),
}));

import { POST } from "@/app/api/upload/payment-proof/route";

describe("integration: payment-proof upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
  });

  it("stores a local image upload and then rate limits repeated requests from the same client", async () => {
    const makeRequest = () => {
      const formData = new FormData();
      formData.append("file", new File([new Uint8Array([1, 2, 3])], "proof.png", { type: "image/png" }));

      return new Request("http://localhost/api/upload/payment-proof", {
        method: "POST",
        body: formData,
        headers: {
          "x-forwarded-for": "203.0.113.25",
        },
      });
    };

    const first = await POST(makeRequest());
    expect(first.status).toBe(200);
    const firstBody = await first.json() as { proofPath: string; proofUrl: string };
    expect(firstBody.proofPath).toMatch(/^\/uploads\/payment-proofs\//);
    expect(firstBody.proofUrl).toMatch(/^http:\/\/localhost:3000\/uploads\/payment-proofs\//);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await POST(makeRequest());
      expect(response.status).toBe(200);
    }

    const rateLimited = await POST(makeRequest());
    expect(rateLimited.status).toBe(429);
    expect(rateLimited.headers.get("x-ratelimit-limit")).toBe("5");
    expect(rateLimited.headers.get("retry-after")).toBeTruthy();
    expect(await rateLimited.json()).toMatchObject({
      error: "Too many upload attempts. Please try again later.",
    });

    expect(mkdirMock).toHaveBeenCalled();
    expect(writeFileMock).toHaveBeenCalled();
    expect(uploadToSpacesMock).not.toHaveBeenCalled();
    expect(createSpacesSignedGetUrlMock).not.toHaveBeenCalled();
  });
});
