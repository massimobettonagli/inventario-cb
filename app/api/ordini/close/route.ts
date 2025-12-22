import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return bad("Non autorizzato", 401);

  const body = await req.json().catch(() => ({}));
  const ordineId = String(body?.ordineId ?? "").trim();
  if (!ordineId) return bad("ordineId mancante");

  const ordine = await prisma.ordineTrasferimento.findUnique({
    where: { id: ordineId },
    select: {
      id: true,
      stato: true,
      daMagazzinoId: true,
      righe: { select: { id: true, qty: true, qtyPrepared: true } },
    },
  });

  if (!ordine) return bad("Ordine non trovato", 404);


  if (ordine.stato === "CHIUSA") {
    return NextResponse.json({ ok: true, alreadyClosed: true, closedAt: null });
  }

  if (ordine.stato !== "INVIATA" && ordine.stato !== "IN_LAVORAZIONE") {
    return bad(`Ordine non chiudibile in stato ${ordine.stato}`, 409);
  }

  if (!ordine.righe.length) return bad("Ordine vuoto: non chiudibile", 409);

  // deve essere tutto completo
  const notComplete = ordine.righe.find((r) => (r.qtyPrepared ?? 0) < r.qty);
  if (notComplete) return bad("Non puoi chiudere: alcune righe non sono complete", 409);

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // 1) chiudo ordine e salvo closedAt
    await tx.ordineTrasferimento.update({
      where: { id: ordineId },
      data: {
        stato: "CHIUSA",
        closedAt: now,
      },
    });

    // 2) rendo coerenti le righe (in ordine chiuso: qtyPrepared = qty)
    await Promise.all(
      ordine.righe.map((r) =>
        tx.ordineTrasferimentoRiga.update({
          where: { id: r.id },
          data: { qtyPrepared: r.qty },
        })
      )
    );
  });

  return NextResponse.json({ ok: true, closedAt: now.toISOString() });
}