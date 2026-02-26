import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

function baseFromCodice(codice: string) {
  // rimuove eventuale ".<numero>" finale (es: OT-2026-00010.1 -> OT-2026-00010)
  return String(codice ?? "").trim().replace(/\.\d+$/, "");
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
        select: {
          id: true,
          anno: true,
          numero: true,
          suffisso: true,
          codice: true,
          stato: true,
          daMagazzinoId: true,
          aMagazzinoId: true,
          closedAt: true,
          righe: {
            select: {
              id: true,
              qty: true,
              qtyPrepared: true,
              codiceProdotto: true,
              descrizioneSnap: true,
            },
          },
        },
      });

      if (!ordine) return { kind: "error" as const, status: 404, msg: "Ordine non trovato" };

      if (ordine.stato === "CHIUSA") {
        return {
          kind: "ok" as const,
          alreadyClosed: true,
          closedAt: ordine.closedAt ? new Date(ordine.closedAt as any).toISOString() : null,
          closedCodice: ordine.codice ?? null,
          created: null,
        };
      }

      if (ordine.stato !== "INVIATA" && ordine.stato !== "IN_LAVORAZIONE") {
        return { kind: "error" as const, status: 409, msg: `Ordine non chiudibile in stato ${ordine.stato}` };
      }

      if (!ordine.righe.length) {
        return { kind: "error" as const, status: 409, msg: "Ordine vuoto: non chiudibile" };
      }

      // ✅ NON clampare qtyPrepared a qty: manteniamo il valore reale anche se > qty
      // Normalizzo solo valori invalidi (NaN / negativi) a 0
      const invalidRowIds: string[] = [];
      for (const r of ordine.righe) {
        const qp = Number(r.qtyPrepared ?? 0);
        if (!Number.isFinite(qp) || qp < 0) invalidRowIds.push(r.id);
      }

      if (invalidRowIds.length) {
        await tx.ordineTrasferimentoRiga.updateMany({
          where: { id: { in: invalidRowIds } },
          data: { qtyPrepared: 0 },
        });
      }

      // Calcolo righe non iniziate usando una versione "normalizzata" in memoria
      const righeNonIniziate = ordine.righe.filter((r) => {
        const qp = Number(r.qtyPrepared ?? 0);
        const qpNorm = !Number.isFinite(qp) || qp < 0 ? 0 : qp;
        return qpNorm === 0;
      });

      const baseCodice = baseFromCodice(ordine.codice);

      // 1) chiudo l'ordine attuale rinominandolo in ".0"
      let closedCodice = `${baseCodice}.0`;

      const existingClosed = await tx.ordineTrasferimento.findFirst({
        where: { codice: closedCodice, NOT: { id: ordine.id } },
        select: { id: true },
      });

      if (existingClosed) {
        const s = Number(ordine.suffisso ?? 0);
        closedCodice = `${baseCodice}.${s}.0`;
      }

      await tx.ordineTrasferimento.update({
        where: { id: ordine.id },
        data: {
          stato: "CHIUSA",
          closedAt: now,
          codice: closedCodice,
        },
      });

      // 2) se ci sono righe non iniziate → creo un nuovo ordine "approvato" e ci sposto le righe
      if (righeNonIniziate.length > 0) {
        const siblings = await tx.ordineTrasferimento.findMany({
          where: { anno: ordine.anno, numero: ordine.numero },
          select: { suffisso: true },
        });

        const used = new Set(siblings.map((x) => Number(x.suffisso ?? 0)));
        let nextSuff = 1;
        while (used.has(nextSuff)) nextSuff += 1;

        const created = await tx.ordineTrasferimento.create({
          data: {
            anno: ordine.anno,
            numero: ordine.numero,
            suffisso: nextSuff,
            codice: `${baseCodice}.${nextSuff}`,
            stato: "IN_LAVORAZIONE", // nasce già lavorabile
            daMagazzinoId: ordine.daMagazzinoId,
            aMagazzinoId: ordine.aMagazzinoId,
            emailDestinatario: null,
            sentAt: null,
            closedAt: null,
          },
          select: { id: true, codice: true },
        });

        await tx.ordineTrasferimentoRiga.updateMany({
          where: { id: { in: righeNonIniziate.map((r) => r.id) } },
          data: { ordineId: created.id, qtyPrepared: 0 },
        });

        return {
          kind: "ok" as const,
          alreadyClosed: false,
          closedAt: now.toISOString(),
          closedCodice,
          created: { id: created.id, codice: created.codice, movedRows: righeNonIniziate.length },
        };
      }

      return {
        kind: "ok" as const,
        alreadyClosed: false,
        closedAt: now.toISOString(),
        closedCodice,
        created: null,
      };
    });

    if (out.kind === "error") return bad(out.msg, out.status);

    return NextResponse.json({
      ok: true,
      alreadyClosed: out.alreadyClosed,
      closedAt: out.closedAt,
      closedCodice: out.closedCodice ?? null,
      created: out.created,
    });
  } catch (e: any) {
    return bad(e?.message ?? "Errore chiusura ordine", 500);
  }
}