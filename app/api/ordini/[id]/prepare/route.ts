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
          qtyPrepared: true,
          updatedAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!ordine) return bad("Ordine non trovato", 404);

  // ✅ permessi: tutti vedono tutto (come hai deciso tu).
  // ⚠️ ma per modificare (prepare/close) limiteremo dopo.

  const righe = ordine.righe.map((r) => {
    const prepared = Math.max(0, Math.min(r.qtyPrepared ?? 0, r.qty));
    const status = prepared <= 0 ? "NOT_STARTED" : prepared < r.qty ? "PARTIAL" : "DONE";
    return { ...r, qtyPrepared: prepared, rowStatus: status };
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
      stats: { preparedCount, partialCount, notStartedCount, total: righe.length, isFullyPrepared },
    },
  });
}