// app/api/ordini/send/route.ts
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";
import { buildOrdinePdfBuffer } from "@/lib/ordini/pdf";

export const runtime = "nodejs";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return bad("Non autorizzato", 401);

    const body = await req.json().catch(() => ({}));
    const ordineId = String(body?.ordineId ?? "").trim();
    const email = String(body?.email ?? "").trim();

    if (!ordineId) return bad("ordineId mancante");
    if (!email || !isValidEmail(email)) return bad("Email non valida");

    const ordine = await prisma.ordineTrasferimento.findUnique({
      where: { id: ordineId },
      select: {
        id: true,
        codice: true,
        stato: true,
        createdAt: true,
        daMagazzino: { select: { nome: true } },
        aMagazzino: { select: { nome: true } },
        righe: {
          orderBy: { createdAt: "asc" },
          select: { codiceProdotto: true, descrizioneSnap: true, qty: true },
        },
      },
    });

    if (!ordine) return bad("Ordine non trovato", 404);
    if (!ordine.righe?.length) return bad("Ordine vuoto: aggiungi almeno una riga", 400);

    // SMTP env
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? 465);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user;

    if (!host || !user || !pass || !from) {
      return bad(
        "Configurazione SMTP mancante (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM)",
        500
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    // (opzionale ma utile) verifica connessione SMTP
    // await transporter.verify();

    // PDF
    const { pdf, filename } = await buildOrdinePdfBuffer({
      codice: ordine.codice,
      stato: ordine.stato,
      createdAt: ordine.createdAt,
      daMagazzino: ordine.daMagazzino,
      aMagazzino: ordine.aMagazzino,
      righe: ordine.righe,
    });

    // ✅ Nodemailer vuole Buffer (o string/stream)
    const pdfBuffer = Buffer.from(pdf);

    const subject = `Ordine di magazzino ${ordine.codice} • ${ordine.daMagazzino.nome} → ${ordine.aMagazzino.nome}`;
    const text =
      `In allegato la distinta ordine in PDF (con QR per ogni riga).\n\n` +
      `Ordine: ${ordine.codice}\n` +
      `Da: ${ordine.daMagazzino.nome}\n` +
      `A: ${ordine.aMagazzino.nome}\n` +
      `Stato: ${ordine.stato}\n`;

    await transporter.sendMail({
      from,
      to: email,
      subject,
      text,
      attachments: [
        {
          filename: `${filename}.pdf`,
          content: pdfBuffer, // ✅ FIX
          contentType: "application/pdf",
        },
      ],
    });

    // update ordine: salva invio + stato
    const nextStato =
      ordine.stato === "INVIATA" || ordine.stato === "CHIUSA" ? ordine.stato : "INVIATA";

    await prisma.ordineTrasferimento.update({
      where: { id: ordineId },
      data: {
        emailDestinatario: email,
        sentAt: new Date(),
        stato: nextStato,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Errore invio email" },
      { status: 500 }
    );
  }
}