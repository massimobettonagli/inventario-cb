// app/api/import/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

function toInt(v: any) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ✅ limita concorrenza senza dipendenze (FIX TS-safe)
async function asyncPool<T, R>(
  poolLimit: number,
  array: T[],
  iteratorFn: (item: T) => Promise<R>
) {
  const ret: Promise<R>[] = [];
  const executing: Promise<void>[] = [];

  for (const item of array) {
    const p: Promise<R> = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);

    if (poolLimit <= array.length) {
      const tracked: Promise<void> = p.then(() => {
        const index = executing.indexOf(tracked);
        if (index >= 0) executing.splice(index, 1);
      });

      executing.push(tracked);

      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(ret);
}

type CleanRow = {
  codice: string;
  descrizione: string;
  qtyUltimoInventario: number;
  qtyAttuale: number;
};

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const magazzinoId = String(form.get("magazzinoId") ?? "").trim();

    if (!file) return NextResponse.json({ error: "File mancante" }, { status: 400 });
    if (!magazzinoId) return NextResponse.json({ error: "magazzinoId mancante" }, { status: 400 });

    const magazzino = await prisma.magazzino.findUnique({ where: { id: magazzinoId } });
    if (!magazzino) return NextResponse.json({ error: "Magazzino non valido" }, { status: 400 });

    // 1) Leggi file
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheetName = wb.SheetNames?.[0];
    if (!sheetName) return NextResponse.json({ error: "Foglio Excel non trovato" }, { status: 400 });

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

    const cleaned: CleanRow[] = rows
      .map((r) => {
        const codice = String(
          r.codice ??
            r.Codice ??
            r.CODICE ??
            r["Codice prodotto"] ??
            r["codice prodotto"] ??
            ""
        ).trim();

        const descrizione = String(
          r.descrizione ??
            r.Descrizione ??
            r.DESCRIZIONE ??
            r["Descrizione prodotto"] ??
            ""
        ).trim();

        const qtyUltimoInventario = toInt(
          r.qty_ultimo_inventario ??
            r["qty_ultimo_inventario"] ??
            r["ultimo_inventario"] ??
            r["Ultimo inventario"] ??
            0
        );

        const qtyAttuale = toInt(
          r.qty_attuale ??
            r["qty_attuale"] ??
            r["attuale"] ??
            r["Qta"] ??
            r["Q.tà"] ??
            0
        );

        if (!codice) return null;

        return {
          codice,
          descrizione: descrizione || codice,
          qtyUltimoInventario,
          qtyAttuale,
        };
      })
      .filter(Boolean) as CleanRow[];

    if (cleaned.length === 0) {
      return NextResponse.json(
        { error: "Nessuna riga valida. Serve almeno la colonna 'codice'." },
        { status: 400 }
      );
    }

    // codici unici
    const codici = Array.from(new Set(cleaned.map((r) => r.codice)));
    const uniqueCount = codici.length;

    // 2) prodotti già presenti
    const existing = await prisma.prodotto.findMany({
      where: { codice: { in: codici } },
      select: { id: true, codice: true },
    });
    const existingSet = new Set(existing.map((p) => p.codice));

    // 3) crea prodotti mancanti
    const toCreate = codici
      .filter((c) => !existingSet.has(c))
      .map((c) => {
        const first = cleaned.find((x) => x.codice === c)!;
        return { codice: c, descrizione: first.descrizione };
      });

    let createdProducts = 0;
    for (const part of chunk(toCreate, 1000)) {
      const res = await prisma.prodotto.createMany({ data: part, skipDuplicates: true });
      createdProducts += res.count;
    }

    // 4) aggiorna descrizioni (limito concorrenza)
    const uniqueForUpdate = codici.map((c) => {
      const first = cleaned.find((x) => x.codice === c)!;
      return { codice: c, descrizione: first.descrizione };
    });

    for (const part of chunk(uniqueForUpdate, 500)) {
      await asyncPool(20, part, (r) =>
        prisma.prodotto
          .update({ where: { codice: r.codice }, data: { descrizione: r.descrizione } })
          .catch(() => null)
      );
    }

    // 5) mappa codice -> id prodotto
    const all = await prisma.prodotto.findMany({
      where: { codice: { in: codici } },
      select: { id: true, codice: true },
    });
    const mapId = new Map(all.map((p) => [p.codice, p.id]));

    // 6) upsert giacenze (limito concorrenza per evitare timeout)
    let upsertedGiacenze = 0;

    for (const part of chunk(cleaned, 1000)) {
      const results = await asyncPool(20, part, async (r) => {
        const prodottoId = mapId.get(r.codice);
        if (!prodottoId) return false;

        await prisma.giacenza.upsert({
          where: { prodottoId_magazzinoId: { prodottoId, magazzinoId } },
          update: {
            qtyUltimoInventario: r.qtyUltimoInventario,
            qtyAttuale: r.qtyAttuale,
          },
          create: {
            prodottoId,
            magazzinoId,
            qtyUltimoInventario: r.qtyUltimoInventario,
            qtyAttuale: r.qtyAttuale,
          },
        });

        return true;
      });

      upsertedGiacenze += results.filter(Boolean).length;
    }

    const updatedProducts = Math.max(0, uniqueCount - createdProducts);

    // 7) storico import
    try {
      await prisma.importUpload.create({
        data: {
          originalName: file.name ?? "upload",
          storedName: file.name ?? "upload",
          mimeType: file.type || "application/octet-stream",
          size: Number(file.size ?? 0),
          uploaderEmail: null,
          kind: "IMPORT_PRODOTTI",
          magazzinoId,
          magazzinoNome: magazzino.nome,
          rows: cleaned.length,
          createdProducts,
          updatedProducts,
          upsertedGiacenze,
        },
      });
    } catch (e) {
      console.error("Storico ImportUpload non salvato:", e);
    }

    return NextResponse.json({
      ok: true,
      magazzino: magazzino.nome,
      rows: cleaned.length,
      uniqueCodes: uniqueCount,
      createdProducts,
      updatedProducts,
      upsertedGiacenze,
      fileName: file.name ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Errore import" }, { status: 500 });
  }
}