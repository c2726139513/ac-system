import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is required");
  return secret;
}

function base64Url(buf: Buffer): string {
  return buf.toString("base64url");
}

function decodeBase64Url(str: string): Buffer {
  return Buffer.from(str, "base64url");
}

export async function sign(payload: Record<string, unknown>): Promise<string> {
  const secret = getSecret();
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = base64Url(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64Url(Buffer.from(JSON.stringify(payload)));
  const sig = createHmac("sha256", secret).update(`${headerB64}.${payloadB64}`).digest();
  return `${headerB64}.${payloadB64}.${base64Url(sig)}`;
}

export async function verify(token: string): Promise<Record<string, unknown> | null> {
  const secret = getSecret();
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const expectedSig = createHmac("sha256", secret)
      .update(`${parts[0]}.${parts[1]}`)
      .digest();

    const actualSig = decodeBase64Url(parts[2]);
    if (actualSig.length !== expectedSig.length || !timingSafeEqual(actualSig, expectedSig)) {
      return null;
    }

    const payload = JSON.parse(decodeBase64Url(parts[1]).toString("utf-8"));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
