"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";

const BRAND_RED = "#C73A3A";
const DUP_COOLDOWN_MS = 1200;
const STORAGE_KEY = "magazzinoId"; // ✅ stesso della lista prodotti

export default function ScannerClient({
  from,
  mode,
  ordineId,
}: {
  from: string;
  mode: string;
  ordineId: string;
}) {
  const backTo = useMemo(() => (from && from.startsWith("/") ? from : "/"), [from]);

  const isOrderMode = (mode ?? "").trim().toLowerCase() === "ordine";
  const ordineIdClean = (ordineId ?? "").trim();
  const hasOrderContext = isOrderMode && Boolean(ordineIdClean);

  // quando apro un prodotto dallo scanner, voglio che il suo "torna indietro" torni qui con contesto
  const scannerSelfFrom = useMemo(() => {
    const p = new URLSearchParams();
    p.set("from", backTo);
    if (hasOrderContext) {
      p.set("mode", "ordine");
      p.set("ordineId", ordineIdClean);
    }
    return `/scanner?${p.toString()}`;
  }, [backTo, hasOrderContext, ordineIdClean]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  // anti-doppia lettura + lock navigazione
  const lastTextRef = useRef<string>("");
  const lastTsRef = useRef<number>(0);
  const navigatingRef = useRef<boolean>(false);

  useEffect(() => {
    readerRef.current = new BrowserMultiFormatReader();

    if (!isOrderMode || hasOrderContext) {
      start();
    } else {
      setError("Modalità ordine attiva ma manca ordineId nell’URL.");
    }

    return () => {
      stop();
      readerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function beepScan() {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();

      o.type = "square";
      o.frequency.value = 1200;
      g.gain.value = 0.05;

      o.connect(g);
      g.connect(ctx.destination);

      o.start();
      setTimeout(() => {
        o.stop();
        ctx.close?.();
      }, 60);
    } catch {}
  }

  function vibrate() {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        // @ts-ignore
        navigator.vibrate?.(20);
      }
    } catch {}
  }

  function stop() {
    try {
      controlsRef.current?.stop();
    } catch {}
    controlsRef.current = null;
    setScanning(false);
  }

  function getSavedMagazzinoId(): string {
    try {
      if (typeof window === "undefined") return "";
      return (localStorage.getItem(STORAGE_KEY) ?? "").trim();
    } catch {
      return "";
    }
  }

  async function start() {
    setError(null);
    setScanning(true);
    navigatingRef.current = false;

    try {
      const video = videoRef.current;
      if (!video) throw new Error("Video non disponibile");

      lastTextRef.current = "";
      lastTsRef.current = 0;

      // stop eventuali precedenti
      try {
        controlsRef.current?.stop();
      } catch {}
      controlsRef.current = null;

      const reader = readerRef.current;
      if (!reader) throw new Error("Reader non disponibile");

      const controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
        if (!result) return;
        if (navigatingRef.current) return;

        let text = result.getText();
        text = text.replace(/\r?\n|\r/g, " ").trim().replace(/\s+/g, " ");
        if (!text) return;

        const now = Date.now();
        if (text === lastTextRef.current && now - lastTsRef.current < DUP_COOLDOWN_MS) return;

        lastTextRef.current = text;
        lastTsRef.current = now;

        beepScan();
        vibrate();

        navigatingRef.current = true;
        stop();

        // QR con URL (etichette vecchie)
        if (text.startsWith("http://") || text.startsWith("https://")) {
          window.location.href = text;
          return;
        }

        // prefisso CB:
        if (text.toUpperCase().startsWith("CB:")) {
          text = text.slice(3).trim();
        }

        const codice = text.trim().replace(/\s+/g, " ");
        if (!codice) {
          navigatingRef.current = false;
          start();
          return;
        }

        const p = new URLSearchParams();
        p.set("codice", codice);
        p.set("from", scannerSelfFrom);

        // ✅ Magazzino persistito: così in prodotto NON torna su Treviolo a caso
        const savedMagazzinoId = getSavedMagazzinoId();
        if (savedMagazzinoId) {
          p.set("magazzinoId", savedMagazzinoId);
        }

        // ✅ CONTEXT ORDINE: fondamentale per non toccare inventario
        if (hasOrderContext) {
          p.set("mode", "ordine");
          p.set("ordineId", ordineIdClean);
        }

        window.location.href = `/prodotto?${p.toString()}`;
      });

      controlsRef.current = controls;
    } catch (e: any) {
      setScanning(false);
      const msg =
        e?.message ??
        "Errore fotocamera. Apri da HTTPS e concedi i permessi alla fotocamera (Safari/Chrome).";
      setError(msg);
    }
  }

  const subtitle = hasOrderContext
    ? "Modalità ordine: scansiona → inserisci quantità → aggiungi riga → torni qui."
    : "Modalità palmare: lo scanner si avvia da solo. Scansiona → aggiorna quantità → ritorni qui e scansioni il prossimo.";

  return (
    <main style={{ maxWidth: 800, margin: "24px auto", padding: "0 16px", color: "#0f172a" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <Link href={backTo} style={{ fontWeight: 900, color: BRAND_RED, textDecoration: "none" }}>
          ← Indietro
        </Link>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {!scanning ? (
            <button
              onClick={start}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "none",
                background: BRAND_RED,
                color: "white",
                fontWeight: 950,
                cursor: "pointer",
              }}
            >
              Avvia scanner
            </button>
          ) : (
            <button
              onClick={stop}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid #ddd",
                background: "white",
                color: "#0f172a",
                fontWeight: 950,
                cursor: "pointer",
              }}
            >
              Ferma
            </button>
          )}
        </div>
      </div>

      <h1 style={{ marginTop: 12, marginBottom: 6, fontSize: 28, fontWeight: 950 }}>Scanner QR</h1>
      <div style={{ opacity: 0.8 }}>{subtitle}</div>

      <div
        style={{
          marginTop: 12,
          borderRadius: 18,
          border: "1px solid #e6e6e6",
          overflow: "hidden",
          background: "#000",
          position: "relative",
          boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
        }}
      >
        <video ref={videoRef} style={{ width: "100%", height: "auto", display: "block" }} muted playsInline />

        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "grid", placeItems: "center" }}>
          <div
            style={{
              width: "70%",
              maxWidth: 360,
              aspectRatio: "1 / 1",
              borderRadius: 18,
              border: "2px solid rgba(255,255,255,0.85)",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.25)",
            }}
          />
        </div>
      </div>

      {error && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            background: "#ffecec",
            color: "#8a1f1f",
            fontWeight: 800,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginTop: 10, opacity: 0.7, fontSize: 13 }}>
        Tip: se la fotocamera non parte, assicurati di aprire la web app da <b>HTTPS</b> e concedere i permessi.
      </div>
    </main>
  );
}