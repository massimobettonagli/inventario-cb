import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function parseQty(input: unknown) {
  if (typeof input === "number") return input;
  if (typeof input === "string") return Number(input.trim().replace(",", "."));
  return Number(input as any);
}

export async function PATCH(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return bad("Non autorizzato", 401);

  const body = await req.json().catch(() => ({}));

  const rigaId = String(body?.rigaId ?? "").trim();
  const qty = parseQty(body?.qty);

  if (!rigaId) return bad("Riga mancante");
  if (!Number.isFinite(qty) || qty <= 0) return bad("Quantità non valida");

  const riga = await prisma.ordineTrasferimentoRiga.findUnique({
    where: { id: rigaId },
    select: {
      id: true,
      ordineId: true,
      ordine: { select: { id: true, stato: true, daMagazzinoId: true } },
    },
  });

  if (!riga) return bad("Riga non trovata", 404);

  if (riga.ordine.stato !== "DRAFT") return bad("Ordine non modificabile", 409);

  const updated = await prisma.ordineTrasferimentoRiga.update({
    where: { id: rigaId },
    data: { qty },
    select: { id: true, codiceProdotto: true, qty: true },
  });

  return NextResponse.json({ ok: true, riga: updated });
}