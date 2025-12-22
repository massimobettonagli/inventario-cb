import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const magazzini = await prisma.magazzino.findMany({
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    });

    return NextResponse.json({ magazzini });
  } catch (err) {
    console.error("GET /api/magazzini error:", err);
    return NextResponse.json({ error: "Errore caricamento magazzini" }, { status: 500 });
  }
}