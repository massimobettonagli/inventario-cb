import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const codice = searchParams.get("codice") ?? "";
  const magazzinoId = searchParams.get("magazzinoId") ?? "";

  if (!codice || !magazzinoId) {
    return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
  }

  const prodotto = await prisma.prodotto.findUnique({ where: { codice }, select: { id: true } });
  if (!prodotto) return NextResponse.json({ qtyAttuale: 0 });

  const giacenza = await prisma.giacenza.findUnique({
    where: { prodottoId_magazzinoId: { prodottoId: prodotto.id, magazzinoId } },
    select: { qtyAttuale: true },
  });

  return NextResponse.json({ qtyAttuale: giacenza?.qtyAttuale ?? 0 });
}