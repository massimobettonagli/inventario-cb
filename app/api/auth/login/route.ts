import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE, buildPayload, createSessionToken, SESSION_SECONDS } from "@/lib/auth";

export const runtime = "nodejs";

function bad(msg: string, status = 401) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

/**
 * Secure cookie SOLO quando la richiesta è davvero HTTPS.
 * - In prod dietro proxy: usa x-forwarded-proto
 * - In locale/LAN su http: deve essere false, altrimenti Safari scarta il cookie
 */
function isHttps(req: NextRequest) {
  const xfProto = req.headers.get("x-forwarded-proto");
  if (xfProto) return xfProto.split(",")[0].trim() === "https";
  return req.nextUrl.protocol === "https:";
}

function setAuthCookie(res: NextResponse, req: NextRequest, token: string) {
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS, // es. 15 giorni
    secure: isHttps(req), // ✅ FIX SAFARI
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const username = String(body?.username ?? "").trim();
  // password: meglio NON trim() per non cambiare password con spazi (se mai)
  const password = String(body?.password ?? "");

  if (!username || !password) return bad("Credenziali mancanti");

  // ✅ Admin
  const adminUser = (process.env.AUTH_ADMIN_USER ?? "").trim();
  const adminPass = process.env.AUTH_ADMIN_PASS ?? "";

  if (adminUser && adminPass && username === adminUser && password === adminPass) {
    const payload = buildPayload({
      role: "admin",
      warehouseId: null,
      warehouseName: "Administrator",
    });

    const token = await createSessionToken(payload);

    const res = NextResponse.json({
      ok: true,
      role: "admin",
      warehouseId: null,
      warehouseName: "Administrator",
      exp: payload.exp,
    });

    setAuthCookie(res, req, token);
    return res;
  }

  // ✅ Warehouse Treviolo / Treviglio
  // (mantengo i tuoi nomi ENV: AUTH_TREVIolo_*)
  const trevioloU = (process.env.AUTH_TREVIolo_USER ?? "").trim();
  const trevioloP = process.env.AUTH_TREVIolo_PASS ?? "";
  const treviglioU = (process.env.AUTH_TREVIGLIO_USER ?? "").trim();
  const treviglioP = process.env.AUTH_TREVIGLIO_PASS ?? "";

  let warehouseName: "Treviolo" | "Treviglio" | null = null;

  if (trevioloU && trevioloP && username === trevioloU && password === trevioloP) warehouseName = "Treviolo";
  else if (treviglioU && treviglioP && username === treviglioU && password === treviglioP) warehouseName = "Treviglio";

  if (!warehouseName) return bad("Credenziali non valide");

  // recupero ID magazzino da DB
  const mag = await prisma.magazzino.findFirst({
    where: { nome: warehouseName },
    select: { id: true, nome: true },
  });

  if (!mag) return bad(`Magazzino "${warehouseName}" non trovato a DB`, 500);

  const payload = buildPayload({
    role: "warehouse",
    warehouseId: mag.id,
    warehouseName: mag.nome,
  });

  const token = await createSessionToken(payload);

  const res = NextResponse.json({
    ok: true,
    role: "warehouse",
    warehouseId: mag.id,
    warehouseName: mag.nome,
    exp: payload.exp,
  });

  setAuthCookie(res, req, token);
  return res;
}