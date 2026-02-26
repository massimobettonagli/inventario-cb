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
  const q = (searchParams.get("q") ?? "").trim();
  const take = Math.min(Math.max(Number(searchParams.get("take") ?? "200"), 1), 500);

  const where: any = {
    ordine: {
      shippedAt: { not: null }, // ✅ SOLO ordini spediti
    },
  };

  if (q) {
    where.OR = [
      { codiceProdotto: { contains: q, mode: "insensitive" } },
      { descrizioneSnap: { contains: q, mode: "insensitive" } },
      // opzionale: cerca anche per codice ordine
      { ordine: { codice: { contains: q, mode: "insensitive" } } },
    ];
  }

  const rows = await prisma.ordineTrasferimentoRiga.findMany({
    where,
    orderBy: [{ ordine: { shippedAt: "desc" } }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      codiceProdotto: true,
      descrizioneSnap: true,
      qty: true,
      qtyPrepared: true,
      ordine: {
        select: {
          id: true,
          codice: true,
          shippedAt: true,
          daMagazzino: { select: { nome: true } },
          aMagazzino: { select: { nome: true } },
        },
      },
    },
  });

  // Normalizzo e metto "speditaQty" = qtyPrepared (più sensato per storico spedizioni)
  const items = rows.map((r) => ({
    id: r.id,
    codiceProdotto: r.codiceProdotto,
    descrizioneSnap: r.descrizioneSnap ?? "",
    qtyRichiesta: r.qty ?? 0,
    qtySpedita: r.qtyPrepared ?? 0,
    ordineId: r.ordine.id,
    ordineCodice: r.ordine.codice,
    daMagazzino: r.ordine.daMagazzino?.nome ?? "",
    aMagazzino: r.ordine.aMagazzino?.nome ?? "",
    shippedAt: r.ordine.shippedAt ? r.ordine.shippedAt.toISOString() : null,
  }));

  return NextResponse.json({ ok: true, items });
}