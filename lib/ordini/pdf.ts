// lib/ordini/pdf.ts
import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";
import QRCode from "qrcode";

type PdfRiga = {
  codiceProdotto: string;
  descrizioneSnap: string | null;
  qty: number;
  nota: string | null; // ✅ NUOVO
};

export type PdfOrdine = {
  codice: string;
  stato: string;
  createdAt: Date;
  daMagazzino: { nome: string };
  aMagazzino: { nome: string };
  righe: PdfRiga[];
};

function safeFileName(s: string) {
  return String(s ?? "")
    .trim()
    .replace(/[^\w\-]+/g, "_")
    .slice(0, 80);
}

/**
 * Wrap “semplice” basato su width reale del font.
 * Non spezza parole a metà (se una parola è troppo lunga la tronca).
 */
function wrapText(opts: {
  text: string;
  font: PDFFont;
  fontSize: number;
  maxWidth: number;
  maxLines?: number;
}) {
  const { font, fontSize, maxWidth } = opts;
  const maxLines = opts.maxLines ?? 999;

  const raw = String(opts.text ?? "").replace(/\r/g, "").replace(/\n+/g, "\n").trim();
  if (!raw) return ["—"];

  const paragraphs = raw.split("\n");
  const out: string[] = [];

  const widthOf = (t: string) => font.widthOfTextAtSize(t, fontSize);

  for (const p of paragraphs) {
    const words = p.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("—");
      continue;
    }

    let line = "";

    for (const w of words) {
      const next = line ? `${line} ${w}` : w;

      if (widthOf(next) <= maxWidth) {
        line = next;
        continue;
      }

      // chiudi la riga corrente
      if (line) out.push(line);

      // parola troppo lunga: tronca
      if (widthOf(w) > maxWidth) {
        let cut = w;
        while (cut.length > 1 && widthOf(cut + "…") > maxWidth) cut = cut.slice(0, -1);
        out.push(cut.length < w.length ? cut + "…" : cut);
        line = "";
      } else {
        line = w;
      }

      if (out.length >= maxLines) break;
    }

    if (out.length >= maxLines) break;
    if (line) out.push(line);

    if (out.length >= maxLines) break;
  }

  // Se abbiamo tagliato per maxLines, aggiungi ellissi all’ultima riga (se serve)
  if (out.length > maxLines) out.length = maxLines;
  return out.slice(0, maxLines);
}

