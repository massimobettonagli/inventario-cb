import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return bad("Non autorizzato", 401);

  const { searchParams } = new URL(req.url);

  const stato = (searchParams.get("stato") ?? "").trim(); // opzionale
  const anno = Number(searchParams.get("anno") ?? "");
  const q = (searchParams.get("q") ?? "").trim();

  const where: any = {};
  if (stato) where.stato = stato;
  if (!Number.isNaN(anno) && anno > 0) where.anno = anno;

  if (q) {
    where.OR = [
      { codice: { contains: q, mode: "insensitive" } },
      { daMagazzino: { nome: { contains: q, mode: "insensitive" } } },
      { aMagazzino: { nome: { contains: q, mode: "insensitive" } } },
    ];
  }

  const ordini = await prisma.ordineTrasferimento.findMany({
  where,
  orderBy: [{ anno: "desc" }, { numero: "desc" }, { suffisso: "asc" }],
  take: 200,
  select: {
    id: true,
    codice: true,
    anno: true,
    numero: true,
    suffisso: true,
    stato: true,
    createdAt: true,
    closedAt: true,
    shippedAt: true, // ✅ ora esiste
    daMagazzino: { select: { nome: true, id: true } },
    aMagazzino: { select: { nome: true, id: true } },
    _count: { select: { righe: true } },
  },
});

  return NextResponse.json({ ok: true, ordini });
}