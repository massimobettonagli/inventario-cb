import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return bad("Non autorizzato", 401);

  const { id } = await params;
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
        },
      },
    },
  });

  if (!ordine) return bad("Ordine non trovato", 404);

  const righe = ordine.righe.map((r) => {
    const prep = r.qtyPrepared ?? 0;
    const req = r.qty ?? 0;
    const rowStatus = prep >= req ? "DONE" : prep > 0 ? "PARTIAL" : "NOT_STARTED";
    return { ...r, qtyPrepared: prep, rowStatus };
  });

  return NextResponse.json({ ok: true, ordine: { ...ordine, righe } });
}