import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";

export const runtime = "nodejs"; // puoi anche toglierlo: è compatibile anche Edge

export async function GET() {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ ok: false, session: null }, { status: 401 });
  }

  const nowMs = Date.now();
  const expMs = session.exp; // nel tuo auth.ts exp è in ms
  const remainingMs = Math.max(0, expMs - nowMs);

  return NextResponse.json({
    ok: true,
    session: {
      role: session.role,
      warehouseId: session.role === "admin" ? null : session.warehouseId,
      warehouseName: session.warehouseName,
      exp: session.exp,
      remainingMs,
    },
  });
}