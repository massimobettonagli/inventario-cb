import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

function pad(n: number, len = 5) {
  return String(n).padStart(len, "0");
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return bad("Non autorizzato", 401);

  const body = await req.json().catch(() => ({}));
  const daMagazzinoId = String(body?.daMagazzinoId ?? "").trim();
  const aMagazzinoId = String(body?.aMagazzinoId ?? "").trim();

  if (!daMagazzinoId || !aMagazzinoId) return bad("Seleziona magazzino di partenza e destinazione");
  if (daMagazzinoId === aMagazzinoId) return bad("Partenza e destinazione non possono coincidere");

 

  const anno = new Date().getFullYear();

  const ordine = await prisma.$transaction(async (tx) => {
    const last = await tx.ordineTrasferimento.findFirst({
      where: { anno },
      orderBy: { numero: "desc" },
      select: { numero: true },
    });

    const numero = (last?.numero ?? 0) + 1;
    const codice = `OT-${anno}-${pad(numero)}`;

    const created = await tx.ordineTrasferimento.create({
      data: {
        anno,
        numero,
        codice,
        stato: "DRAFT",
        daMagazzinoId,
        aMagazzinoId,
      },
      select: {
        id: true,
        anno: true,
        numero: true,
        codice: true,
        stato: true,
        daMagazzinoId: true,
        aMagazzinoId: true,
      },
    });

    return created;
  });

  return NextResponse.json({ ok: true, ordine });
}