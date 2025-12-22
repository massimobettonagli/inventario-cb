"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const BRAND_RED = "#C73A3A";

type Magazzino = { id: string; nome: string };

type OrdineListItem = {
  id: string;
  codice: string;
  stato: "DRAFT" | "INVIATA" | "IN_LAVORAZIONE" | "CHIUSA";
  createdAt: string;
  daMagazzino: { id: string; nome: string };
  aMagazzino: { id: string; nome: string };
  _count: { righe: number };

  // 👇 necessari per capire se è stato inviato
  emailDestinatario?: string | null;
  sentAt?: string | null;
};

function canDeleteOrdine(o: Pick<OrdineListItem, "stato" | "sentAt" | "emailDestinatario">) {
  const notSent = !o.sentAt && !o.emailDestinatario;
  return o.stato === "DRAFT" || (o.stato === "CHIUSA" && notSent);
}

export default function OrdiniPage() {
  const [magazzini, setMagazzini] = useState<Magazzino[]>([]);
  const [daId, setDaId] = useState("");
  const [aId, setAId] = useState("");

  const [storico, setStorico] = useState<OrdineListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canCreate = useMemo(() => Boolean(daId && aId && daId !== aId), [daId, aId]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/magazzini", { cache: "no-store" });
        const data = await res.json();
        setMagazzini(data.magazzini ?? []);
      } catch {}
    })();
  }, []);

  async function loadStorico() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/ordini/list?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Errore caricamento storico");
      setStorico(data.ordini ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Errore");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStorico();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createDraft() {
    if (!canCreate) return;

    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/ordini/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daMagazzinoId: daId, aMagazzinoId: aId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Errore creazione ordine");

      const id = data?.ordine?.id;
      if (!id) throw new Error("Ordine creato ma ID mancante");
      window.location.href = `/ordini/${encodeURIComponent(id)}`;
    } catch (e: any) {
      setErr(e?.message ?? "Errore");
    } finally {
      setLoading(false);
    }
  }

  async function deleteOrdine(ordineId: string) {
    const res = await fetch("/api/ordini/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ordineId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Errore eliminazione ordine");
  }

  return (
    <main style={{ maxWidth: 1050, margin: "24px auto", padding: "0 16px", color: "#0f172a" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <Link href="/" style={{ fontWeight: 950, color: BRAND_RED, textDecoration: "none" }}>
          ← Dashboard
        </Link>
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
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 950 }}>Ordini di magazzino</h1>
        <div style={{ marginTop: 6, opacity: 0.75, fontWeight: 700 }}>
          Crea un ordine “bozza” e aggiungi righe tramite scansione QR.
        </div>

        {err && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#ffecec", color: "#8a1f1f", fontWeight: 900 }}>
            {err}
          </div>
        )}

        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          <div style={{ border: "1px solid #e6e6e6", borderRadius: 16, background: "#fff", padding: 14 }}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Nuovo ordine</div>

            <div style={{ display: "grid", gap: 10 }}>
              <select
                value={daId}
                onChange={(e) => setDaId(e.target.value)}
                style={{ padding: 10, borderRadius: 12, border: "1px solid #d4d4d4", background: "#fff", fontWeight: 900 }}
              >
                <option value="">Da magazzino…</option>
                {magazzini.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>

              <select
                value={aId}
                onChange={(e) => setAId(e.target.value)}
                style={{ padding: 10, borderRadius: 12, border: "1px solid #d4d4d4", background: "#fff", fontWeight: 900 }}
              >
                <option value="">A magazzino…</option>
                {magazzini.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>

              <button
                onClick={createDraft}
                disabled={!canCreate || loading}
                style={{
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "none",
                  fontWeight: 950,
                  cursor: !canCreate || loading ? "not-allowed" : "pointer",
                  background: BRAND_RED,
                  color: "white",
                  boxShadow: "0 10px 20px rgba(199,58,58,0.20)",
                  opacity: !canCreate || loading ? 0.7 : 1,
                }}
              >
                {loading ? "Creo…" : "Crea ordine e vai alle righe"}
              </button>

              <div style={{ opacity: 0.7, fontSize: 13 }}>
                Tip: se scansiono lo stesso codice due volte, la quantità viene sommata.
              </div>
            </div>
          </div>

          <div style={{ border: "1px solid #e6e6e6", borderRadius: 16, background: "#fff", padding: 14 }}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Storico ordini</div>
            <div style={{ opacity: 0.75, fontSize: 14 }}>
              Qui vedi gli ultimi ordini creati (con righe e stato). Apri per modificare (se bozza) o esportare.
            </div>

            <button
              onClick={loadStorico}
              disabled={loading}
              style={{
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 12,
                border: `1px solid ${BRAND_RED}`,
                fontWeight: 950,
                cursor: loading ? "not-allowed" : "pointer",
                background: "white",
                color: BRAND_RED,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Aggiorno…" : "Aggiorna storico"}
            </button>
          </div>
        </div>
      </div>

      {/* Tabella storico */}
      <section style={{ marginTop: 16 }}>
        <div
          style={{
            border: "1px solid #e6e6e6",
            borderRadius: 18,
            overflow: "hidden",
            background: "#fff",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
          }}
        >
          <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}>
            <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                  <th style={{ padding: 14, width: 200, fontSize: 13, opacity: 0.85 }}>Ordine</th>
                  <th style={{ padding: 14, width: 220, fontSize: 13, opacity: 0.85 }}>Da → A</th>
                  <th style={{ padding: 14, width: 140, fontSize: 13, opacity: 0.85 }}>Stato</th>
                  <th style={{ padding: 14, width: 120, fontSize: 13, opacity: 0.85 }}>Righe</th>
                  <th style={{ padding: 14, width: 190, fontSize: 13, opacity: 0.85 }}>Data</th>
                  <th style={{ padding: 14, width: 220 }}></th>
                </tr>
              </thead>
              <tbody>
                {storico.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 16, opacity: 0.75 }}>
                      {loading ? "Caricamento…" : "Nessun ordine trovato."}
                    </td>
                  </tr>
                ) : (
                  storico.map((o) => {
                    const showDelete = canDeleteOrdine(o);
                    const deleting = deletingId === o.id;

                    return (
                      <tr key={o.id} style={{ borderTop: "1px solid #eef2f7" }}>
                        <td style={{ padding: 14, fontWeight: 950 }}>{o.codice}</td>
                        <td style={{ padding: 14, opacity: 0.9 }}>
                          {o.daMagazzino.nome} → {o.aMagazzino.nome}
                        </td>
                        <td style={{ padding: 14, fontWeight: 900 }}>{o.stato}</td>
                        <td style={{ padding: 14 }}>{o._count.righe}</td>
                        <td style={{ padding: 14, opacity: 0.85 }}>{new Date(o.createdAt).toLocaleString("it-IT")}</td>

                        <td style={{ padding: 14 }}>
                          <div style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                            <Link
                              href={`/ordini/${encodeURIComponent(o.id)}`}
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

                            {showDelete && (
                              <button
                                onClick={async () => {
                                  const ok = confirm("Eliminare l’ordine? Questa operazione è irreversibile.");
                                  if (!ok) return;

                                  try {
                                    setDeletingId(o.id);
                                    await deleteOrdine(o.id);
                                    await loadStorico();
                                  } catch (e: any) {
                                    alert(e?.message ?? "Errore");
                                  } finally {
                                    setDeletingId(null);
                                  }
                                }}
                                disabled={deleting || loading}
                                style={{
                                  padding: "9px 12px",
                                  borderRadius: 12,
                                  border: "1px solid #e2e8f0",
                                  background: "white",
                                  fontWeight: 950,
                                  cursor: deleting || loading ? "not-allowed" : "pointer",
                                  opacity: deleting || loading ? 0.65 : 1,
                                  whiteSpace: "nowrap",
                                }}
                                title="Elimina ordine (solo bozza o chiuso non inviato)"
                              >
                                {deleting ? "Elimino…" : "Elimina"}
                              </button>
                            )}
                          </div>
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

      <footer style={{ marginTop: 16, opacity: 0.65, fontSize: 13 }}>Inventario CB • Ordini</footer>
    </main>
  );
}