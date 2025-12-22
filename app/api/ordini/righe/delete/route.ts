import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function DELETE(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return bad("Non autorizzato", 401);

  const body = await req.json().catch(() => ({}));
  const rigaId = String(body?.rigaId ?? "").trim();

  if (!rigaId) return bad("Riga mancante");

  const riga = await prisma.ordineTrasferimentoRiga.findUnique({
    where: { id: rigaId },
    select: {
      id: true,
      ordine: { select: { id: true, stato: true, daMagazzinoId: true } },
    },
  });

  if (!riga) return bad("Riga non trovata", 404);

  if (riga.ordine.stato !== "DRAFT") return bad("Ordine non modificabile", 409);

  await prisma.ordineTrasferimentoRiga.delete({ where: { id: rigaId } });

  return NextResponse.json({ ok: true });
}