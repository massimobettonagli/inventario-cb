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
  if (!ordineId) return bad("Ordine mancante");

  const ordine = await prisma.ordineTrasferimento.findUnique({
    where: { id: ordineId },
    select: { id: true, stato: true, daMagazzinoId: true, _count: { select: { righe: true } } },
  });

  if (!ordine) return bad("Ordine non trovato", 404);
  if (ordine.stato !== "DRAFT") return bad("Ordine già completato");
  if (ordine._count.righe === 0) return bad("Aggiungi almeno una riga prima di completare");

  // Per ora “completare” non cambia stato (resta DRAFT) ma lo useremo come check/validazione.
  // Se vuoi: qui puoi già passare a INVIATA solo dopo invio mail.
  return NextResponse.json({ ok: true });
}