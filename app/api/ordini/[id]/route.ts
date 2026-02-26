import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ✅ Next 16: params può essere Promise
) {
  const session = await getSessionFromCookies();
  if (!session) return bad("Non autorizzato", 401);

  try {
    const { id } = await params; // ✅ fondamentale nel tuo setup
    const ordineId = String(id ?? "").trim();
    if (!ordineId) return bad("ID mancante");

    const ordine = await prisma.ordineTrasferimento.findUnique({
      where: { id: ordineId },
      select: {
        id: true,
        codice: true,
        stato: true,
        createdAt: true,
        closedAt: true,
        sentAt: true,
        emailDestinatario: true,
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
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!ordine) return bad("Ordine non trovato", 404);

    const righe = (ordine.righe ?? []).map((r) => {
      const reqQty = Number(r.qty ?? 0);
      const prepQty = Number(r.qtyPrepared ?? 0);

      const safeReq = Number.isFinite(reqQty) && reqQty >= 0 ? reqQty : 0;
      const safePrep = Number.isFinite(prepQty) && prepQty >= 0 ? prepQty : 0;

      const rowStatus = safePrep >= safeReq ? "DONE" : safePrep > 0 ? "PARTIAL" : "NOT_STARTED";

      return {
        ...r,
        qty: safeReq,
        qtyPrepared: safePrep, // ✅ resta reale, anche se > qty
        rowStatus,
      };
    });

    return NextResponse.json({ ok: true, ordine: { ...ordine, righe } });
  } catch (e: any) {
    return bad(e?.message ?? "Errore caricamento ordine", 500);
  }
}