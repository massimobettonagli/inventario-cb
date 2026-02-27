import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function PATCH(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return bad("Non autorizzato", 401);

  const body = await req.json().catch(() => ({}));
  const rigaId = String(body?.rigaId ?? "").trim();
  const notaRaw = body?.nota;

  if (!rigaId) return bad("rigaId mancante");

  // nota può essere stringa vuota => la considero null
  const nota = typeof notaRaw === "string" ? notaRaw.trim() : "";
  const notaFinal = nota.length ? nota : null;

  // ✅ consentito SEMPRE, anche se ordine è CHIUSA
  // (volendo puoi mettere controlli ruolo, ma ora come richiesto no)
  const updated = await prisma.ordineTrasferimentoRiga.update({
    where: { id: rigaId },
    data: { nota: notaFinal },
    select: { id: true, nota: true, updatedAt: true },
  });

  return NextResponse.json({ ok: true, riga: updated });
}