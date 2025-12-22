import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

/**
 * Escape testo per ZPL in modo robusto.
 * Usiamo ^FH per interpretare sequenze _XX in esadecimale.
 * - "_" -> _5F
 * - "\" -> _5C
 * - "^" -> _5E
 */
function zplEscapeFH(input: string) {
  return input.replace(/_/g, "_5F").replace(/\\/g, "_5C").replace(/\^/g, "_5E");
}

function zplForProduct(opts: {
  codice: string;
  labelWidthDots?: number; // ^PW
  labelHeightDots?: number; // ^LL
  qrModule?: number; // grandezza QR
  qrPrefix?: string; // es: "CB:" (opzionale)
}) {
  const {
    codice,
    labelWidthDots = 560, // 70mm @203dpi ≈ 560 dots
    labelHeightDots = 240, // 30mm @203dpi ≈ 240 dots
    qrModule = 6,
    qrPrefix = "CB:", // puoi metterlo "" se vuoi il codice puro
  } = opts;

  // ✅ QR CORTO: dentro al QR mettiamo SOLO codice (o "CB:codice")
  const qrDataRaw = `${qrPrefix}${codice}`;
  const qrData = zplEscapeFH(qrDataRaw);

  // Testo sotto: stampiamo SOLO il codice (senza prefisso)
  const codiceTxt = zplEscapeFH(codice);

  return [
    "^XA",
    "^CI28",
    `^PW${labelWidthDots}`,
    `^LL${labelHeightDots}`,
    "^LH0,0",

    // QR a sinistra
    `^FO30,20^BQN,2,${qrModule}^FH^FDLA,${qrData}^FS`,

    // TESTO a destra, centrato verticalmente
    `^FO260,95^A0N,28,28^FB280,2,0,C,0^FH^FD${codiceTxt}^FS`,

    "^XZ",
  ].join("\n");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // opzionali:
  // q = filtro per codice/descrizione
  // limit = limite (utile per prove)
  // offset = per batch
  const q = String(searchParams.get("q") ?? "").trim();
  const limit = Math.min(Number(searchParams.get("limit") ?? "0") || 0, 20000);
  const offset = Number(searchParams.get("offset") ?? "0") || 0;

  // prefisso QR opzionale (default "CB:")
  // se vuoi QR con solo codice: ?prefix=
  const prefix = searchParams.get("prefix");
  const qrPrefix = prefix === null ? "CB:" : prefix; // se non lo passi -> "CB:"; se lo passi vuoto -> ""

  // ✅ build-safe: niente {} e mode tipizzato correttamente
  const where: Prisma.ProdottoWhereInput | undefined = q.length
    ? {
        OR: [
          { codice: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { descrizione: { contains: q, mode: Prisma.QueryMode.insensitive } },
        ],
      }
    : undefined;

  const prodotti = await prisma.prodotto.findMany({
    where,
    orderBy: { codice: "asc" },
    skip: offset,
    take: limit > 0 ? limit : undefined,
    select: { codice: true },
  });

  // 70x30mm Zebra ZD420 @203dpi
  const labelWidthDots = 560;
  const labelHeightDots = 240;
  const qrModule = 6;

  const zpl = prodotti
    .map((p) =>
      zplForProduct({
        codice: p.codice,
        labelWidthDots,
        labelHeightDots,
        qrModule,
        qrPrefix,
      })
    )
    .join("\n\n");

  return new Response(zpl, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="etichette_qr_cb_${q ? "filtrate" : "tutte"}.zpl"`,
    },
  });
}