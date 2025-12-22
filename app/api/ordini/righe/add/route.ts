import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function toPositiveInt(input: unknown, fallback = NaN) {
  let n: number;

  if (typeof input === "number") n = input;
  else if (typeof input === "string") n = Number(input.trim().replace(",", "."));
  else n = Number(input as any);

  if (!Number.isFinite(n)) return fallback;
  n = Math.round(n);
  if (n <= 0) return fallback;
  return n;
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return bad("Non autorizzato", 401);

  const body = await req.json().catch(() => ({}));

  const ordineId = String(body?.ordineId ?? "").trim();

  // compat frontend: codice oppure codiceProdotto
  const codice = String(body?.codice ?? body?.codiceProdotto ?? "").trim();

  // compat: qty oppure qtyAdd
  const qty = toPositiveInt(body?.qty ?? body?.qtyAdd);

  if (!ordineId || !codice) return bad("Dati mancanti");
  if (!Number.isFinite(qty)) return bad("Quantità non valida");

  // ordine + stato
  const ordine = await prisma.ordineTrasferimento.findUnique({
    where: { id: ordineId },
    select: { id: true, stato: true },
  });

  if (!ordine) return bad("Ordine non trovato", 404);

  // ✅ REGOLA: modifiche solo in DRAFT
  if (ordine.stato !== "DRAFT") return bad("Ordine non modificabile", 409);

  // snapshot descrizione (fuori tx va bene, è solo lettura)
  const prodotto = await prisma.prodotto.findUnique({
    where: { codice },
    select: { descrizione: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    // cerco riga esistente DENTRO la transazione
    const existing = await tx.ordineTrasferimentoRiga.findFirst({
      where: { ordineId, codiceProdotto: codice },
      select: { id: true, qty: true },
    });

    let mode: "sum" | "new" = "new";
    let riga: { id: string; codiceProdotto: string; qty: number };

    if (existing) {
      mode = "sum";
      riga = await tx.ordineTrasferimentoRiga.update({
        where: { id: existing.id },
        data: { qty: existing.qty + qty },
        select: { id: true, codiceProdotto: true, qty: true },
      });
    } else {
      riga = await tx.ordineTrasferimentoRiga.create({
        data: {
          ordineId,
          codiceProdotto: codice,
          descrizioneSnap: prodotto?.descrizione ?? null,
          qty,
        },
        select: { id: true, codiceProdotto: true, qty: true },
      });
    }

    // righe aggiornate (per popolare subito tabella)
    const righe = await tx.ordineTrasferimentoRiga.findMany({
      where: { ordineId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        codiceProdotto: true,
        descrizioneSnap: true,
        qty: true,
        createdAt: true,
      },
    });

    return { mode, riga, righe };
  });

  return NextResponse.json({ ok: true, ...result });
}