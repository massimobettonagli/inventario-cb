import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return bad("Non autorizzato", 401);

  const { id } = await ctx.params;
  const ordineId = String(id ?? "").trim();
  if (!ordineId) return bad("ID ordine mancante");

  const ordine = await prisma.ordineTrasferimento.findUnique({
    where: { id: ordineId },
    select: {
      id: true,
      codice: true,
      stato: true,
      createdAt: true,
      closedAt: true,
      daMagazzinoId: true,
      aMagazzinoId: true,
      daMagazzino: { select: { id: true, nome: true } },
      aMagazzino: { select: { id: true, nome: true } },
      righe: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          codiceProdotto: true,
          descrizioneSnap: true,
          qty: true,
          qtyPrepared: true, // ✅ valore reale (anche > qty)
          nota: true,
          updatedAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!ordine) return bad("Ordine non trovato", 404);

  const righe = ordine.righe.map((r) => {
    const qty = Number(r.qty ?? 0);
    const preparedRaw = Number(r.qtyPrepared ?? 0);

    // ✅ NON clampare a qty: mostriamo il reale (ma impediamo negativi / NaN)
    const prepared = Number.isFinite(preparedRaw) && preparedRaw > 0 ? preparedRaw : 0;

    const status: "NOT_STARTED" | "PARTIAL" | "DONE" =
      prepared <= 0 ? "NOT_STARTED" : prepared < qty ? "PARTIAL" : "DONE";

    return { ...r, qty, qtyPrepared: prepared, rowStatus: status };
  });

  const preparedCount = righe.filter((r) => r.rowStatus === "DONE").length;
  const partialCount = righe.filter((r) => r.rowStatus === "PARTIAL").length;
  const notStartedCount = righe.filter((r) => r.rowStatus === "NOT_STARTED").length;

  const isFullyPrepared = righe.length > 0 && righe.every((r) => r.rowStatus === "DONE");

  return NextResponse.json({
    ok: true,
    ordine: {
      ...ordine,
      righe,
      stats: {
        preparedCount,
        partialCount,
        notStartedCount,
        total: righe.length,
        isFullyPrepared,
      },
    },
  });
}