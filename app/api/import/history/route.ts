import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const magazzinoId = String(searchParams.get("magazzinoId") ?? "").trim();

    const where: any = { kind: "IMPORT_PRODOTTI" };
    if (magazzinoId) where.magazzinoId = magazzinoId;

    // ✅ qui il risultato si chiama "items" (così items.map esiste)
    const items = await prisma.importUpload.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        originalName: true,
        storedName: true,
        magazzinoNome: true,
        createdAt: true,
        rows: true,
        createdProducts: true,
        updatedProducts: true,
        upsertedGiacenze: true,
        magazzinoId: true,
      },
    });

    const normalized = items.map((x) => ({
      id: x.id,
      fileName: x.originalName || x.storedName || "—",
      magazzinoNome: x.magazzinoNome ?? null,
      createdAt: x.createdAt.toISOString(),
      rows: x.rows ?? null,
      createdProducts: x.createdProducts ?? null,
      updatedProducts: x.updatedProducts ?? null,
      upsertedGiacenze: x.upsertedGiacenze ?? null,
    }));

    return NextResponse.json({ items: normalized });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Errore caricamento storico" }, { status: 500 });
  }
}