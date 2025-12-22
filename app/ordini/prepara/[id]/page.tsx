"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";

const BRAND_RED = "#C73A3A";
const DUP_COOLDOWN_MS = 1200;
const GLOBAL_COOLDOWN_MS = 900;

type Riga = {
  id: string;
  codiceProdotto: string;
  descrizioneSnap: string | null;
  qty: number;
  qtyPrepared: number;
  rowStatus: "NOT_STARTED" | "PARTIAL" | "DONE";
};

type Ordine = {
  id: string;
  codice: string;
  stato: "DRAFT" | "IN_LAVORAZIONE" | "INVIATA" | "CHIUSA";
  daMagazzino: { nome: string };
  aMagazzino: { nome: string };
  righe: Riga[];
  stats: {
    preparedCount: number;
    partialCount: number;
    notStartedCount: number;
    total: number;
    isFullyPrepared: boolean;
  };
};

export default function OrdinePreparaPage() {
  const params = useParams<{ id: string }>();
  const ordineId = typeof params?.id === "string" ? params.id : "";

  const [ordine, setOrdine] = useState<Ordine | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const [manualCode, setManualCode] = useState("");
  const [manualQty, setManualQty] = useState<number>(1);

  const [hint, setHint] = useState<string>("");

  const [qtyModalOpen, setQtyModalOpen] = useState(false);
  const [qtyCode, setQtyCode] = useState<string>("");
  const [qtyValue, setQtyValue] = useState<number>(1);
  const [savingQty, setSavingQty] = useState(false);

  const [qtyRequested, setQtyRequested] = useState<number | null>(null);
  const [qtyAlreadyPrepared, setQtyAlreadyPrepared] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // ✅ reader tipizzato correttamente + controller stop() tipizzato
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const lastTextRef = useRef<string>("");
  const lastTsRef = useRef<number>(0);

  const busyRef = useRef(false);
  const scanSessionRef = useRef(0);
  const cooldownUntilRef = useRef(0);

  function flashHint(msg: string) {
    setHint(msg);
    window.setTimeout(() => setHint(""), 1400);
  }

  async function load() {
    if (!ordineId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/ordini/${encodeURIComponent(ordineId)}/prepare?t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Errore caricamento");
      setOrdine(data.ordine as Ordine);
    } catch (e: any) {
      setErr(e?.message ?? "Errore");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordineId]);

  useEffect(() => {
    // cleanup camera quando esci pagina
    return () => {
      try {
        controlsRef.current?.stop();
      } catch {}
      controlsRef.current = null;
    };
  }, []);

  const canPrepare = useMemo(
    () => ordine?.stato === "INVIATA" || ordine?.stato === "IN_LAVORAZIONE",
    [ordine?.stato]
  );

  const canClose = useMemo(
    () =>
      Boolean(ordine?.stats?.isFullyPrepared) &&
      (ordine?.stato === "INVIATA" || ordine?.stato === "IN_LAVORAZIONE"),
    [ordine]
  );

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

  function normalizeScanned(text: string) {
    let t = (text ?? "").replace(/\r?\n|\r/g, " ").trim().replace(/\s+/g, " ");
    if (!t) return "";
    if (t.startsWith("http://") || t.startsWith("https://")) return "";
    if (t.toUpperCase().startsWith("CB:")) t = t.slice(3).trim();
    return t;
  }

  function stop() {
    scanSessionRef.current += 1;
    try {
      controlsRef.current?.stop(); // ✅ tipizzato
    } catch {}
    controlsRef.current = null;
    setScanning(false);
  }

  function resetQtyModalState() {
    setQtyModalOpen(false);
    setQtyCode("");
    setQtyValue(1);
    setQtyRequested(null);
    setQtyAlreadyPrepared(null);
  }

  const modalMax = useMemo(() => {
    if (qtyRequested === null || qtyAlreadyPrepared === null) return null;
    return Math.max(0, qtyRequested - qtyAlreadyPrepared);
  }, [qtyRequested, qtyAlreadyPrepared]);

  function applyOptimisticPrepared(code: string, add: number) {
    const qAdd = Math.max(1, Math.round(add || 1));
    setOrdine((prev) => {
      if (!prev) return prev;

      let changed = false;

      const righe = prev.righe.map((r) => {
        if (r.codiceProdotto !== code) return r;
        changed = true;

        const nextPrepared = Math.min(r.qty, (r.qtyPrepared ?? 0) + qAdd);
        const rowStatus: Riga["rowStatus"] =
          nextPrepared >= r.qty ? "DONE" : nextPrepared > 0 ? "PARTIAL" : "NOT_STARTED";

        return { ...r, qtyPrepared: nextPrepared, rowStatus };
      });

      if (!changed) return prev;

      const preparedCount = righe.filter((r) => (r.qtyPrepared ?? 0) >= r.qty).length;
      const partialCount = righe.filter((r) => (r.qtyPrepared ?? 0) > 0 && (r.qtyPrepared ?? 0) < r.qty).length;
      const notStartedCount = righe.filter((r) => (r.qtyPrepared ?? 0) <= 0).length;

      return {
        ...prev,
        righe,
        stats: {
          preparedCount,
          partialCount,
          notStartedCount,
          total: righe.length,
          isFullyPrepared: righe.length > 0 && preparedCount === righe.length,
        },
      };
    });
  }

  async function start() {
    setScanError(null);
    setScanning(true);

    const mySession = ++scanSessionRef.current;

    try {
      if (!canPrepare) throw new Error("Ordine non preparabile in questo stato");

      const video = videoRef.current;
      if (!video) throw new Error("Video non disponibile");

      if (!readerRef.current) readerRef.current = new BrowserQRCodeReader();

      lastTextRef.current = "";
      lastTsRef.current = 0;
      cooldownUntilRef.current = 0;

      // se già attivo, chiudo prima
      try {
        controlsRef.current?.stop();
      } catch {}
      controlsRef.current = null;

      // ✅ decodeFromVideoDevice ritorna controls con stop()
      controlsRef.current = await readerRef.current.decodeFromVideoDevice(undefined, video, async (result) => {
        if (scanSessionRef.current !== mySession) return;
        if (!result) return;

        const now = Date.now();
        if (now < cooldownUntilRef.current) return;
        if (busyRef.current) return;
        if (qtyModalOpen) return;

        const code = normalizeScanned(result.getText());
        if (!code) return;

        if (code === lastTextRef.current && now - lastTsRef.current < DUP_COOLDOWN_MS) return;

        busyRef.current = true;
        cooldownUntilRef.current = now + GLOBAL_COOLDOWN_MS;

        lastTextRef.current = code;
        lastTsRef.current = now;

        beepScan();
        stop();

        try {
          const found = ordine?.righe?.find((r) => r.codiceProdotto === code);

          if (!found) {
            setQtyRequested(null);
            setQtyAlreadyPrepared(null);
            setQtyCode(code);
            setQtyValue(1);
            setQtyModalOpen(true);
            flashHint("Codice non presente nell’ordine");
            return;
          }

          const req = found.qty ?? 0;
          const prep = found.qtyPrepared ?? 0;
          const rem = Math.max(0, req - prep);

          setQtyRequested(req);
          setQtyAlreadyPrepared(prep);
          setQtyCode(code);

          if (rem === 0) {
            flashHint("Riga già completa ✅");
            start();
            return;
          }

          if (rem === 1) {
            try {
              applyOptimisticPrepared(code, 1);
              await addPrepared(code, 1);
              load();
              flashHint("+1 aggiunto ✅");
            } catch (e: any) {
              await load();
              alert(e?.message ?? "Errore");
            } finally {
              start();
            }
            return;
          }

          setQtyValue(1);
          setQtyModalOpen(true);
        } finally {
          busyRef.current = false;
        }
      });
    } catch (e: any) {
      setScanning(false);
      setScanError(e?.message ?? "Errore fotocamera / permessi");
      try {
        controlsRef.current?.stop();
      } catch {}
      controlsRef.current = null;
    }
  }

  async function addPrepared(codice: string, qty: number) {
    const q = Math.max(1, Math.round(qty || 1));
    const c = String(codice ?? "").trim();
    if (!c) return;

    const res = await fetch("/api/ordini/righe/prepare", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ordineId, codice: c, qtyPreparedAdd: q }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Errore aggiornamento preparazione");
  }

  async function confirmQty() {
    if (!qtyCode.trim()) return;
    if (!canPrepare) {
      alert("Ordine non preparabile");
      return;
    }

    if (qtyRequested === null || qtyAlreadyPrepared === null) {
      alert("Codice non presente nell’ordine");
      return;
    }

    const max = Math.max(0, qtyRequested - qtyAlreadyPrepared);
    if (max <= 0) {
      resetQtyModalState();
      flashHint("Riga già completa ✅");
      start();
      return;
    }

    const q = Math.max(1, Math.min(max, Math.round(qtyValue || 1)));

    setSavingQty(true);
    try {
      applyOptimisticPrepared(qtyCode.trim(), q);
      await addPrepared(qtyCode.trim(), q);
      load();
      resetQtyModalState();
      flashHint(`+${q} salvato ✅`);
      start();
    } catch (e: any) {
      await load();
      alert(e?.message ?? "Errore");
    } finally {
      setSavingQty(false);
    }
  }

  async function addManual() {
    if (!manualCode.trim()) return;
    try {
      const q = Math.max(1, Math.round(manualQty || 1));
      const c = manualCode.trim();

      applyOptimisticPrepared(c, q);
      await addPrepared(c, q);

      setManualCode("");
      setManualQty(1);

      load();
      flashHint("Aggiunto ✅");
    } catch (e: any) {
      await load();
      alert(e?.message ?? "Errore");
    }
  }

  async function closeOrder() {
    if (!ordineId) return;
    if (!confirm("Confermi chiusura ordine? Dopo non potrai più preparare.")) return;

    try {
      const res = await fetch("/api/ordini/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordineId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Errore chiusura ordine");
      alert("Ordine chiuso ✅");
      await load();
      stop();
    } catch (e: any) {
      alert(e?.message ?? "Errore");
    }
  }

  return (
    <main style={{ maxWidth: 1050, margin: "24px auto", padding: "0 16px", color: "#0f172a" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <Link href={`/ordini/prepara`} style={{ fontWeight: 950, color: BRAND_RED, textDecoration: "none" }}>
          ← Preparazione ordini
        </Link>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={load}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              fontWeight: 950,
              border: "1px solid #e2e8f0",
              cursor: "pointer",
              background: "white",
            }}
          >
            {loading ? "Ricarico…" : "Ricarica"}
          </button>

          <button
            onClick={closeOrder}
            disabled={!canClose}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              fontWeight: 950,
              border: "none",
              cursor: !canClose ? "not-allowed" : "pointer",
              background: "#0f172a",
              color: "white",
              opacity: !canClose ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
            title={!canClose ? "Completa tutte le righe per poter chiudere" : "Chiudi ordine"}
          >
            Chiudi ordine
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, borderRadius: 18, border: "1px solid #e6e6e6", background: "white", padding: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 950 }}>{ordine?.codice ?? "Preparazione ordine"}</h1>

        {ordine && (
          <div style={{ marginTop: 6, opacity: 0.85, fontWeight: 800 }}>
            {ordine.daMagazzino.nome} → {ordine.aMagazzino.nome} • Stato: <b>{ordine.stato}</b>
            <div style={{ marginTop: 6, opacity: 0.75, fontWeight: 700 }}>
              Fatto: {ordine.stats.preparedCount} • Parziali: {ordine.stats.partialCount} • Da fare: {ordine.stats.notStartedCount}
            </div>
          </div>
        )}

        {hint ? (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 12,
              background: "rgba(199,58,58,0.08)",
              border: "1px solid rgba(199,58,58,0.18)",
              color: "#7a1f1f",
              fontWeight: 950,
            }}
          >
            {hint}
          </div>
        ) : null}

        {err && <div style={{ marginTop: 10, color: "crimson", fontWeight: 900 }}>{err}</div>}

        {!canPrepare && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 12,
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              fontWeight: 900,
            }}
          >
            Questo ordine non è preparabile in questo stato.
          </div>
        )}
      </div>

      {/* Scanner */}
      <section style={{ marginTop: 14 }}>
        <div style={{ borderRadius: 18, border: "1px solid #e6e6e6", overflow: "hidden", background: "#000" }}>
          <video ref={videoRef} style={{ width: "100%", height: "auto", display: "block" }} muted playsInline />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          {!scanning ? (
            <button
              onClick={start}
              disabled={!canPrepare}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "none",
                background: BRAND_RED,
                color: "white",
                fontWeight: 950,
                cursor: !canPrepare ? "not-allowed" : "pointer",
                opacity: !canPrepare ? 0.6 : 1,
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
                fontWeight: 950,
                cursor: "pointer",
              }}
            >
              Ferma
            </button>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Codice (manuale)"
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #d4d4d4", fontWeight: 900, minWidth: 220 }}
            />
            <input
              type="number"
              value={manualQty}
              onChange={(e) => setManualQty(Number(e.target.value))}
              style={{ width: 100, padding: "10px 12px", borderRadius: 12, border: "1px solid #d4d4d4", fontWeight: 900 }}
            />
            <button
              onClick={addManual}
              disabled={!canPrepare}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                background: "white",
                fontWeight: 950,
                cursor: !canPrepare ? "not-allowed" : "pointer",
                opacity: !canPrepare ? 0.6 : 1,
              }}
            >
              Aggiungi
            </button>
          </div>
        </div>

        {scanError && <div style={{ marginTop: 10, color: "crimson", fontWeight: 900 }}>{scanError}</div>}
      </section>

      {/* Tabella righe */}
      <section style={{ marginTop: 16 }}>
        <div style={{ border: "1px solid #e6e6e6", borderRadius: 18, overflow: "hidden", background: "#fff" }}>
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                  <th style={{ padding: 14, width: 220, fontSize: 13, opacity: 0.85 }}>Codice</th>
                  <th style={{ padding: 14, fontSize: 13, opacity: 0.85 }}>Descrizione</th>
                  <th style={{ padding: 14, width: 140, fontSize: 13, opacity: 0.85 }}>Richiesta</th>
                  <th style={{ padding: 14, width: 160, fontSize: 13, opacity: 0.85 }}>Preparata</th>
                  <th style={{ padding: 14, width: 160, fontSize: 13, opacity: 0.85 }}>Stato</th>
                </tr>
              </thead>
              <tbody>
                {(ordine?.righe ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 16, opacity: 0.75 }}>
                      {loading ? "Caricamento…" : "Nessuna riga."}
                    </td>
                  </tr>
                ) : (
                  ordine!.righe.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid #eef2f7" }}>
                      <td style={{ padding: 14, fontWeight: 950 }}>{r.codiceProdotto}</td>
                      <td style={{ padding: 14, opacity: 0.9 }}>{r.descrizioneSnap ?? "—"}</td>
                      <td style={{ padding: 14, fontWeight: 900 }}>{r.qty}</td>
                      <td style={{ padding: 14, fontWeight: 900 }}>
                        {r.qtyPrepared} / {r.qty}
                      </td>
                      <td style={{ padding: 14, fontWeight: 950 }}>
                        {r.rowStatus === "DONE" ? "✅ Completa" : r.rowStatus === "PARTIAL" ? "🟠 Parziale" : "⚪ Da fare"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <footer style={{ marginTop: 16, opacity: 0.65, fontSize: 13 }}>Inventario CB • Preparazione ordine</footer>

      {/* MODAL QTY */}
      {qtyModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => {
            if (savingQty) return;
            resetQtyModalState();
            start();
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              borderRadius: 18,
              background: "white",
              border: "1px solid #e6e6e6",
              boxShadow: "0 20px 50px rgba(15, 23, 42, 0.25)",
              padding: 18,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 950, color: "#0f172a" }}>Quantità preparata</div>
            <div style={{ marginTop: 6, opacity: 0.75, fontWeight: 800 }}>
              Codice: <span style={{ fontFamily: "monospace" }}>{qtyCode}</span>
            </div>

            {qtyRequested !== null && qtyAlreadyPrepared !== null ? (
              <div style={{ marginTop: 10, opacity: 0.9, fontWeight: 950, lineHeight: 1.35 }}>
                Richiesta: <span style={{ color: BRAND_RED }}>{qtyRequested}</span> • Già preparata:{" "}
                <span style={{ color: "#0f172a" }}>{qtyAlreadyPrepared}</span> • Residuo:{" "}
                <span style={{ color: "#0f172a" }}>{modalMax ?? 0}</span>
              </div>
            ) : (
              <div style={{ marginTop: 10, opacity: 0.7, fontWeight: 800, fontSize: 13 }}>
                Riga non trovata nell’ordine (codice non presente). Conferma disabilitata.
              </div>
            )}

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
              <button
                onClick={() => setQtyValue((v) => Math.max(1, (v || 1) - 1))}
                disabled={savingQty}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  background: "white",
                  fontWeight: 950,
                  cursor: savingQty ? "not-allowed" : "pointer",
                  opacity: savingQty ? 0.6 : 1,
                }}
              >
                −
              </button>

              <input
                type="number"
                value={qtyValue}
                onChange={(e) => setQtyValue(Number(e.target.value))}
                disabled={savingQty}
                style={{
                  width: 140,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid #d4d4d4",
                  fontWeight: 950,
                }}
              />

              <button
                onClick={() => setQtyValue((v) => Math.max(1, (v || 1) + 1))}
                disabled={savingQty}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  background: "white",
                  fontWeight: 950,
                  cursor: savingQty ? "not-allowed" : "pointer",
                  opacity: savingQty ? 0.6 : 1,
                }}
              >
                +
              </button>
            </div>

            {modalMax !== null && modalMax > 0 ? (
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7, fontWeight: 800 }}>
                Suggerimento: max consigliato <b>{modalMax}</b>
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  if (savingQty) return;
                  resetQtyModalState();
                  start();
                }}
                disabled={savingQty}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  background: "white",
                  fontWeight: 950,
                  cursor: savingQty ? "not-allowed" : "pointer",
                  opacity: savingQty ? 0.6 : 1,
                }}
              >
                Annulla
              </button>

              <button
                onClick={confirmQty}
                disabled={savingQty || qtyRequested === null || qtyAlreadyPrepared === null}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: BRAND_RED,
                  color: "white",
                  fontWeight: 950,
                  cursor: savingQty || qtyRequested === null || qtyAlreadyPrepared === null ? "not-allowed" : "pointer",
                  opacity: savingQty || qtyRequested === null || qtyAlreadyPrepared === null ? 0.55 : 1,
                }}
              >
                {savingQty ? "Salvo…" : "Conferma"}
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7, fontWeight: 700 }}>
              Tip: se residuo = 1 aggiunge automaticamente senza popup. Se residuo = 0 ti avvisa e riparte.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}