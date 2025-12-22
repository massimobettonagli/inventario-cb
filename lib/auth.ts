import { cookies } from "next/headers";

export const AUTH_COOKIE = "cb_auth";

// Sessione 15 giorni
export const SESSION_DAYS = 15;
export const SESSION_SECONDS = SESSION_DAYS * 24 * 60 * 60; // 15 giorni in secondi

export type Session =
  | { role: "admin"; warehouseId: null; warehouseName: "Administrator"; exp: number } // exp = unix seconds
  | { role: "warehouse"; warehouseId: string; warehouseName: string; exp: number }; // exp = unix seconds

export type Payload = {
  role: "admin" | "warehouse";
  warehouseId: string | null;
  warehouseName: string;
  iat: number; // unix seconds
  exp: number; // unix seconds
};

// ---------- time helpers ----------
function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function buildPayload(input: { role: Payload["role"]; warehouseId: string | null; warehouseName: string }): Payload {
  const now = nowSeconds();
  return {
    role: input.role,
    warehouseId: input.warehouseId,
    warehouseName: input.warehouseName,
    iat: now,
    exp: now + SESSION_SECONDS,
  };
}

// ---------- base64url helpers ----------
function b64urlFromBytes(bytes: Uint8Array) {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bytesFromB64url(input: string) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const s = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function b64urlFromString(str: string) {
  return b64urlFromBytes(new TextEncoder().encode(str));
}

function stringFromB64url(input: string) {
  return new TextDecoder().decode(bytesFromB64url(input));
}

// ---------- HMAC SHA-256 via Web Crypto (Edge compatible) ----------
async function hmacSha256B64url(data: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64urlFromBytes(new Uint8Array(sig));
}

export async function createSessionToken(payload: Payload) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Missing AUTH_SECRET");

  // body = base64url(JSON payload)
  const body = b64urlFromString(JSON.stringify(payload));

  // sig = HMAC(body)
  const sig = await hmacSha256B64url(body, secret);

  return `${body}.${sig}`;
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = await hmacSha256B64url(body, secret);
  if (sig !== expected) return null;

  try {
    const payload = JSON.parse(stringFromB64url(body)) as Payload;

    if (!payload?.role || !payload?.warehouseName) return null;
    if (typeof payload.exp !== "number") return null;

    // ✅ exp è in unix seconds → confronto in seconds
    if (nowSeconds() >= payload.exp) return null;

    if (payload.role === "admin") {
      return { role: "admin", warehouseId: null, warehouseName: "Administrator", exp: payload.exp };
    }

    if (!payload.warehouseId) return null;

    return {
      role: "warehouse",
      warehouseId: payload.warehouseId,
      warehouseName: payload.warehouseName,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

async function getCookieValue(name: string) {
  const store = await cookies();
  return store.get(name)?.value ?? null;
}

export async function getSessionFromCookies(): Promise<Session | null> {
  const token = await getCookieValue(AUTH_COOKIE);
  if (!token) return null;
  return verifySessionToken(token);
}