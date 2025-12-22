import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

function toNumber(v: any) {
  if (typeof v === "string") return Number(v.replace(",", "."));
  return Number(v);
}

export async function PATCH(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return bad("Non autorizzato", 401);

  const body = await req.json().catch(() => ({}));
  const ordineId = String(body?.ordineId ?? "").trim();
  const codice = String(body?.codice ?? body?.codiceProdotto ?? "").trim();
  const add = toNumber(body?.qtyPreparedAdd ?? body?.add ?? body?.qty ?? 0);

  if (!ordineId || !codice) return bad("Dati mancanti");
  if (!Number.isFinite(add) || add <= 0) return bad("Quantità non valida");

  // Leggo ordine
  const ordine = await prisma.ordineTrasferimento.findUnique({
    where: { id: ordineId },
    select: { id: true, stato: true, daMagazzinoId: true },
  });
  if (!ordine) return bad("Ordine non trovato", 404);

  // ✅ Consento preparazione in INVIATA o IN_LAVORAZIONE
  if (ordine.stato !== "INVIATA" && ordine.stato !== "IN_LAVORAZIONE") {
    return bad("Ordine non preparabile in questo stato", 409);
  }


  // Trovo riga
  const riga = await prisma.ordineTrasferimentoRiga.findFirst({
    where: { ordineId, codiceProdotto: codice },
    select: { id: true, qty: true, qtyPrepared: true },
  });
  if (!riga) return bad("Riga non trovata per questo codice", 404);

  const next = Math.min(riga.qty, (riga.qtyPrepared ?? 0) + Math.round(add));

  // ✅ In un’unica transazione:
  // - aggiorno qtyPrepared
  // - se era INVIATA, appena inizio la preparazione lo porto a IN_LAVORAZIONE
  const [updated] = await prisma.$transaction([
    prisma.ordineTrasferimentoRiga.update({
      where: { id: riga.id },
      data: { qtyPrepared: next },
      select: { id: true, codiceProdotto: true, qty: true, qtyPrepared: true, updatedAt: true },
    }),
    ...(ordine.stato === "INVIATA"
      ? [
          prisma.ordineTrasferimento.update({
            where: { id: ordineId },
            data: { stato: "IN_LAVORAZIONE" },
            select: { id: true },
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ ok: true, riga: updated });
}