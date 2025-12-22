// lib/ordini/pdf.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

type PdfRiga = {
  codiceProdotto: string;
  descrizioneSnap: string | null;
  qty: number;
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

export async function buildOrdinePdfBuffer(
  order: PdfOrdine
): Promise<{ pdf: Uint8Array; filename: string }> {
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

  const colCod = 120;
  const colQty = 60;
  const colQr = 56;
  const colDesc = tableW - colCod - colQty - colQr;

  const headerH = 24;

  const drawTableHeader = () => {
    page.drawText("Codice", { x: tableX, y, size: 10, font: fontBold, color: text });

    page.drawText("Descrizione", {
      x: tableX + colCod,
      y,
      size: 10,
      font: fontBold,
      color: text,
    });

    page.drawText("Qty", {
      x: tableX + colCod + colDesc + colQty - 18,
      y,
      size: 10,
      font: fontBold,
      color: text,
    });

    page.drawText("QR", {
      x: tableX + colCod + colDesc + colQty + Math.round((colQr - 14) / 2),
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
  const rowH = 46;
  const rowPaddingTop = 20;

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
    if (ensureSpace(rowH + headerH)) drawTableHeader();

    const rowTopY = y - rowPaddingTop;

    page.drawText(r.codiceProdotto, {
      x: tableX,
      y: rowTopY,
      size: 10,
      font: fontBold,
      color: text,
      maxWidth: colCod,
    });

    const desc = (r.descrizioneSnap ?? "—").trim();
    page.drawText(desc, {
      x: tableX + colCod,
      y: rowTopY,
      size: 10,
      font: fontRegular,
      color: text,
      maxWidth: colDesc,
      lineHeight: 12,
    });

    page.drawText(String(r.qty ?? 0), {
      x: tableX + colCod + colDesc + colQty - 10,
      y: rowTopY,
      size: 10,
      font: fontBold,
      color: text,
    });

    const qrPng = await makeQrPng(r.codiceProdotto);
    const qrImg = await pdfDoc.embedPng(qrPng);

    const qrX = tableX + colCod + colDesc + colQty + Math.round((colQr - qrSize) / 2);
    const qrY = rowTopY - Math.round((rowH - qrSize) / 2) + 2;

    page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });

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