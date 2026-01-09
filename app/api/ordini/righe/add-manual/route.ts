import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function cleanStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const ordineId = cleanStr(body?.ordineId);
    const codiceProdotto = cleanStr(body?.codiceProdotto);
    const qty = Number(body?.qty ?? 0);

    if (!ordineId) return NextResponse.json({ error: "ordineId mancante" }, { status: 400 });
    if (!codiceProdotto) return NextResponse.json({ error: "codiceProdotto mancante" }, { status: 400 });
    if (!Number.isFinite(qty) || qty <= 0) return NextResponse.json({ error: "qty non valida" }, { status: 400 });

    const ordine = await prisma.ordineTrasferimento.findUnique({
      where: { id: ordineId },
      select: { id: true, stato: true },
    });
    if (!ordine) return NextResponse.json({ error: "Ordine non trovato" }, { status: 404 });
    if (ordine.stato !== "DRAFT") return NextResponse.json({ error: "Ordine non modificabile" }, { status: 400 });

    const prodotto = await prisma.prodotto.findUnique({
      where: { codice: codiceProdotto },
      select: { codice: true, descrizione: true },
    });
    if (!prodotto) return NextResponse.json({ error: "Prodotto non trovato" }, { status: 404 });

    const existing = await prisma.ordineTrasferimentoRiga.findFirst({
      where: { ordineId, codiceProdotto: prodotto.codice },
      select: { id: true, qty: true },
    });

    if (existing) {
      const updated = await prisma.ordineTrasferimentoRiga.update({
        where: { id: existing.id },
        data: { qty: existing.qty + Math.trunc(qty) },
      });
      return NextResponse.json({ ok: true, mode: "increment", riga: updated });
    }

    const created = await prisma.ordineTrasferimentoRiga.create({
      data: {
        ordineId,
        codiceProdotto: prodotto.codice,
        descrizioneSnap: prodotto.descrizione ?? prodotto.codice,
        qty: Math.trunc(qty),
      },
    });

    return NextResponse.json({ ok: true, mode: "create", riga: created });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Errore" }, { status: 500 });
  }
}