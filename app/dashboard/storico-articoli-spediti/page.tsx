"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const BRAND_RED = "#C73A3A";

type ShippedItem = {
  id: string;
  codiceProdotto: string;
  descrizioneSnap: string;
  qtyRichiesta: number;
  qtySpedita: number;
  ordineId: string;
  ordineCodice: string;
  daMagazzino: string;
  aMagazzino: string;
  shippedAt: string | null;
};

function prettyDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("it-IT");
  } catch {
    return String(d);
  }
}

function useDebouncedValue<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function StoricoArticoliSpeditiPage() {
  const [q, setQ] = useState("");
  const qDebounced = useDebouncedValue(q, 350);

  const [items, setItems] = useState<ShippedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const url = `/api/ordini/shipped-items?q=${encodeURIComponent(qDebounced)}&take=300&t=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Errore caricamento storico spediti");
      setItems(data?.items ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Errore");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced]);

  const count = items.length;

  const headerHint = useMemo(() => {
    if (loading) return "Caricamento…";
    if (qDebounced.trim()) return `Risultati per: "${qDebounced.trim()}" • ${count} righe`;
    return `Ultime spedizioni • ${count} righe`;
  }, [loading, qDebounced, count]);

  return (
    <main style={{ maxWidth: 1200, margin: "24px auto", padding: "0 16px", color: "#0f172a" }}>
      {/* TOP BAR */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <Link href="/dashboard" style={{ fontWeight: 950, color: BRAND_RED, textDecoration: "none" }}>
          ← Dashboard
        </Link>

        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            fontWeight: 950,
            border: `1px solid ${BRAND_RED}`,
            cursor: loading ? "not-allowed" : "pointer",
            background: "white",
            color: BRAND_RED,
            opacity: loading ? 0.7 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "Aggiorno…" : "Aggiorna"}
        </button>
      </div>

      {/* HERO */}
      <div
        style={{
          marginTop: 12,
          borderRadius: 18,
          border: "1px solid #e6e6e6",
          background: "linear-gradient(180deg, #ffffff, #fbfbfb)",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
          padding: 16,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 950 }}>Storico articoli spediti</h1>
        <div style={{ marginTop: 6, opacity: 0.8, fontWeight: 700, lineHeight: 1.4 }}>
          Cerca per <b>codice</b> o <b>descrizione</b>. La tabella mostra gli articoli in ordine cronologico di spedizione (più recenti sopra).
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca codice o descrizione…"
            style={{
              flex: "1 1 360px",
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid #d4d4d4",
              fontWeight: 800,
              outline: "none",
            }}
          />
          <div style={{ opacity: 0.75, fontWeight: 800 }}>{headerHint}</div>
        </div>

        {err ? (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#ffecec", color: "#8a1f1f", fontWeight: 900 }}>
            {err}
          </div>
        ) : null}
      </div>

      {/* TABLE */}
      <div
        style={{
          marginTop: 14,
          border: "1px solid #e6e6e6",
          borderRadius: 18,
          background: "#fff",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
          overflow: "hidden",
        }}
      >
        <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}>
          <table style={{ width: "100%", minWidth: 1100, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                <th style={{ padding: 14, width: 180, fontSize: 13, opacity: 0.85 }}>Data spedizione</th>
                <th style={{ padding: 14, width: 160, fontSize: 13, opacity: 0.85 }}>Codice articolo</th>
                <th style={{ padding: 14, fontSize: 13, opacity: 0.85 }}>Descrizione</th>
                <th style={{ padding: 14, width: 120, fontSize: 13, opacity: 0.85 }}>Qty spedita</th>
                <th style={{ padding: 14, width: 150, fontSize: 13, opacity: 0.85 }}>Ordine</th>
                <th style={{ padding: 14, width: 220, fontSize: 13, opacity: 0.85 }}>Trasferimento</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 16, opacity: 0.75 }}>
                    Caricamento…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 16, opacity: 0.75 }}>
                    Nessun articolo spedito trovato.
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.id} style={{ borderTop: "1px solid #eef2f7" }}>
                    <td style={{ padding: 14, fontWeight: 900 }}>{prettyDate(it.shippedAt)}</td>
                    <td style={{ padding: 14, fontWeight: 950 }}>{it.codiceProdotto}</td>
                    <td style={{ padding: 14, opacity: 0.9 }}>{it.descrizioneSnap || "—"}</td>
                    <td style={{ padding: 14, fontWeight: 950 }}>{it.qtySpedita}</td>
                    <td style={{ padding: 14, fontWeight: 900 }}>{it.ordineCodice}</td>
                    <td style={{ padding: 14, opacity: 0.85, fontWeight: 800 }}>
                      {it.daMagazzino} → {it.aMagazzino}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ padding: 14, borderTop: "1px solid #eef2f7", opacity: 0.7, fontSize: 13, fontWeight: 700 }}>
          Tip: per vedere “le ultime date in cui è stato spedito” un articolo, cerca il suo codice: appariranno le spedizioni più recenti in cima.
        </div>
      </div>
    </main>
  );
}