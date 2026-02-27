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

  // 1) carico gli ordini (come prima)
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
      shippedAt: true,
      daMagazzino: { select: { nome: true, id: true } },
      aMagazzino: { select: { nome: true, id: true } },
      _count: { select: { righe: true } },
    },
  });

  // se non ho ordini, ritorno subito
  if (!ordini.length) {
    return NextResponse.json({ ok: true, ordini: [] });
  }

  // 2) calcolo quante righe con NOTA valorizzata per ogni ordine
  const ordineIds = ordini.map((o) => o.id);

  // ⚠️ se il tuo model NON si chiama ordineTrasferimentoRiga, cambia qui
  const grouped = await prisma.ordineTrasferimentoRiga.groupBy({
    by: ["ordineId"],
    where: {
      ordineId: { in: ordineIds },
      // nota valorizzata: non null e non stringa vuota
      NOT: [{ nota: null }, { nota: "" }],
    },
    _count: { _all: true },
  });

  const noteMap = new Map<string, number>();
  for (const g of grouped) {
    noteMap.set(g.ordineId, g._count._all);
  }

  // 3) arricchisco la risposta con righeNoteCount
  const ordiniOut = ordini.map((o) => ({
    ...o,
    righeNoteCount: noteMap.get(o.id) ?? 0,
  }));

  return NextResponse.json({ ok: true, ordini: ordiniOut });
}