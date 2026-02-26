import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

function toNumber(v: unknown) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const s = v.trim().replace(",", ".");
    return Number(s);
  }
  return Number(v as any);
}

export async function PATCH(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return bad("Non autorizzato", 401);

  const body = await req.json().catch(() => ({}));

  const ordineId = String(body?.ordineId ?? "").trim();
  const codice = String(body?.codice ?? body?.codiceProdotto ?? "").trim();

  // incremento
  const addRaw = toNumber(body?.qtyPreparedAdd ?? body?.add ?? body?.qty ?? 0);

  if (!ordineId || !codice) return bad("Dati mancanti");

  if (!Number.isFinite(addRaw)) return bad("Quantità non valida");
  const add = Math.round(addRaw);
  if (add <= 0) return bad("Quantità non valida");

  // Leggo ordine (blocco se CHIUSA)
  const ordine = await prisma.ordineTrasferimento.findUnique({
    where: { id: ordineId },
    select: { id: true, stato: true },
  });
  if (!ordine) return bad("Ordine non trovato", 404);

  if (ordine.stato === "CHIUSA") return bad("Ordine chiuso: non modificabile", 409);

  if (ordine.stato !== "INVIATA" && ordine.stato !== "IN_LAVORAZIONE") {
    return bad("Ordine non preparabile in questo stato", 409);
  }

  // Trovo riga
  const riga = await prisma.ordineTrasferimentoRiga.findFirst({
    where: { ordineId, codiceProdotto: codice },
    select: { id: true, qty: true, qtyPrepared: true },
  });
  if (!riga) return bad("Riga non trovata per questo codice", 404);

  const currentPrepared = Number(riga.qtyPrepared ?? 0);
  const nextPrepared = currentPrepared + add;

  // ✅ non clampare: salvo il reale
  const safeNextPrepared = Number.isFinite(nextPrepared) && nextPrepared >= 0 ? nextPrepared : 0;

  const [updated] = await prisma.$transaction([
    prisma.ordineTrasferimentoRiga.update({
      where: { id: riga.id },
      data: { qtyPrepared: safeNextPrepared },
      select: {
        id: true,
        codiceProdotto: true,
        qty: true,
        qtyPrepared: true,
        updatedAt: true,
      },
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

  const qtyReq = Number(updated.qty ?? 0);
  const qtyPrep = Number(updated.qtyPrepared ?? 0);
  const rowStatus = qtyPrep >= qtyReq ? "DONE" : qtyPrep > 0 ? "PARTIAL" : "NOT_STARTED";

  return NextResponse.json({ ok: true, riga: { ...updated, rowStatus } });
}