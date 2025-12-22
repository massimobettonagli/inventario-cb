import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function toInt(v: unknown) {
  const n =
    typeof v === "number"
      ? v
      : Number(String(v ?? "").trim().replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n));
}

export async function PATCH(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return bad("Non autorizzato", 401);

  const body = await req.json().catch(() => ({}));

  const codice = String(body?.codice ?? "").trim();
  const magazzinoId = String(body?.magazzinoId ?? "").trim();

  const qtyAttuale = toInt(body?.qtyAttuale);
  const qtyUltimoInventarioRaw =
    body?.qtyUltimoInventario !== undefined ? toInt(body?.qtyUltimoInventario) : undefined;

  if (!codice || !magazzinoId) return bad("Dati mancanti");
  if (qtyAttuale == null) return bad("Quantità non valida");

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 0) prodotto -> prodottoId
      const prodotto = await tx.prodotto.findUnique({
        where: { codice },
        select: { id: true, codice: true },
      });
      if (!prodotto) throw new Error("Prodotto non trovato");

      const prodottoId = prodotto.id;

      // 1) leggo giacenza esistente
      const prev = await tx.giacenza.findUnique({
        where: {
          prodottoId_magazzinoId: { prodottoId, magazzinoId },
        },
        select: { id: true, qtyAttuale: true, qtyUltimoInventario: true },
      });

      const qtyPrima = Number(prev?.qtyAttuale ?? 0);
      const qtyDopo = qtyAttuale;

      // 2) upsert giacenza
      const giacenza = await tx.giacenza.upsert({
        where: {
          prodottoId_magazzinoId: { prodottoId, magazzinoId },
        },
        create: {
          prodottoId,
          magazzinoId,
          qtyAttuale: qtyDopo,
          qtyUltimoInventario:
            typeof qtyUltimoInventarioRaw === "number"
              ? qtyUltimoInventarioRaw
              : 0,
        },
        update: {
          qtyAttuale: qtyDopo,
          ...(typeof qtyUltimoInventarioRaw === "number"
            ? { qtyUltimoInventario: qtyUltimoInventarioRaw }
            : {}),
        },
        select: {
          id: true,
          prodottoId: true,
          magazzinoId: true,
          qtyAttuale: true,
          qtyUltimoInventario: true,
          updatedAt: true,
        },
      });

      // 3) movimento magazzino (stats si basano su questi record)
      await tx.movimentoMagazzino.create({
        data: {
          prodottoId,
          magazzinoId,
          codice, // campo denormalizzato che hai nel model MovimentoMagazzino
          qtyPrima,
          qtyDopo,
        },
      });

      return { giacenza, qtyPrima, qtyDopo };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return bad(e?.message ?? "Errore aggiornamento giacenza", 500);
  }
}