export async function buildOrdinePdfBuffer(order: PdfOrdine): Promise<{ pdf: Uint8Array; filename: string }> {
  const pdfDoc = await PDFDocument.create();

  // A4 in points
  const A4 = { width: 595.28, height: 841.89 };

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 40;

  const line = rgb(0.89, 0.92, 0.95); // #E2E8F0
  const text = rgb(0.06, 0.09, 0.16); // #0F172A
  const muted = rgb(0.20, 0.26, 0.34); // #334155
  const footerCol = rgb(0.39, 0.45, 0.55);

  // ====== PAGE STATE ======
  let page = pdfDoc.addPage([A4.width, A4.height]);
  let y = A4.height - margin;

  const drawHr = (yy = y) => {
    page.drawLine({
      start: { x: margin, y: yy },
      end: { x: A4.width - margin, y: yy },
      thickness: 1,
      color: line,
    });
  };

  const newPage = () => {
    page = pdfDoc.addPage([A4.width, A4.height]);
    y = A4.height - margin;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      newPage();
      return true;
    }
    return false;
  };

  // ===== HEADER =====
  page.drawText("Ordine di magazzino", {
    x: margin,
    y,
    size: 18,
    font: fontBold,
    color: text,
  });
  y -= 24;

  page.drawText("Codice:", { x: margin, y, size: 12, font: fontBold, color: text });
  page.drawText(order.codice, {
    x: margin + 55,
    y,
    size: 12,
    font: fontRegular,
    color: text,
  });
  y -= 16;

  const meta = [
    `Da: ${order.daMagazzino.nome}`,
    `A: ${order.aMagazzino.nome}`,
    `Stato: ${order.stato}`,
    `Creato il: ${new Date(order.createdAt).toLocaleString("it-IT")}`,
  ];
  for (const m of meta) {
    page.drawText(m, { x: margin, y, size: 10.5, font: fontRegular, color: muted });
    y -= 14;
  }

  y -= 8;
  drawHr();
  y -= 16;

  // ===== TABLE LAYOUT =====
  const tableX = margin;
  const tableW = A4.width - margin * 2;

  // Colonne (aggiunta Nota)
  const colCod = 110;
  const colQty = 48;
  const colQr = 56;
  const colNota = 120;
  const colDesc = tableW - colCod - colNota - colQty - colQr;

  const headerH = 28;

  const drawTableHeader = () => {
    // Titoli
    page.drawText("Codice", { x: tableX, y, size: 10, font: fontBold, color: text });

    page.drawText("Descrizione", {
      x: tableX + colCod,
      y,
      size: 10,
      font: fontBold,
      color: text,
    });

    page.drawText("Nota", {
      x: tableX + colCod + colDesc,
      y,
      size: 10,
      font: fontBold,
      color: text,
    });

    page.drawText("Qty", {
      x: tableX + colCod + colDesc + colNota + colQty - 18,
      y,
      size: 10,
      font: fontBold,
      color: text,
    });

    page.drawText("QR", {
      x: tableX + colCod + colDesc + colNota + colQty + Math.round((colQr - 14) / 2),
      y,
      size: 10,
      font: fontBold,
      color: text,
    });

    y -= 10;
    drawHr();
    y -= 14;
  };

  drawTableHeader();

  // ===== ROW SETTINGS =====
  const qrSize = 28;
  const fontSizeRow = 9.5;
  const lineHeight = 12;

  async function makeQrPng(textValue: string) {
    return QRCode.toBuffer(textValue, {
      type: "png",
      margin: 0,
      scale: 4,
      errorCorrectionLevel: "M",
    });
  }

  // ===== ROWS =====
  for (const r of order.righe) {
    const desc = (r.descrizioneSnap ?? "—").trim();
    const nota = (r.nota ?? "").trim();

    const descLines = wrapText({
      text: desc || "—",
      font: fontRegular,
      fontSize: fontSizeRow,
      maxWidth: colDesc - 8,
      maxLines: 4,
    });

    const notaLines = wrapText({
      text: nota || "—",
      font: fontRegular,
      fontSize: fontSizeRow,
      maxWidth: colNota - 8,
      maxLines: 4,
    });

    const maxTextLines = Math.max(descLines.length, notaLines.length, 1);

    // Altezza riga dinamica: spazio sopra + testo + spazio sotto, e comunque almeno per QR
    const textBlockH = maxTextLines * lineHeight;
    const rowH = Math.max(46, textBlockH + 22, qrSize + 18);

    if (ensureSpace(rowH + headerH)) drawTableHeader();

    const rowTopY = y - 16; // baseline di partenza testo

    // Codice
    page.drawText(r.codiceProdotto, {
      x: tableX,
      y: rowTopY,
      size: 10,
      font: fontBold,
      color: text,
      maxWidth: colCod - 6,
    });

    // Descrizione (multiline)
    for (let i = 0; i < descLines.length; i++) {
      page.drawText(descLines[i], {
        x: tableX + colCod,
        y: rowTopY - i * lineHeight,
        size: fontSizeRow,
        font: fontRegular,
        color: text,
      });
    }

    // Nota (multiline)
    for (let i = 0; i < notaLines.length; i++) {
      page.drawText(notaLines[i], {
        x: tableX + colCod + colDesc,
        y: rowTopY - i * lineHeight,
        size: fontSizeRow,
        font: fontRegular,
        color: text,
      });
    }

    // Qty
    page.drawText(String(r.qty ?? 0), {
      x: tableX + colCod + colDesc + colNota + colQty - 10,
      y: rowTopY,
      size: 10,
      font: fontBold,
      color: text,
    });

    // QR
    const qrPng = await makeQrPng(r.codiceProdotto);
    const qrImg = await pdfDoc.embedPng(qrPng);

    const qrX = tableX + colCod + colDesc + colNota + colQty + Math.round((colQr - qrSize) / 2);
    // centra verticalmente nel blocco riga
    const qrY = y - rowH + Math.round((rowH - qrSize) / 2);

    page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });

    // Riga successiva
    y -= rowH;
    drawHr();
    y -= 12;
  }

  // ===== FOOTER =====
  ensureSpace(30);
  page.drawText("Inventario CB • Ordine di magazzino", {
    x: margin,
    y,
    size: 9,
    font: fontRegular,
    color: footerCol,
  });

  const pdfBytes = await pdfDoc.save(); // Uint8Array
  return {
    pdf: pdfBytes,
    filename: `ordine_${safeFileName(order.codice)}`,
  };
}