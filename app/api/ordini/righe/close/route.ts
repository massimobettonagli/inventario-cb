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
  if (!ordineId) return bad("Ordine mancante");

  const ordine = await prisma.ordineTrasferimento.findUnique({
    where: { id: ordineId },
    select: {
      id: true,
      stato: true,
      daMagazzinoId: true,
      righe: { select: { qty: true, qtyPrepared: true } },
    },
  });
  if (!ordine) return bad("Ordine non trovato", 404);

  // ✅ chiusura consentita SOLO quando è in preparazione
 if (ordine.stato !== "INVIATA" && ordine.stato !== "IN_LAVORAZIONE") {
  return bad("Ordine non chiudibile in questo stato", 409);
}


  if (ordine.righe.length === 0) return bad("Ordine vuoto", 409);

  const allDone = ordine.righe.every((r) => (r.qtyPrepared ?? 0) >= r.qty);
  if (!allDone) return bad("Ordine non completo: ci sono righe non preparate", 409);

  const updated = await prisma.ordineTrasferimento.update({
    where: { id: ordineId },
    data: {
      stato: "CHIUSA",
      closedAt: new Date(),
      updatedAt: new Date(), // robustezza
    },
    select: { id: true, stato: true, closedAt: true },
  });

  return NextResponse.json({ ok: true, ordine: updated });
}