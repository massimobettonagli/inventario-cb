import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return bad("Non autorizzato", 401);

  const rows = await prisma.uploadFile.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      originalName: true,
      storedName: true,
      mimeType: true,
      size: true,
      uploaderEmail: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, rows });
}