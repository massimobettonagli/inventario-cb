"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Magazzino = { id: string; nome: string };

type UploadRow = {
  id: string;
  fileName: string;
  magazzinoNome: string | null;
  createdAt: string; // ISO
  rows?: number | null;
  createdProducts?: number | null;
  updatedProducts?: number | null;
  upsertedGiacenze?: number | null;
};

const BRAND_RED = "#C73A3A";

export default function CaricamentiEsportazioniPage() {
  const [magazzini, setMagazzini] = useState<Magazzino[]>([]);
  const [magazzinoId, setMagazzinoId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // storico caricamenti
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [uploadsErr, setUploadsErr] = useState<string | null>(null);

  // carico magazzini
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/magazzini", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        const list = (data.magazzini ?? []) as Magazzino[];
        setMagazzini(list);

        const treviolo = list.find((m) => m.nome === "Treviolo");
        setMagazzinoId(treviolo?.id ?? list?.[0]?.id ?? "");
      } catch {
        setMsg("⛔ Errore caricamento magazzini.");
      }
    })();
  }, []);

  const magazzinoNome = useMemo(() => {
    const m = magazzini.find((x) => x.id === magazzinoId);
    return m?.nome ?? "";
  }, [magazzini, magazzinoId]);

  async function loadUploads() {
  setUploadsLoading(true);
  setUploadsErr(null);
  try {
    const params = new URLSearchParams();
    if (magazzinoId) params.set("magazzinoId", magazzinoId);
    params.set("t", String(Date.now()));

    const res = await fetch(`/api/import/history?${params.toString()}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Errore caricamento storico");

    setUploads((data.items ?? []) as UploadRow[]);
  } catch (e: any) {
    setUploadsErr(e?.message ?? "Errore");
    setUploads([]);
  } finally {
    setUploadsLoading(false);
  }
}

  useEffect(() => {
  if (!magazzinoId) return;
  loadUploads();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [magazzinoId]);

  async function doImport() {
    if (!file) return setMsg("⛔ Seleziona un file XLSX o CSV.");
    if (!magazzinoId) return setMsg("⛔ Seleziona un magazzino.");

    setLoading(true);
    setMsg(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("magazzinoId", magazzinoId);

      const res = await fetch("/api/import", { method: "POST", body: form });

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }

      if (!res.ok) {
        const fallback = typeof data?.error === "string" ? data.error : "Errore import";
        throw new Error(fallback);
      }

      setMsg(
        `✅ Import completato (${data.magazzino}).\n` +
          `Righe: ${data.rows}\n` +
          `Prodotti nuovi: ${data.createdProducts}\n` +
          `Aggiornati: ${data.updatedProducts}\n` +
          `Giacenze aggiornate: ${data.upsertedGiacenze}`
      );

      // ✅ refresh automatico tabella dopo import
      setFile(null);
      await loadUploads();
    } catch (e: any) {
      setMsg(`⛔ ${e?.message ?? "Errore"}`);
    } finally {
      setLoading(false);
    }
  }

  function exportFile(format: "xlsx" | "csv") {
    if (!magazzinoId) return setMsg("⛔ Seleziona un magazzino.");
    setMsg(null);
    window.location.href = `/api/export?magazzinoId=${encodeURIComponent(magazzinoId)}&format=${format}`;
  }

  function fmtDateTime(iso: string) {
    try {
      return new Date(iso).toLocaleString("it-IT");
    } catch {
      return iso;
    }
  }

  return (
    <main style={{ maxWidth: 980, margin: "24px auto", padding: "0 16px", color: "#0f172a" }}>
      {/* BACK */}
      <div style={{ marginBottom: 12 }}>
        <Link href="/" style={{ fontWeight: 950, textDecoration: "none", color: BRAND_RED }}>
          ← Dashboard
        </Link>
      </div>

      <header
        style={{
          borderRadius: 18,
          border: "1px solid #e6e6e6",
          background: "linear-gradient(180deg, #ffffff, #fbfbfb)",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
          padding: 18,
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 340px" }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 950 }}>Caricamenti / Esportazioni</h1>
            <p style={{ margin: "8px 0 0", opacity: 0.8, lineHeight: 1.4 }}>
              Importa file per magazzino, esporta in XLSX/CSV e consulta lo storico dei caricamenti.
            </p>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              borderRadius: 999,
              background: "rgba(199,58,58,0.10)",
              color: BRAND_RED,
              fontWeight: 900,
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            ● {magazzinoNome || "Seleziona magazzino"}
          </div>
        </div>
      </header>

      {/* IMPORT / EXPORT */}
      <section
        style={{
          marginTop: 16,
          borderRadius: 18,
          border: "1px solid #e6e6e6",
          background: "#fff",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
          padding: 18,
          display: "grid",
          gap: 14,
        }}
      >
        {/* MAGAZZINO */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontWeight: 950, minWidth: 110 }}>Magazzino</label>

          <select
            value={magazzinoId}
            onChange={(e) => setMagazzinoId(e.target.value)}
            style={{
              padding: 10,
              borderRadius: 12,
              border: "1px solid #d4d4d4",
              background: "#fff",
              fontWeight: 850,
              minWidth: 220,
            }}
          >
            {magazzini.length === 0 && <option>Caricamento…</option>}
            {magazzini.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>

        {/* FILE */}
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 950 }}>File (XLSX o CSV)</label>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
              border: "1px solid #d4d4d4",
              borderRadius: 14,
              padding: 12,
              background: "#fff",
            }}
          >
            <input type="file" accept=".xlsx,.csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />

            <div style={{ opacity: 0.75, fontSize: 13 }}>
              {file ? (
                <>
                  Selezionato: <b>{file.name}</b> ({Math.round(file.size / 1024)} KB)
                </>
              ) : (
                "Nessun file selezionato"
              )}
            </div>
          </div>
        </div>

        {/* IMPORT */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={doImport}
            disabled={loading}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "none",
              fontWeight: 950,
              cursor: loading ? "not-allowed" : "pointer",
              background: BRAND_RED,
              color: "white",
              boxShadow: "0 10px 20px rgba(199,58,58,0.20)",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Import in corso..." : "Importa nel magazzino selezionato"}
          </button>

          <button
            onClick={() => setFile(null)}
            disabled={loading}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              fontWeight: 950,
              cursor: loading ? "not-allowed" : "pointer",
              background: "#fff",
              color: "#0f172a",
              opacity: loading ? 0.7 : 1,
            }}
          >
            Rimuovi file
          </button>
        </div>

        {/* EXPORT */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => exportFile("xlsx")}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: `1px solid ${BRAND_RED}`,
              fontWeight: 950,
              cursor: "pointer",
              background: "#fff",
              color: BRAND_RED,
            }}
          >
            Export XLSX
          </button>

          <button
            onClick={() => exportFile("csv")}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              fontWeight: 950,
              cursor: "pointer",
              background: "#fff",
              color: "#0f172a",
            }}
          >
            Export CSV
          </button>
        </div>

        {/* MESSAGE */}
        {msg && (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: msg.startsWith("✅") ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
              border: `1px solid ${msg.startsWith("✅") ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
              whiteSpace: "pre-wrap",
              fontWeight: 850,
              lineHeight: 1.4,
            }}
          >
            {msg}
          </div>
        )}
      </section>

      {/* STORICO CARICAMENTI */}
      <section style={{ marginTop: 16 }}>
        <div
          style={{
            borderRadius: 18,
            border: "1px solid #e6e6e6",
            background: "#fff",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
              borderBottom: "1px solid #eef2f7",
              background: "#f8fafc",
            }}
          >
            <div style={{ fontWeight: 950, fontSize: 16 }}>Storico file caricati</div>
            <button
              onClick={loadUploads}
              disabled={uploadsLoading}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                background: "white",
                fontWeight: 950,
                cursor: uploadsLoading ? "not-allowed" : "pointer",
                opacity: uploadsLoading ? 0.7 : 1,
              }}
            >
              {uploadsLoading ? "Ricarico…" : "Ricarica"}
            </button>
          </div>

          {uploadsErr ? (
            <div style={{ padding: 16, color: "crimson", fontWeight: 900 }}>{uploadsErr}</div>
          ) : uploads.length === 0 ? (
            <div style={{ padding: 16, opacity: 0.8 }}>
              {uploadsLoading ? "Caricamento…" : "Nessun file caricato ancora."}
            </div>
          ) : (
            <div style={{ width: "100%", overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th style={{ padding: 14, fontSize: 13, opacity: 0.85 }}>Data</th>
                    <th style={{ padding: 14, fontSize: 13, opacity: 0.85 }}>Magazzino</th>
                    <th style={{ padding: 14, fontSize: 13, opacity: 0.85 }}>File</th>
                    <th style={{ padding: 14, fontSize: 13, opacity: 0.85 }}>Righe</th>
                    <th style={{ padding: 14, fontSize: 13, opacity: 0.85 }}>Nuovi</th>
                    <th style={{ padding: 14, fontSize: 13, opacity: 0.85 }}>Aggiornati</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((u) => (
                    <tr key={u.id} style={{ borderTop: "1px solid #eef2f7" }}>
                      <td style={{ padding: 14, fontWeight: 900 }}>{fmtDateTime(u.createdAt)}</td>
                      <td style={{ padding: 14, fontWeight: 900 }}>{u.magazzinoNome ?? "—"}</td>
                      <td style={{ padding: 14, fontFamily: "monospace", fontWeight: 800 }}>{u.fileName}</td>
                      <td style={{ padding: 14, fontWeight: 900 }}>{u.rows ?? "—"}</td>
                      <td style={{ padding: 14, fontWeight: 900 }}>{u.createdProducts ?? "—"}</td>
                      <td style={{ padding: 14, fontWeight: 900 }}>{u.updatedProducts ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <footer style={{ marginTop: 14, opacity: 0.65, fontSize: 13 }}>
        Suggerimento: importa prima Treviolo, poi Treviglio.
      </footer>
    </main>
  );
}