import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ codice: string }> }
) {
  const { codice } = await ctx.params;
  const codiceClean = String(codice ?? "").trim();
  if (!codiceClean) return bad("Codice mancante", 400);

  const magazzinoId = String(req.nextUrl.searchParams.get("magazzinoId") ?? "").trim();

  const prodotto = await prisma.prodotto.findUnique({
    where: { codice: codiceClean },
    select: {
      codice: true,
      descrizione: true,
      immagini: { select: { url: true } },

      // 👇 se passa magazzinoId, prendo la giacenza di quel magazzino
      giacenze: magazzinoId
        ? {
            where: { magazzinoId },
            select: {
              qtyAttuale: true,
              qtyUltimoInventario: true, // ✅ AGGIUNTO
            },
            take: 1,
          }
        : false,
    },
  });

  if (!prodotto) return bad("Prodotto non trovato", 404);

  const g =
    magazzinoId && Array.isArray((prodotto as any).giacenze)
      ? (prodotto as any).giacenze?.[0]
      : null;

  const qtyAttuale = Number(g?.qtyAttuale ?? 0);
  const qtyUltimoInventario = Number(g?.qtyUltimoInventario ?? 0);

  // tolgo giacenze dal payload "prodotto"
  const { giacenze, ...safeProdotto } = prodotto as any;

  return NextResponse.json({
    prodotto: safeProdotto,
    qtyAttuale,
    qtyUltimoInventario, // ✅ in output
  });
}