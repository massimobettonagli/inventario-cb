"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Magazzino = { id: string; nome: string };

type ProdottoRow = {
  codice: string;
  descrizione: string;
  qtyAttuale: number;
  thumbUrl: string | null;
};

const BRAND_RED = "#C73A3A";
const STORAGE_KEY = "magazzinoId";

function BackToDashboard() {
  return (
    <Link href="/" style={{ fontWeight: 950, color: BRAND_RED, textDecoration: "none" }}>
      ← Dashboard
    </Link>
  );
}

export default function ListaProdottiPage() {
  const [magazzini, setMagazzini] = useState<Magazzino[]>([]);
  const [magazzinoId, setMagazzinoId] = useState<string>("");
  const [q, setQ] = useState("");

  const [items, setItems] = useState<ProdottoRow[]>([]);
  const [totale, setTotale] = useState(0);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const canSearch = useMemo(() => Boolean(magazzinoId), [magazzinoId]);

  const magazzinoNome = useMemo(() => {
    const m = magazzini.find((x) => x.id === magazzinoId);
    return m?.nome ?? "";
  }, [magazzini, magazzinoId]);

  // ✅ ritorno alla lista mantenendo contesto (magazzino + ricerca)
  const backToList = useMemo(() => {
    const p = new URLSearchParams();
    if (magazzinoId) p.set("magazzinoId", magazzinoId);
    if (q.trim()) p.set("q", q.trim());
    const qs = p.toString();
    return qs ? `/lista?${qs}` : "/lista";
  }, [magazzinoId, q]);

  // carico magazzini + ripristino selezione
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch("/api/magazzini", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        const list: Magazzino[] = data.magazzini ?? [];
        if (!alive) return;

        setMagazzini(list);

        const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        if (saved && list.some((m) => m.id === saved)) {
          setMagazzinoId(saved);
          return;
        }

        if (list.length > 0) {
          const treviolo = list.find((m) => m.nome === "Treviolo");
          setMagazzinoId(treviolo?.id ?? list[0].id);
        }
      } catch {
        if (!alive) return;
        setError("Errore caricamento magazzini");
      }
    })();

    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, []);

  async function fetchPage(targetPage: number, reset: boolean) {
    if (!magazzinoId) return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("magazzinoId", magazzinoId);
      params.set("page", String(targetPage));
      if (q.trim()) params.set("q", q.trim());

      const res = await fetch(`/api/prodotti?${params.toString()}`, {
        signal: ac.signal,
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Errore caricamento prodotti");

      setTotale(Number(data.totale ?? 0));

      setItems((prev) => {
        const next: ProdottoRow[] = data.items ?? [];
        if (reset) return next;

        const seen = new Set(prev.map((x) => x.codice));
        const merged = [...prev];
        for (const it of next) {
          if (!seen.has(it.codice)) merged.push(it);
        }
        return merged;
      });
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e?.message ?? "Errore");
    } finally {
      setLoading(false);
    }
  }

  function doSearchReset() {
    if (!magazzinoId) return;
    setPage(1);
    setItems([]);
    setTotale(0);
    fetchPage(1, true);
  }

  // cambio magazzino: reset + pagina 1
  useEffect(() => {
    if (!magazzinoId) return;
    doSearchReset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [magazzinoId]);

  // paginazione
  useEffect(() => {
    if (!magazzinoId) return;
    if (page <= 1) return;
    fetchPage(page, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const hasMore = items.length < totale;

  // ZPL downloads
  function downloadZplAllOrFiltered() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    window.location.href = `/api/labels/zpl?${params.toString()}`;
  }

  function downloadZplTest50() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    params.set("limit", "50");
    window.location.href = `/api/labels/zpl?${params.toString()}`;
  }

  const scannerHref = useMemo(() => {
    const p = new URLSearchParams();
    p.set("from", backToList);
    return `/scanner?${p.toString()}`;
  }, [backToList]);

  return (
    <main style={{ maxWidth: 1050, margin: "24px auto", padding: "0 16px", color: "#0f172a" }}>
      {/* BACK */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <BackToDashboard />
      </div>

      {/* TOP BAR */}
      <div
        style={{
          borderRadius: 18,
          border: "1px solid #e6e6e6",
          background: "linear-gradient(180deg, #ffffff, #fbfbfb)",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
          padding: 18,
        }}
      >
        <header style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ minWidth: 260 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 28, fontWeight: 950, margin: 0 }}>Lista prodotti</h1>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "rgba(199,58,58,0.10)",
                  color: BRAND_RED,
                  fontWeight: 900,
                  fontSize: 12,
                  whiteSpace: "nowrap",
                }}
              >
                ● {magazzinoNome || "Seleziona magazzino"}
              </span>
            </div>

            <div style={{ opacity: 0.78, marginTop: 6, fontSize: 14, lineHeight: 1.4 }}>
              Cerca per <b>codice</b> o <b>descrizione</b>. Apri il prodotto per aggiornare le quantità.
            </div>
          </div>

          {/* ACTIONS */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Link
              href={scannerHref}
              style={{
                textDecoration: "none",
                padding: "10px 14px",
                borderRadius: 12,
                fontWeight: 950,
                border: "none",
                color: "white",
                background: BRAND_RED,
                boxShadow: "0 10px 20px rgba(199,58,58,0.20)",
                whiteSpace: "nowrap",
              }}
            >
              Scanner QR
            </Link>

            <button
              onClick={downloadZplAllOrFiltered}
              disabled={loading}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                fontWeight: 950,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                background: BRAND_RED,
                color: "white",
                boxShadow: "0 10px 20px rgba(199,58,58,0.20)",
                whiteSpace: "nowrap",
                opacity: loading ? 0.75 : 1,
              }}
              title={q.trim() ? "Scarica etichette ZPL filtrate" : "Scarica tutte le etichette ZPL"}
            >
              {q.trim() ? "ZPL (filtrati)" : "ZPL (tutti)"}
            </button>

            <button
              onClick={downloadZplTest50}
              disabled={loading}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                fontWeight: 950,
                border: `1px solid ${BRAND_RED}`,
                cursor: loading ? "not-allowed" : "pointer",
                background: "white",
                color: BRAND_RED,
                whiteSpace: "nowrap",
                opacity: loading ? 0.75 : 1,
              }}
              title="Scarica solo 50 etichette (test)"
            >
              ZPL (test 50)
            </button>

            <select
              value={magazzinoId}
              onChange={(e) => {
                const next = e.target.value;
                setMagazzinoId(next);
                try {
                  localStorage.setItem(STORAGE_KEY, next);
                } catch {}
              }}
              style={{
                padding: 10,
                borderRadius: 12,
                border: "1px solid #d4d4d4",
                background: "#fff",
                fontWeight: 800,
              }}
            >
              {magazzini.length === 0 && <option>Caricamento magazzini…</option>}
              {magazzini.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                border: "1px solid #d4d4d4",
                borderRadius: 12,
                overflow: "hidden",
                background: "#fff",
              }}
            >
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cerca codice o descrizione…"
                style={{
                  padding: "10px 12px",
                  border: "none",
                  outline: "none",
                  minWidth: 250,
                  fontSize: 14,
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") doSearchReset();
                }}
              />
              <button
                onClick={() => {
                  setQ("");
                  doSearchReset();
                }}
                title="Svuota"
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: "10px 10px",
                  fontWeight: 900,
                  opacity: 0.6,
                }}
              >
                ✕
              </button>
            </div>

            <button
              onClick={doSearchReset}
              disabled={!canSearch || loading}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "none",
                fontWeight: 950,
                cursor: !canSearch || loading ? "not-allowed" : "pointer",
                background: BRAND_RED,
                color: "white",
                boxShadow: "0 10px 20px rgba(199,58,58,0.20)",
                opacity: !canSearch || loading ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {loading ? "Carico…" : "Cerca"}
            </button>
          </div>
        </header>

        {error && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 12,
              background: "#ffecec",
              color: "#8a1f1f",
              fontWeight: 800,
              border: "1px solid #ffd0d0",
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* RESULTS */}
      <section style={{ marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ opacity: 0.8 }}>
            Mostrati:{" "}
            <span style={{ display: "inline-block", marginLeft: 6, padding: "4px 10px", borderRadius: 999, background: "#f1f5f9", fontWeight: 900 }}>
              {items.length}
            </span>
            <span style={{ marginLeft: 8, opacity: 0.7 }}>
              su <b>{totale}</b>
            </span>
          </div>

          <div style={{ opacity: 0.65, fontSize: 13 }}>
            Tip: su mobile puoi scorrere la tabella <b>↔</b>
          </div>
        </div>

        <div
          style={{
            marginTop: 10,
            border: "1px solid #e6e6e6",
            borderRadius: 18,
            overflow: "hidden",
            background: "#fff",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
          }}
        >
          {items.length === 0 ? (
            <div style={{ padding: 18, opacity: 0.8 }}>
              Nessun prodotto mostrato.
              <div style={{ marginTop: 6 }}>
                Vai su{" "}
                <Link href="/caricamenti-esportazioni" style={{ fontWeight: 900, color: BRAND_RED }}>
                  Caricamenti/Esportazioni
                </Link>{" "}
                per importare i file.
              </div>
            </div>
          ) : (
            <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}>
              <table style={{ width: "100%", minWidth: 820, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                    <th style={{ padding: 14, width: 170, fontSize: 13, letterSpacing: 0.2, opacity: 0.85 }}>Codice</th>
                    <th style={{ padding: 14, fontSize: 13, letterSpacing: 0.2, opacity: 0.85 }}>Descrizione</th>
                    <th style={{ padding: 14, width: 140, fontSize: 13, letterSpacing: 0.2, opacity: 0.85 }}>Q.tà</th>
                    <th style={{ padding: 14, width: 120 }}></th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((p) => {
                    const href =
                      `/prodotto?codice=${encodeURIComponent(p.codice)}` +
                      `&magazzinoId=${encodeURIComponent(magazzinoId)}` +
                      `&from=${encodeURIComponent(backToList)}`;

                    return (
                      <tr key={p.codice} style={{ borderTop: "1px solid #eef2f7" }}>
                        <td style={{ padding: 14, fontWeight: 950 }}>
                          <Link href={href} style={{ textDecoration: "none", color: "#0f172a" }}>
                            {p.codice}
                          </Link>
                        </td>

                        <td style={{ padding: 14, color: "#334155" }}>{p.descrizione}</td>

                        <td style={{ padding: 14 }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 64,
                              padding: "6px 10px",
                              borderRadius: 999,
                              fontWeight: 950,
                              background: "rgba(199,58,58,0.08)",
                              color: BRAND_RED,
                            }}
                          >
                            {p.qtyAttuale}
                          </span>
                        </td>

                        <td style={{ padding: 14 }}>
                          <Link
                            href={href}
                            style={{
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "9px 12px",
                              borderRadius: 12,
                              border: "1px solid #e2e8f0",
                              fontWeight: 950,
                              color: "#0f172a",
                              background: "#fff",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Apri →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {hasMore && (
          <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={loading}
              style={{
                padding: "12px 18px",
                borderRadius: 12,
                border: `1px solid ${BRAND_RED}`,
                fontWeight: 950,
                cursor: loading ? "not-allowed" : "pointer",
                background: "white",
                color: BRAND_RED,
                boxShadow: "0 10px 20px rgba(199,58,58,0.10)",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Caricamento..." : `Carica altri (${items.length}/${totale})`}
            </button>
          </div>
        )}
      </section>

      <footer style={{ marginTop: 16, opacity: 0.65, fontSize: 13 }}>
        Inventario CB • PWA • Multi-magazzino (Treviolo / Treviglio)
      </footer>
    </main>
  );
}