import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const codice = (searchParams.get("codice") ?? "").trim();

  if (!codice) return NextResponse.json({ error: "codice mancante" }, { status: 400 });

  const prodotto = await prisma.prodotto.findUnique({
    where: { codice },
    select: {
      codice: true,
      descrizione: true,
      immagini: { orderBy: { createdAt: "desc" }, select: { url: true } },
    },
  });

  if (!prodotto) return NextResponse.json({ error: "Prodotto non trovato" }, { status: 404 });

  return NextResponse.json({ prodotto });
}