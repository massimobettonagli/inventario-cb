import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function canDeleteByState(o: { stato: string; sentAt: Date | null; emailDestinatario: string | null }) {
  const notSent = !o.sentAt && !o.emailDestinatario;
  return o.stato === "DRAFT" || (o.stato === "CHIUSA" && notSent);
}

export async function DELETE(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return bad("Non autorizzato", 401);

  const body = await req.json().catch(() => ({}));
  const ordineId = String(body?.ordineId ?? "").trim();
  if (!ordineId) return bad("ordineId mancante");

  const ordine = await prisma.ordineTrasferimento.findUnique({
    where: { id: ordineId },
    select: { id: true, stato: true, daMagazzinoId: true, sentAt: true, emailDestinatario: true },
  });

  if (!ordine) return bad("Ordine non trovato", 404);


  if (!canDeleteByState(ordine)) {
    return bad("Ordine non eliminabile (già inviato o in stato non consentito)", 409);
  }

  // cancello righe + ordine in transazione
  await prisma.$transaction([
    prisma.ordineTrasferimentoRiga.deleteMany({ where: { ordineId } }),
    prisma.ordineTrasferimento.delete({ where: { id: ordineId } }),
  ]);

  return NextResponse.json({ ok: true });
}