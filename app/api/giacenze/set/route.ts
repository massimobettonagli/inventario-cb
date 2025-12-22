import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const codice = String(body?.codice ?? "").trim();
    const magazzinoId = String(body?.magazzinoId ?? "").trim();
    const qtyAttuale = Number(body?.qtyAttuale);

    if (!codice) return Response.json({ error: "codice mancante" }, { status: 400 });
    if (!magazzinoId) return Response.json({ error: "magazzinoId mancante" }, { status: 400 });
    if (!Number.isFinite(qtyAttuale)) return Response.json({ error: "qtyAttuale non valida" }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      // 1) prodotto
      const prodotto = await tx.prodotto.findUnique({
        where: { codice },
        select: { id: true, codice: true },
      });
      if (!prodotto) throw new Error("Prodotto non trovato");

      // 2) giacenza attuale (se esiste)
      const existing = await tx.giacenza.findUnique({
        where: {
          prodottoId_magazzinoId: { prodottoId: prodotto.id, magazzinoId },
        },
        select: { qtyAttuale: true },
      });

      const qtyPrima = Number(existing?.qtyAttuale ?? 0);
      const qtyDopo = Math.trunc(qtyAttuale);

      // 3) upsert giacenza
      const giacenza = await tx.giacenza.upsert({
        where: {
          prodottoId_magazzinoId: { prodottoId: prodotto.id, magazzinoId },
        },
        update: {
          qtyAttuale: qtyDopo,
        },
        create: {
          prodottoId: prodotto.id,
          magazzinoId,
          qtyUltimoInventario: 0,
          qtyAttuale: qtyDopo,
        },
        select: { qtyAttuale: true },
      });

      // 4) scrivi movimento
      await tx.movimentoMagazzino.create({
        data: {
          prodottoId: prodotto.id,
          magazzinoId,
          codice: prodotto.codice,
          qtyPrima,
          qtyDopo: giacenza.qtyAttuale,
        },
      });

      return giacenza.qtyAttuale;
    });

    return Response.json({ ok: true, qtyAttuale: result });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Errore" }, { status: 500 });
  }
}