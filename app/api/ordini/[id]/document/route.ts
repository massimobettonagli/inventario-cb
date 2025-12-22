import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";
import { buildOrdinePdfBuffer } from "@/lib/ordini/pdf";

export const runtime = "nodejs";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

function csvEscape(s: string) {
  const v = String(s ?? "").replace(/"/g, '""');
  return `"${v}"`;
}

function safeName(name: string) {
  return String(name ?? "")
    .trim()
    .replace(/[^\w\-]+/g, "_")
    .slice(0, 80);
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return bad("Non autorizzato", 401);

  const { id } = await ctx.params;
  const ordineId = String(id ?? "").trim();
  if (!ordineId) return bad("ID ordine mancante");

  const format = (req.nextUrl.searchParams.get("format") ?? "pdf").toLowerCase();

  const ordine = await prisma.ordineTrasferimento.findUnique({
    where: { id: ordineId },
    select: {
      id: true,
      codice: true,
      stato: true,
      createdAt: true,
      daMagazzino: { select: { nome: true } },
      aMagazzino: { select: { nome: true } },
      righe: {
        orderBy: { createdAt: "asc" },
        select: { codiceProdotto: true, descrizioneSnap: true, qty: true },
      },
    },
  });

  if (!ordine) return bad("Ordine non trovato", 404);

    // ---------------- PDF ----------------
  if (format === "pdf") {
    const { pdf, filename } = await buildOrdinePdfBuffer({
      codice: ordine.codice,
      stato: ordine.stato,
      createdAt: ordine.createdAt,
      daMagazzino: ordine.daMagazzino,
      aMagazzino: ordine.aMagazzino,
      righe: ordine.righe,
    });

    const outName = safeName(filename || ordine.codice || `ordine-${ordineId}`);

    // ✅ forza bytes su ArrayBuffer “normale” (niente SharedArrayBuffer nei tipi)
    const bytes = Uint8Array.from(pdf as unknown as Uint8Array);

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${outName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // ---------------- CSV ----------------
  if (format === "csv") {
    const lines: string[] = [];

    lines.push(
      ["CodiceOrdine", "Data", "DaMagazzino", "AMagazzino", "Stato"]
        .map(csvEscape)
        .join(",")
    );

    lines.push(
      [
        ordine.codice,
        new Date(ordine.createdAt).toISOString(),
        ordine.daMagazzino?.nome ?? "",
        ordine.aMagazzino?.nome ?? "",
        ordine.stato,
      ]
        .map(csvEscape)
        .join(",")
    );

    lines.push("");
    lines.push(["CodiceProdotto", "Descrizione", "Qty"].map(csvEscape).join(","));

    for (const r of ordine.righe) {
      lines.push(
        [r.codiceProdotto, r.descrizioneSnap ?? "", String(r.qty ?? 0)]
          .map(csvEscape)
          .join(",")
      );
    }

    const csv = "\ufeff" + lines.join("\n"); // BOM per Excel
    const outName = safeName(ordine.codice || `ordine-${ordineId}`);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${outName}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return bad("Formato non supportato. Usa format=pdf oppure format=csv", 400);
}