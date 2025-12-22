// app/api/prodotti/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const magazzinoId = String(searchParams.get("magazzinoId") ?? "").trim();
  const q = String(searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = 50;

  if (!magazzinoId) {
    return NextResponse.json({ items: [], totale: 0, page, pageSize });
  }

  // ✅ NON filtro più "giacenze some magazzinoId"
  // così la lista non resta vuota se la giacenza non è stata creata (import timeout ecc.)
  const where: Prisma.ProdottoWhereInput = {};

  if (q) {
    where.OR = [
      { codice: { contains: q, mode: "insensitive" } },
      { descrizione: { contains: q, mode: "insensitive" } },
    ];
  }

  const [items, totale] = await Promise.all([
    prisma.prodotto.findMany({
      where,
      orderBy: { codice: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        codice: true,
        descrizione: true,
        giacenze: {
          where: { magazzinoId },
          select: { qtyAttuale: true },
          take: 1,
        },
      },
    }),
    prisma.prodotto.count({ where }),
  ]);

  return NextResponse.json({
    items: items.map((p) => ({
      codice: p.codice,
      descrizione: p.descrizione,
      qtyAttuale: p.giacenze[0]?.qtyAttuale ?? 0,
      thumbUrl: null,
    })),
    totale,
    page,
    pageSize,
  });
}