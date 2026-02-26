import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

function baseFromCodice(codice: string) {
  // gestisce:
  // OT-2026-00010.0 -> OT-2026-00010
  // OT-2026-00010.1 -> OT-2026-00010
  // OT-2026-00010.1.0 -> OT-2026-00010
  const s = String(codice ?? "").trim();
  return s
    .replace(/\.\d+\.0$/, "") // .<n>.0
    .replace(/\.0$/, "")      // .0
    .replace(/\.\d+$/, "");   // .<n>
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return bad("Non autorizzato", 401);

  const body = await req.json().catch(() => ({}));
  const ordineId = String(body?.ordineId ?? "").trim();
  const rigaId = String(body?.rigaId ?? "").trim();

  if (!ordineId) return bad("ordineId mancante");
  if (!rigaId) return bad("rigaId mancante");

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
        },
      });

      if (!ordine) return { kind: "error" as const, status: 404, msg: "Ordine non trovato" };

      if (ordine.stato !== "CHIUSA") {
        return { kind: "error" as const, status: 409, msg: "Operazione consentita solo su ordini CHIUSI" };
      }

      const riga = await tx.ordineTrasferimentoRiga.findUnique({
        where: { id: rigaId },
        select: {
          id: true,
          ordineId: true,
          codiceProdotto: true,
          descrizioneSnap: true,
          qty: true,
          qtyPrepared: true,
        },
      });

      if (!riga || riga.ordineId !== ordine.id) {
        return { kind: "error" as const, status: 404, msg: "Riga non trovata (o non appartiene all’ordine)" };
      }

      const qty = Number(riga.qty ?? 0);
      const prep = Number(riga.qtyPrepared ?? 0);

      if (!Number.isFinite(qty) || !Number.isFinite(prep) || qty <= 0) {
        return { kind: "error" as const, status: 409, msg: "Quantità riga non valida" };
      }

      // Deve essere parziale: 0 < prep < qty
      if (!(prep > 0 && prep < qty)) {
        return { kind: "error" as const, status: 409, msg: "La riga non è in stato PARZIALE" };
      }

      const residuo = qty - prep;
      if (residuo <= 0) {
        return { kind: "error" as const, status: 409, msg: "Residuo non valido" };
      }

      const baseCodice = baseFromCodice(ordine.codice);

      // “ordine successivo”: se sei su suffisso 0 -> 1, altrimenti suffisso+1
      const currentSuff = Number(ordine.suffisso ?? 0);
      const targetSuff = currentSuff === 0 ? 1 : currentSuff + 1;
      const targetCodice = `${baseCodice}.${targetSuff}`;

      // trovo o creo l'ordine target
      const targetOrder = await tx.ordineTrasferimento.upsert({
        where: { anno_numero_suffisso: { anno: ordine.anno, numero: ordine.numero, suffisso: targetSuff } },
        update: {},
        create: {
          anno: ordine.anno,
          numero: ordine.numero,
          suffisso: targetSuff,
          codice: targetCodice,
          stato: "IN_LAVORAZIONE", // ✅ già approvato/da preparare
          daMagazzinoId: ordine.daMagazzinoId,
          aMagazzinoId: ordine.aMagazzinoId,
          emailDestinatario: null,
          sentAt: null,
          closedAt: null,
        },
        select: { id: true, codice: true, stato: true },
      });

      if (targetOrder.stato === "CHIUSA") {
        return {
          kind: "error" as const,
          status: 409,
          msg: `Non posso spostare il residuo: l'ordine ${targetOrder.codice} è già CHIUSO`,
        };
      }

      // 1) Nel .0: porto qty = qtyPrepared (così la riga risulta completata)
      await tx.ordineTrasferimentoRiga.update({
        where: { id: riga.id },
        data: {
          qty: prep,
          // qtyPrepared rimane prep -> ora qtyPrepared == qty => DONE
        },
      });

      // 2) Nel .1: creo riga residua
      const createdRow = await tx.ordineTrasferimentoRiga.create({
        data: {
          ordineId: targetOrder.id,
          codiceProdotto: riga.codiceProdotto,
          descrizioneSnap: riga.descrizioneSnap,
          qty: residuo,
          qtyPrepared: 0,
        },
        select: { id: true },
      });

      return {
        kind: "ok" as const,
        targetOrder: { id: targetOrder.id, codice: targetOrder.codice },
        createdRowId: createdRow.id,
        qtyDelivered: prep,
        qtyResidual: residuo,
        at: now.toISOString(),
      };
    });

    if (out.kind === "error") return bad(out.msg, out.status);

    return NextResponse.json({ ok: true, ...out });
  } catch (e: any) {
    return bad(e?.message ?? "Errore split residuo", 500);
  }
}