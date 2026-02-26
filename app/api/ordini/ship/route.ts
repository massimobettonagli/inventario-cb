import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return bad("Non autorizzato", 401);

  const body = await req.json().catch(() => ({}));
  const ordineId = String(body?.ordineId ?? "").trim();
  if (!ordineId) return bad("ordineId mancante");

  const now = new Date();

  try {
    const out = await prisma.$transaction(async (tx) => {
      const ordine = await tx.ordineTrasferimento.findUnique({
        where: { id: ordineId },
        select: { id: true, stato: true, shippedAt: true },
      });

      if (!ordine) return { kind: "error" as const, status: 404, msg: "Ordine non trovato" };

      if (ordine.stato !== "CHIUSA") {
        return { kind: "error" as const, status: 409, msg: "Puoi segnare spedito solo un ordine CHIUSO" };
      }

      if (ordine.shippedAt) {
        // idempotente: non errore, ritorno ok
        return { kind: "ok" as const, shippedAt: ordine.shippedAt.toISOString(), already: true };
      }

      const updated = await tx.ordineTrasferimento.update({
        where: { id: ordineId },
        data: { shippedAt: now },
        select: { shippedAt: true },
      });

      return { kind: "ok" as const, shippedAt: updated.shippedAt?.toISOString() ?? null, already: false };
    });

    if (out.kind === "error") return bad(out.msg, out.status);

    return NextResponse.json({ ok: true, shippedAt: out.shippedAt, already: out.already });
  } catch (e: any) {
    return bad(e?.message ?? "Errore salvataggio spedito", 500);
  }
}