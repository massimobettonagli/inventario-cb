"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Magazzino = { id: string; nome: string };

type UltimoMovimento = {
  id: string;
  codice: string;
  magazzinoId: string;
  qtyPrima: number | null;
  qtyDopo: number | null;
  delta: number | null;
  createdAt: string; // ISO
  magazzino?: { nome: string } | null;
};

type StatsPeriod = "day" | "week" | "month" | "year";

type StatsResponse = {
  period: StatsPeriod;
  from: string; // ISO
  to: string; // ISO
  movimenti: number;
  prodottiModificati: number;
  ultimiMovimenti: UltimoMovimento[];
};

const BRAND_RED = "#C73A3A";
const STORAGE_KEY = "magazzinoId";

const PERIODS: Array<{ key: StatsPeriod; label: string }> = [
  { key: "day", label: "Ultimo giorno" },
  { key: "week", label: "Ultima settimana" },
  { key: "month", label: "Ultimo mese" },
  { key: "year", label: "Ultimo anno" },
];

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("it-IT", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function StatistichePage() {
  const [magazzini, setMagazzini] = useState<Magazzino[]>([]);
  const [magazzinoId, setMagazzinoId] = useState<string>("");
  const [period, setPeriod] = useState<StatsPeriod>("day");

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const magazzinoNome = useMemo(() => {
    const m = magazzini.find((x) => x.id === magazzinoId);
    return m?.nome ?? "";
  }, [magazzini, magazzinoId]);

  // carico magazzini + ripristino selezione
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch("/api/magazzini?t=" + Date.now(), {
          cache: "no-store",
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        const list: Magazzino[] = data.magazzini ?? [];
        if (!alive) return;

        setMagazzini(list);

        const saved =
          typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;

        if (saved && list.some((m) => m.id === saved)) {
          setMagazzinoId(saved);
        } else {
          // se non c'è salvato, lascio "tutti i magazzini" (vuoto)
          setMagazzinoId("");
        }
      } catch {
        // non blocco la pagina, ma segnalo eventualmente
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function loadStats(nextPeriod: StatsResponse["period"], nextMagazzinoId: string) {
  setLoading(true);
  setErr(null);

  try {
    const params = new URLSearchParams();
    params.set("period", nextPeriod);
    if (nextMagazzinoId) params.set("magazzinoId", nextMagazzinoId);
    params.set("t", String(Date.now())); // anti-cache

    const res = await fetch(`/api/stats?${params.toString()}`, {
      cache: "no-store",
      credentials: "include",
      redirect: "follow",
    });

    const ct = res.headers.get("content-type") || "";

    // ✅ se non è JSON, quasi sicuramente è redirect/middleware o cache SW
    if (!ct.includes("application/json")) {
      const txt = await res.text().catch(() => "");
      throw new Error(
        `Risposta non JSON da /api/stats (status ${res.status}). Probabile redirect/login o cache PWA. Preview: ${txt.slice(0, 80)}`
      );
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error((data as any)?.error ?? "Errore caricamento statistiche");

    // ✅ validazione minima struttura (così se arriva {} lo vediamo subito)
    if (
      !data ||
      typeof data !== "object" ||
      typeof (data as any).movimenti !== "number" ||
      !Array.isArray((data as any).ultimiMovimenti)
    ) {
      throw new Error("Risposta /api/stats non valida (probabile redirect o cache).");
    }

    setStats(data as StatsResponse);
  } catch (e: any) {
    setStats(null);
    setErr(e?.message ?? "Errore");
  } finally {
    setLoading(false);
  }
}
  useEffect(() => {
    loadStats(period, magazzinoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, magazzinoId]);

  const fromStats = encodeURIComponent("/statistiche");

  return (
    <main style={{ maxWidth: 1050, margin: "24px auto", padding: "0 16px", color: "#0f172a" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <Link href="/" style={{ fontWeight: 950, color: BRAND_RED, textDecoration: "none" }}>
          ← Dashboard
        </Link>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as StatsPeriod)}
            style={{ padding: 10, borderRadius: 12, border: "1px solid #d4d4d4", background: "#fff", fontWeight: 900 }}
          >
            {PERIODS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>

          <select
            value={magazzinoId}
            onChange={(e) => {
              const next = e.target.value;
              setMagazzinoId(next);
              try {
                localStorage.setItem(STORAGE_KEY, next);
              } catch {}
            }}
            style={{ padding: 10, borderRadius: 12, border: "1px solid #d4d4d4", background: "#fff", fontWeight: 900 }}
          >
            <option value="">Tutti i magazzini</option>
            {magazzini.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

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
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 950 }}>Statistiche</h1>

        <div style={{ marginTop: 6, opacity: 0.75, fontWeight: 700 }}>
          Periodo: <b>{PERIODS.find((p) => p.key === period)?.label}</b>
          {magazzinoId ? (
            <>
              {" "}
              • Magazzino: <b>{magazzinoNome || magazzinoId}</b>
            </>
          ) : (
            <>
              {" "}
              • Magazzino: <b>Tutti</b>
            </>
          )}
        </div>

        {stats && (
          <div style={{ marginTop: 6, opacity: 0.7, fontSize: 13 }}>
            Intervallo: {fmtDateTime(stats.from)} → {fmtDateTime(stats.to)}
          </div>
        )}

        {err && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#ffecec", color: "#8a1f1f", fontWeight: 900 }}>
            {err}
          </div>
        )}

        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div style={{ border: "1px solid #e6e6e6", borderRadius: 16, background: "#fff", padding: 14 }}>
            <div style={{ opacity: 0.7, fontSize: 13, fontWeight: 800 }}>Movimenti</div>
            <div style={{ marginTop: 6, fontSize: 34, fontWeight: 950, color: BRAND_RED }}>
              {loading ? "…" : stats?.movimenti ?? 0}
            </div>
          </div>

          <div style={{ border: "1px solid #e6e6e6", borderRadius: 16, background: "#fff", padding: 14 }}>
            <div style={{ opacity: 0.7, fontSize: 13, fontWeight: 800 }}>Codici distinti modificati</div>
            <div style={{ marginTop: 6, fontSize: 34, fontWeight: 950, color: BRAND_RED }}>
              {loading ? "…" : stats?.prodottiModificati ?? 0}
            </div>
          </div>
        </div>
      </div>

      <section style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 950 }}>Ultimi codici modificati</h2>
          <div style={{ opacity: 0.65, fontSize: 13 }}>Movimenti più recenti in alto</div>
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
          <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}>
            <table style={{ width: "100%", minWidth: 860, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                  <th style={{ padding: 14, width: 190, fontSize: 13, opacity: 0.85 }}>Data/Ora</th>
                  <th style={{ padding: 14, width: 200, fontSize: 13, opacity: 0.85 }}>Codice</th>
                  <th style={{ padding: 14, width: 180, fontSize: 13, opacity: 0.85 }}>Magazzino</th>
                  <th style={{ padding: 14, width: 110, fontSize: 13, opacity: 0.85 }}>Prima</th>
                  <th style={{ padding: 14, width: 110, fontSize: 13, opacity: 0.85 }}>Dopo</th>
                  <th style={{ padding: 14, width: 110, fontSize: 13, opacity: 0.85 }}>Δ</th>
                  <th style={{ padding: 14, width: 130 }}></th>
                </tr>
              </thead>

              <tbody>
                {(stats?.ultimiMovimenti ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 16, opacity: 0.75 }}>
                      {loading ? "Caricamento…" : "Nessun movimento nel periodo selezionato."}
                    </td>
                  </tr>
                ) : (
                  stats!.ultimiMovimenti.map((r) => {
                    const hrefProd = `/prodotto?codice=${encodeURIComponent(r.codice)}&magazzinoId=${encodeURIComponent(
                      r.magazzinoId
                    )}&from=${fromStats}`;

                    return (
                      <tr key={r.id} style={{ borderTop: "1px solid #eef2f7" }}>
                        <td style={{ padding: 14, fontWeight: 800 }}>{fmtDateTime(r.createdAt)}</td>

                        <td style={{ padding: 14, fontWeight: 950 }}>
                          <Link href={hrefProd} style={{ textDecoration: "none", color: "#0f172a" }}>
                            {r.codice}
                          </Link>
                        </td>

                        <td style={{ padding: 14, opacity: 0.9 }}>{r.magazzino?.nome ?? r.magazzinoId}</td>

                        <td style={{ padding: 14 }}>{r.qtyPrima ?? "—"}</td>
                        <td style={{ padding: 14, fontWeight: 900 }}>{r.qtyDopo ?? "—"}</td>

                        <td style={{ padding: 14, fontWeight: 900 }}>
                          {r.delta == null ? "—" : r.delta > 0 ? `+${r.delta}` : `${r.delta}`}
                        </td>

                        <td style={{ padding: 14 }}>
                          <Link
                            href={hrefProd}
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
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <footer style={{ marginTop: 16, opacity: 0.65, fontSize: 13 }}>Inventario CB • Statistiche</footer>
    </main>
  );
}