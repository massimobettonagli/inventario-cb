import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();
  const codice = body.codice as string;
  const magazzinoId = body.magazzinoId as string;
  const delta = Number(body.delta ?? 0);

  if (!codice || !magazzinoId || !Number.isFinite(delta)) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const prodotto = await prisma.prodotto.findUnique({ where: { codice }, select: { id: true } });
  if (!prodotto) return NextResponse.json({ error: "Prodotto non trovato" }, { status: 404 });

  const giacenza = await prisma.giacenza.upsert({
    where: { prodottoId_magazzinoId: { prodottoId: prodotto.id, magazzinoId } },
    update: { qtyAttuale: { increment: delta } },
    create: { prodottoId: prodotto.id, magazzinoId, qtyAttuale: delta, qtyUltimoInventario: 0 },
    select: { qtyAttuale: true },
  });

  return NextResponse.json({ qtyAttuale: giacenza.qtyAttuale });
}