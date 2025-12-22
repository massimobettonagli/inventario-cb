import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Period = "day" | "week" | "month" | "year";

function normalizePeriod(input: string | null): Period {
  const p = String(input ?? "day").trim().toLowerCase();
  if (p === "day" || p === "week" || p === "month" || p === "year") return p;
  return "day";
}

function startOfPeriod(period: Period) {
  const now = new Date();

  if (period === "day") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  if (period === "week") {
    // lunedì come in Italia
    const day = now.getDay(); // 0=dom,1=lun...
    const diff = day === 0 ? 6 : day - 1;
    const d = new Date(now);
    d.setDate(now.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // year
  return new Date(now.getFullYear(), 0, 1);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const period = normalizePeriod(searchParams.get("period"));
  const magazzinoIdParam = (searchParams.get("magazzinoId") ?? "").trim();

  const from = startOfPeriod(period);
  const to = new Date();

  const where: any = {
    createdAt: { gte: from, lte: to },
  };
  if (magazzinoIdParam) where.magazzinoId = magazzinoIdParam;

  const [movimenti, prodottiDistinti, ultimiRaw] = await Promise.all([
    prisma.movimentoMagazzino.count({ where }),
    prisma.movimentoMagazzino.findMany({
      where,
      select: { codice: true },
      distinct: ["codice"],
    }),
    prisma.movimentoMagazzino.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        codice: true,
        magazzinoId: true,
        qtyPrima: true,
        qtyDopo: true,
        createdAt: true,
        magazzino: { select: { nome: true } },
      },
    }),
  ]);

  const ultimiMovimenti = ultimiRaw.map((r) => ({
    ...r,
    delta:
      r.qtyPrima == null || r.qtyDopo == null
        ? null
        : Number(r.qtyDopo) - Number(r.qtyPrima),
  }));

  const res = NextResponse.json({
    period,
    from: from.toISOString(),
    to: to.toISOString(),
    movimenti,
    prodottiModificati: prodottiDistinti.length,
    ultimiMovimenti,
  });

  // anti-cache “forte”
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");

  return res;
}