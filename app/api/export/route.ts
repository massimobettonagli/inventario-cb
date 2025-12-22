import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const magazzinoId = searchParams.get("magazzinoId") ?? "";
  const format = (searchParams.get("format") ?? "xlsx").toLowerCase(); // xlsx | csv

  if (!magazzinoId) {
    return new Response("magazzinoId mancante", { status: 400 });
  }

  const magazzino = await prisma.magazzino.findUnique({ where: { id: magazzinoId } });
  if (!magazzino) return new Response("Magazzino non valido", { status: 400 });

  const prodotti = await prisma.prodotto.findMany({
    orderBy: { codice: "asc" },
    select: {
      codice: true,
      descrizione: true,
      giacenze: {
        where: { magazzinoId },
        select: { qtyUltimoInventario: true, qtyAttuale: true },
        take: 1,
      },
    },
  });

  const data = prodotti.map((p) => ({
    codice: p.codice,
    descrizione: p.descrizione,
    qty_ultimo_inventario: p.giacenze[0]?.qtyUltimoInventario ?? 0,
    qty_attuale: p.giacenze[0]?.qtyAttuale ?? 0,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");

  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(ws);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="inventario_${magazzino.nome}.csv"`,
      },
    });
  }

  const xlsxBuf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Response(xlsxBuf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="inventario_${magazzino.nome}.xlsx"`,
    },
  });
}