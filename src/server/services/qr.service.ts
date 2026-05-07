export type UserQrPayload = {
  v: 1;
  type: "USER";
  uid: string;
  sid?: string;
  y: number;
};

export type TeamQrPayload = {
  v: 1;
  type: "TEAM";
  tid: string;
  eid: string;
  y: number;
};

export type QrPayload = UserQrPayload | TeamQrPayload;

export class QrPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QrPayloadError";
  }
}

function toBase64Url(text: string) {
  return Buffer.from(text, "utf8").toString("base64url");
}

function fromBase64Url(text: string) {
  return Buffer.from(text, "base64url").toString("utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function encodeQrPayload(payload: QrPayload): string {
  return toBase64Url(JSON.stringify(payload));
}

export function decodeQrPayload(data: string): QrPayload {
  const trimmed = data.trim();
  if (!trimmed) {
    throw new QrPayloadError("QR payload is empty.");
  }

  try {
    const raw = fromBase64Url(trimmed);
    const parsed: unknown = JSON.parse(raw);

    if (!isRecord(parsed) || parsed.v !== 1 || !isString(parsed.type) || !isNumber(parsed.y)) {
      throw new QrPayloadError("Invalid or unsupported QR code.");
    }

    if (parsed.type === "USER") {
      if (!isString(parsed.uid) || !parsed.uid.trim()) {
        throw new QrPayloadError("Invalid or unsupported QR code.");
      }

      return {
        v: 1,
        type: "USER",
        uid: parsed.uid.trim(),
        sid: isString(parsed.sid) && parsed.sid.trim() ? parsed.sid.trim() : undefined,
        y: parsed.y,
      };
    }

    if (parsed.type === "TEAM") {
      if (!isString(parsed.tid) || !parsed.tid.trim() || !isString(parsed.eid) || !parsed.eid.trim()) {
        throw new QrPayloadError("Invalid or unsupported QR code.");
      }

      return {
        v: 1,
        type: "TEAM",
        tid: parsed.tid.trim(),
        eid: parsed.eid.trim(),
        y: parsed.y,
      };
    }

    throw new QrPayloadError("Invalid or unsupported QR code.");
  } catch (error) {
    if (error instanceof QrPayloadError) {
      throw error;
    }

    throw new QrPayloadError("Invalid or unsupported QR code.");
  }
}
