"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const BRAND_RED = "#C73A3A";

type Magazzino = { id: string; nome: string };

type OrdineListItem = {
  id: string;
  codice: string;
  stato: "DRAFT" | "INVIATA" | "IN_LAVORAZIONE" | "CHIUSA";
  createdAt: string;
  closedAt?: string | null;
  shippedAt?: string | null;
  daMagazzino: Magazzino;
  aMagazzino: Magazzino;
  _count: { righe: number };
};

type RigaDettaglio = {
  id: string;
  codiceProdotto: string;
  descrizioneSnap: string | null;
  qty: number;
  qtyPrepared: number;
  nota?: string | null; // ✅ NUOVO
  createdAt: string;
};

type OrdineDettaglio = {
  id: string;
  codice: string;
  stato: "DRAFT" | "INVIATA" | "IN_LAVORAZIONE" | "CHIUSA";
  createdAt: string;
  closedAt?: string | null;
  shippedAt?: string | null;
  daMagazzinoId: string;
  aMagazzinoId: string;
  daMagazzino: Magazzino;
  aMagazzino: Magazzino;
  righe: RigaDettaglio[];
};

function prettyDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("it-IT");
  } catch {
    return String(d);
  }
}

function StatoBadge({ stato }: { stato: OrdineListItem["stato"] | OrdineDettaglio["stato"] }) {
  const style: React.CSSProperties = useMemo(() => {
    if (stato === "IN_LAVORAZIONE")
      return { background: "rgba(199,58,58,0.10)", color: BRAND_RED, border: "1px solid rgba(199,58,58,0.25)" };
    if (stato === "CHIUSA")
      return { background: "rgba(15,23,42,0.08)", color: "#0f172a", border: "1px solid rgba(15,23,42,0.15)" };
    if (stato === "INVIATA")
      return { background: "rgba(2,132,199,0.10)", color: "#0284c7", border: "1px solid rgba(2,132,199,0.25)" };
    return { background: "rgba(148,163,184,0.18)", color: "#334155", border: "1px solid rgba(148,163,184,0.30)" };
  }, [stato]);

  const label =
    stato === "DRAFT" ? "Bozza" : stato === "IN_LAVORAZIONE" ? "Da preparare" : stato === "INVIATA" ? "Inviata" : "Chiusa";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        fontWeight: 900,
        fontSize: 12,
        ...style,
      }}
    >
      ● {label}
    </span>
  );
}

function RigaBadge({ qty, qtyPrepared }: { qty: number; qtyPrepared: number }) {
  const done = qtyPrepared >= qty;
  const partial = qtyPrepared > 0 && qtyPrepared < qty;

  const style: React.CSSProperties = done
    ? { background: "rgba(16,185,129,0.12)", color: "#047857", border: "1px solid rgba(16,185,129,0.25)" }
    : partial
    ? { background: "rgba(245,158,11,0.14)", color: "#92400e", border: "1px solid rgba(245,158,11,0.25)" }
    : { background: "rgba(148,163,184,0.18)", color: "#334155", border: "1px solid rgba(148,163,184,0.30)" };

  const label = done ? "Completata" : partial ? "Parziale" : "Non iniziata";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        fontWeight: 900,
        fontSize: 12,
        ...style,
      }}
    >
      {label}
    </span>
  );
}

export default function PreparaOrdiniPage() {
  const [storico, setStorico] = useState<OrdineListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [errList, setErrList] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string>("");
  const [ordine, setOrdine] = useState<OrdineDettaglio | null>(null);
  const [loadingOrdine, setLoadingOrdine] = useState(false);
  const [errOrdine, setErrOrdine] = useState<string | null>(null);

  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const [splittingRowId, setSplittingRowId] = useState<string | null>(null);
  const [shipping, setShipping] = useState(false);

  // ✅ stato per salvataggio note (per riga)
  const [savingNoteRowId, setSavingNoteRowId] = useState<string | null>(null);
  const noteDraftRef = useRef<Record<string, string>>({});

  const daPreparare = useMemo(() => {
    return storico
      .filter((o) => o.stato === "INVIATA" || o.stato === "IN_LAVORAZIONE")
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [storico]);

  const conclusi = useMemo(() => {
    return storico.filter((o) => o.stato === "CHIUSA").sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [storico]);

  async function loadList() {
    setLoadingList(true);
    setErrList(null);
    try {
      const res = await fetch(`/api/ordini/list?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Errore caricamento ordini");
      setStorico(data.ordini ?? []);
    } catch (e: any) {
      setErrList(e?.message ?? "Errore");
    } finally {
      setLoadingList(false);
    }
  }

  async function loadOrdine(id: string) {
    if (!id) return;
    setLoadingOrdine(true);
    setErrOrdine(null);
    try {
      const res = await fetch(`/api/ordini/${encodeURIComponent(id)}?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Errore caricamento ordine");
      setOrdine(data.ordine as OrdineDettaglio);

      // ✅ aggiorno cache note draft per evitare “salti”
      const ord = data.ordine as OrdineDettaglio;
      const map: Record<string, string> = {};
      for (const r of ord?.righe ?? []) map[r.id] = r.nota ?? "";
      noteDraftRef.current = map;
    } catch (e: any) {
      setErrOrdine(e?.message ?? "Errore");
      setOrdine(null);
      noteDraftRef.current = {};
    } finally {
      setLoadingOrdine(false);
    }
  }

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) loadOrdine(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const progress = useMemo(() => {
    if (!ordine) return { done: 0, total: 0, pct: 0, anyStarted: false };
    const total = ordine.righe.length;
    const done = ordine.righe.filter((r) => (r.qtyPrepared ?? 0) >= r.qty).length;
    const anyStarted = ordine.righe.some((r) => (r.qtyPrepared ?? 0) > 0);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { done, total, pct, anyStarted };
  }, [ordine]);

  // ✅ coerente con backend: preparazione consentita sia in INVIATA che IN_LAVORAZIONE
  const canPrepare = ordine?.stato === "INVIATA" || ordine?.stato === "IN_LAVORAZIONE";

  // ✅ chiusura consentita in INVIATA o IN_LAVORAZIONE (almeno una riga iniziata)
  const canClose = Boolean(ordine) && (ordine!.stato === "INVIATA" || ordine!.stato === "IN_LAVORAZIONE") && progress.anyStarted;

  // ✅ spedizione: solo CHIUSA e non ancora spedito
  const canShip = useMemo(() => {
    if (!ordine) return false;
    return ordine.stato === "CHIUSA" && !ordine.shippedAt;
  }, [ordine]);

  async function setPreparedQty(r: RigaDettaglio, nextPrepared: number) {
    if (!ordine) return;
    if (!canPrepare) return;

    if (!Number.isFinite(nextPrepared) || nextPrepared < 0) {
      alert("Quantità preparata non valida");
      return;
    }

    const current = r.qtyPrepared ?? 0;
    const delta = Math.round(nextPrepared - current);

    if (delta === 0) return;
    if (delta < 0) {
      alert("Con questa modalità non puoi diminuire la qtyPrepared. Inserisci un valore >= attuale.");
      return;
    }

    setSavingRowId(r.id);
    try {
      const res = await fetch("/api/ordini/righe/prepare", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ordineId: ordine.id,
          codice: r.codiceProdotto,
          qtyPreparedAdd: delta,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Errore salvataggio qty preparata");

      await loadOrdine(ordine.id);
      await loadList();
    } catch (e: any) {
      alert(e?.message ?? "Errore");
    } finally {
      setSavingRowId(null);
    }
  }

  async function saveNota(rigaId: string, nextNota: string) {
    const nota = String(nextNota ?? "").trim();

    setSavingNoteRowId(rigaId);
    try {
      const res = await fetch("/api/ordini/righe/note", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rigaId, nota }), // ✅ Prisma: nota
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Errore salvataggio nota");

      // ricarico ordine per avere dato “canonico”
      if (ordine?.id) await loadOrdine(ordine.id);
    } catch (e: any) {
      alert(e?.message ?? "Errore salvataggio nota");
      // rollback: ripristino draft dal server (se disponibile)
      if (ordine?.id) await loadOrdine(ordine.id);
    } finally {
      setSavingNoteRowId(null);
    }
  }

  async function closeOrder() {
    if (!ordine) return;
    if (!canClose) return;

    const msg =
      "Confermi la chiusura dell’ordine?\n\n" +
      "• Puoi chiudere anche se non è al 100%.\n" +
      "• Le righe NON iniziate verranno spostate su un nuovo ordine (es: .1).";
    if (!confirm(msg)) return;

    setClosing(true);
    try {
      const res = await fetch("/api/ordini/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordineId: ordine.id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Errore chiusura ordine");

      if (data?.created?.id && data?.created?.codice) {
        alert(
          `Ordine chiuso ✅\n` +
            `Chiuso come: ${data?.closedCodice ?? ordine.codice}\n` +
            `Creato nuovo ordine: ${data.created.codice} (righe spostate: ${data.created.movedRows ?? "—"})`
        );
        await loadList();
        setSelectedId(String(data.created.id));
        return;
      }

      alert(`Ordine chiuso ✅\nChiuso come: ${data?.closedCodice ?? ordine.codice}`);
      await loadOrdine(ordine.id);
      await loadList();
    } catch (e: any) {
      alert(e?.message ?? "Errore");
    } finally {
      setClosing(false);
    }
  }

  async function markAsShipped(ordineId: string) {
    const ok = confirm("Confermi? Verrà salvata data e ora di spedizione.");
    if (!ok) return;

    setShipping(true);
    try {
      const res = await fetch("/api/ordini/ship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordineId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Errore salvataggio spedito");

      alert("Ordine segnato come spedito ✅");

      await loadList();
      if (selectedId === ordineId) await loadOrdine(ordineId);
    } catch (e: any) {
      alert(e?.message ?? "Errore");
    } finally {
      setShipping(false);
    }
  }

  async function splitResidualToNext(riga: RigaDettaglio) {
    if (!ordine) return;
    if (ordine.stato !== "CHIUSA") return;

    const qty = Number(riga.qty ?? 0);
    const prep = Number(riga.qtyPrepared ?? 0);
    const isPartial = prep > 0 && prep < qty;

    if (!isPartial) {
      alert("La riga non è parziale.");
      return;
    }

    const ok = confirm(
      "Confermi lo split?\n\n" +
        `• Consegnato (rimane nel .0): ${prep}\n` +
        `• Residuo (va nel .1): ${qty - prep}\n\n` +
        "Questa operazione è pensata per l’ufficio."
    );
    if (!ok) return;

    setSplittingRowId(riga.id);
    try {
      const res = await fetch("/api/ordini/righe/split-to-next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordineId: ordine.id, rigaId: riga.id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Errore split residuo");

      alert(
        `Split completato ✅\n` +
          `Residuo spostato su: ${data?.targetOrder?.codice ?? "ordine successivo"}\n` +
          `Consegnato: ${data?.qtyDelivered ?? prep} • Residuo: ${data?.qtyResidual ?? qty - prep}`
      );

      await loadList();
      await loadOrdine(ordine.id);
    } catch (e: any) {
      alert(e?.message ?? "Errore");
    } finally {
      setSplittingRowId(null);
    }
  }

  return (
    <main style={{ maxWidth: 1100, margin: "24px auto", padding: "0 16px", color: "#0f172a" }}>
      {/* TOP BAR */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <Link href="/" style={{ fontWeight: 950, color: BRAND_RED, textDecoration: "none" }}>
          ← Dashboard
        </Link>

        <button
          onClick={loadList}
          disabled={loadingList}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            fontWeight: 950,
            border: `1px solid ${BRAND_RED}`,
            cursor: loadingList ? "not-allowed" : "pointer",
            background: "white",
            color: BRAND_RED,
            opacity: loadingList ? 0.7 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {loadingList ? "Aggiorno…" : "Aggiorna"}
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
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 950 }}>Gestione ordini di magazzino</h1>
        <div style={{ marginTop: 6, opacity: 0.8, fontWeight: 700, lineHeight: 1.4 }}>
          Prepara gli ordini (INVIATA / IN_LAVORAZIONE). Puoi chiudere anche parzialmente.
          <br />
          Sugli ordini <b>CHIUSI</b>, l’ufficio può usare <b>Residuo → .1</b> sulle righe parziali per splittare automaticamente l’acconto.
        </div>

        {errList && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#ffecec", color: "#8a1f1f", fontWeight: 900 }}>
            {errList}
          </div>
        )}
      </div>

      {/* LAYOUT */}
      <section style={{ marginTop: 16, display: "grid", gridTemplateColumns: "380px 1fr", gap: 14, alignItems: "start" }}>
        {/* LISTA */}
        <div
          style={{
            border: "1px solid #e6e6e6",
            borderRadius: 18,
            background: "#fff",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 14, borderBottom: "1px solid #eef2f7" }}>
            <div style={{ fontWeight: 950, fontSize: 16 }}>Ordini da preparare</div>
            <div style={{ marginTop: 6, opacity: 0.75, fontWeight: 700, fontSize: 13 }}>
              Stato: <b>INVIATA</b> / <b>IN_LAVORAZIONE</b>
            </div>
          </div>

          <div style={{ padding: 10, display: "grid", gap: 10 }}>
            {daPreparare.length === 0 ? (
              <div style={{ padding: 10, opacity: 0.75 }}>{loadingList ? "Caricamento…" : "Nessun ordine da preparare."}</div>
            ) : (
              daPreparare.map((o) => {
                const active = o.id === selectedId;
                return (
                  <div
                    key={o.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(o.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setSelectedId(o.id);
                    }}
                    style={{
                      textAlign: "left",
                      padding: 12,
                      borderRadius: 14,
                      border: active ? `2px solid ${BRAND_RED}` : "1px solid #e2e8f0",
                      background: active ? "rgba(199,58,58,0.06)" : "white",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div style={{ fontWeight: 950 }}>{o.codice}</div>
                      <StatoBadge stato={o.stato} />
                    </div>

                    <div style={{ marginTop: 6, opacity: 0.85, fontWeight: 800, fontSize: 13 }}>
                      {o.daMagazzino.nome} → {o.aMagazzino.nome}
                    </div>

                    <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ opacity: 0.7, fontWeight: 700, fontSize: 12 }}>
                        Righe: <b>{o._count.righe}</b>
                      </div>
                      <div style={{ opacity: 0.7, fontWeight: 700, fontSize: 12 }}>{prettyDate(o.createdAt)}</div>
                    </div>

                    <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Link
                        href={`/ordini/prepara/${encodeURIComponent(o.id)}`}
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
                        onClick={(e) => e.stopPropagation()}
                      >
                        Apri scanner →
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ padding: 14, borderTop: "1px solid #eef2f7" }}>
            <div style={{ fontWeight: 950, fontSize: 16 }}>Ordini conclusi</div>
            <div style={{ marginTop: 6, opacity: 0.75, fontWeight: 700, fontSize: 13 }}>
              Stato: <b>CHIUSA</b>
            </div>
          </div>

          <div style={{ padding: 10, display: "grid", gap: 10 }}>
            {conclusi.length === 0 ? (
              <div style={{ padding: 10, opacity: 0.75 }}>{loadingList ? "Caricamento…" : "Nessun ordine chiuso."}</div>
            ) : (
              conclusi.slice(0, 15).map((o) => {
                const active = o.id === selectedId;
                const shipped = Boolean(o.shippedAt);

                return (
                  <div
                    key={o.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(o.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setSelectedId(o.id);
                    }}
                    style={{
                      textAlign: "left",
                      padding: 12,
                      borderRadius: 14,
                      border: active ? `2px solid ${BRAND_RED}` : "1px solid #e2e8f0",
                      background: active ? "rgba(199,58,58,0.06)" : "white",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div style={{ fontWeight: 950 }}>{o.codice}</div>
                      <StatoBadge stato={o.stato} />
                    </div>

                    <div style={{ marginTop: 6, opacity: 0.85, fontWeight: 800, fontSize: 13 }}>
                      {o.daMagazzino.nome} → {o.aMagazzino.nome}
                    </div>

                    <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                      <div style={{ opacity: 0.7, fontWeight: 700, fontSize: 12 }}>
                        Righe: <b>{o._count.righe}</b>
                      </div>
                      <div style={{ opacity: 0.7, fontWeight: 700, fontSize: 12 }}>
                        Creato: <b>{prettyDate(o.createdAt)}</b>
                      </div>
                      <div style={{ opacity: 0.7, fontWeight: 700, fontSize: 12 }}>
                        Chiuso: <b>{o.closedAt ? prettyDate(o.closedAt) : "—"}</b>
                      </div>
                      <div style={{ opacity: 0.7, fontWeight: 700, fontSize: 12 }}>
                        Spedito: <b>{o.shippedAt ? prettyDate(o.shippedAt) : "—"}</b>
                      </div>

                      <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {!shipped ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsShipped(o.id);
                            }}
                            disabled={shipping}
                            style={{
                              padding: "9px 12px",
                              borderRadius: 12,
                              border: "none",
                              fontWeight: 950,
                              cursor: shipping ? "not-allowed" : "pointer",
                              background: "#0f172a",
                              color: "white",
                              opacity: shipping ? 0.65 : 1,
                              whiteSpace: "nowrap",
                            }}
                            title="Segna come spedito (salva data e ora)"
                          >
                            Spedito
                          </button>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "7px 10px",
                              borderRadius: 999,
                              fontWeight: 900,
                              fontSize: 12,
                              background: "rgba(16,185,129,0.12)",
                              color: "#047857",
                              border: "1px solid rgba(16,185,129,0.25)",
                            }}
                            title="Ordine già segnato come spedito"
                          >
                            ✅ Spedito
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* DETTAGLIO */}
        <div
          style={{
            border: "1px solid #e6e6e6",
            borderRadius: 18,
            background: "#fff",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 14, borderBottom: "1px solid #eef2f7" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: 16 }}>Dettaglio ordine</div>
                <div style={{ marginTop: 6, opacity: 0.75, fontWeight: 700, fontSize: 13 }}>Seleziona un ordine a sinistra.</div>
              </div>

              {ordine ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <StatoBadge stato={ordine.stato} />

                  {ordine.stato === "CHIUSA" ? (
                    <button
                      onClick={() => markAsShipped(ordine.id)}
                      disabled={!canShip || shipping}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        fontWeight: 950,
                        border: "none",
                        cursor: !canShip || shipping ? "not-allowed" : "pointer",
                        background: "#0f172a",
                        color: "white",
                        opacity: !canShip || shipping ? 0.6 : 1,
                        whiteSpace: "nowrap",
                      }}
                      title={!canShip ? "Già spedito (o non chiuso)" : "Segna ordine come spedito"}
                    >
                      {shipping ? "Salvo…" : "Spedito"}
                    </button>
                  ) : (
                    <button
                      onClick={closeOrder}
                      disabled={!canClose || closing}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        fontWeight: 950,
                        border: "none",
                        cursor: !canClose || closing ? "not-allowed" : "pointer",
                        background: "#0f172a",
                        color: "white",
                        opacity: !canClose || closing ? 0.6 : 1,
                        whiteSpace: "nowrap",
                      }}
                      title={!canClose ? "Per chiudere devi avere almeno una riga iniziata (qtyPrepared > 0)." : "Chiudi ordine (anche parziale)"}
                    >
                      {closing ? "Chiudo…" : "Chiudi ordine"}
                    </button>
                  )}
                </div>
              ) : null}
            </div>

            {ordine ? (
              <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                <div style={{ fontSize: 18, fontWeight: 950 }}>{ordine.codice}</div>
                <div style={{ opacity: 0.85, fontWeight: 800 }}>
                  {ordine.daMagazzino.nome} → {ordine.aMagazzino.nome}
                </div>
                <div style={{ opacity: 0.7, fontWeight: 700, fontSize: 13 }}>
                  Creato: <b>{prettyDate(ordine.createdAt)}</b>
                  {ordine.closedAt ? (
                    <>
                      {" "}
                      • Chiuso: <b>{prettyDate(ordine.closedAt)}</b>
                    </>
                  ) : null}
                  {ordine.shippedAt ? (
                    <>
                      {" "}
                      • Spedito: <b>{prettyDate(ordine.shippedAt)}</b>
                    </>
                  ) : null}
                </div>

                <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ opacity: 0.8, fontWeight: 900 }}>
                    Progresso righe: <span style={{ color: BRAND_RED }}>{progress.done}/{progress.total}</span> • {progress.pct}%
                  </div>

                  <div style={{ width: 240, height: 10, borderRadius: 999, background: "#eef2f7", overflow: "hidden", border: "1px solid #e2e8f0" }}>
                    <div style={{ width: `${progress.pct}%`, height: "100%", background: BRAND_RED }} />
                  </div>
                </div>

                {ordine.stato === "CHIUSA" ? (
                  <div style={{ marginTop: 8, opacity: 0.75, fontWeight: 800, fontSize: 13 }}>
                    Ordine chiuso: consultazione sola lettura (ma puoi aggiornare le NOTE). (Ufficio: puoi splittare il residuo sulle righe parziali.)
                  </div>
                ) : null}
              </div>
            ) : null}

            {errOrdine && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#ffecec", color: "#8a1f1f", fontWeight: 900 }}>
                {errOrdine}
              </div>
            )}
          </div>

          <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}>
            <table style={{ width: "100%", minWidth: 1320, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                  <th style={{ padding: 14, width: 220, fontSize: 13, opacity: 0.85 }}>Codice</th>
                  <th style={{ padding: 14, fontSize: 13, opacity: 0.85 }}>Descrizione</th>
                  <th style={{ padding: 14, width: 140, fontSize: 13, opacity: 0.85 }}>Qty richiesta</th>
                  <th style={{ padding: 14, width: 160, fontSize: 13, opacity: 0.85 }}>Qty preparata</th>
                  <th style={{ padding: 14, width: 180, fontSize: 13, opacity: 0.85 }}>Nota fornitore</th>
                  <th style={{ padding: 14, width: 160, fontSize: 13, opacity: 0.85 }}>Stato riga</th>
                  <th style={{ padding: 14, width: 220, fontSize: 13, opacity: 0.85 }}>Azioni</th>
                </tr>
              </thead>

              <tbody>
                {!selectedId ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 16, opacity: 0.75 }}>
                      Seleziona un ordine a sinistra.
                    </td>
                  </tr>
                ) : loadingOrdine ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 16, opacity: 0.75 }}>
                      Caricamento ordine…
                    </td>
                  </tr>
                ) : !ordine ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 16, opacity: 0.75 }}>
                      Ordine non disponibile.
                    </td>
                  </tr>
                ) : ordine.righe.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 16, opacity: 0.75 }}>
                      Nessuna riga.
                    </td>
                  </tr>
                ) : (
                  ordine.righe.map((r) => {
                    // qtyPrepared: modificabile solo in INVIATA/IN_LAVORAZIONE
                    const disabledPrepared = !canPrepare || savingRowId === r.id || closing;

                    // nota: modificabile sempre, anche in CHIUSA
                    const disabledNote = savingNoteRowId === r.id;

                    const qty = Number(r.qty ?? 0);
                    const prep = Number(r.qtyPrepared ?? 0);
                    const isPartial = prep > 0 && prep < qty;
                    const canSplit = ordine.stato === "CHIUSA" && isPartial && !splittingRowId;

                    const draft = noteDraftRef.current[r.id] ?? (r.nota ?? "");

                    return (
                      <tr key={r.id} style={{ borderTop: "1px solid #eef2f7" }}>
                        <td style={{ padding: 14, fontWeight: 950 }}>{r.codiceProdotto}</td>
                        <td style={{ padding: 14, opacity: 0.9 }}>{r.descrizioneSnap ?? "—"}</td>
                        <td style={{ padding: 14, fontWeight: 900 }}>{r.qty}</td>

                        <td style={{ padding: 14 }}>
                          <input
                            key={`prep-${r.id}-${r.qtyPrepared ?? 0}`}
                            type="number"
                            defaultValue={r.qtyPrepared ?? 0}
                            disabled={disabledPrepared || ordine.stato === "CHIUSA"}
                            onBlur={async (e) => {
                              if (!canPrepare) return;
                              if (ordine?.stato === "CHIUSA") return;

                              const v = Number((e.target as HTMLInputElement).value);
                              if (!Number.isFinite(v) || v < 0) {
                                (e.target as HTMLInputElement).value = String(r.qtyPrepared ?? 0);
                                return;
                              }
                              if (v === (r.qtyPrepared ?? 0)) return;
                              await setPreparedQty(r, v);
                            }}
                            style={{
                              width: 140,
                              padding: "10px 12px",
                              borderRadius: 12,
                              border: "1px solid #d4d4d4",
                              fontWeight: 900,
                              background: disabledPrepared || ordine.stato === "CHIUSA" ? "#f1f5f9" : "white",
                              opacity: disabledPrepared || ordine.stato === "CHIUSA" ? 0.85 : 1,
                              cursor: disabledPrepared || ordine.stato === "CHIUSA" ? "not-allowed" : "text",
                            }}
                          />
                          {savingRowId === r.id ? (
                            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, opacity: 0.75 }}>Salvo…</div>
                          ) : null}
                        </td>

                        {/* ✅ NOTA FORNITORE (sempre modificabile) */}
                        <td style={{ padding: 14 }}>
                          <input
                            key={`note-${r.id}-${r.nota ?? ""}`}
                            defaultValue={draft}
                            placeholder="Rif. ordine fornitore…"
                            disabled={disabledNote}
                            onChange={(e) => {
                              noteDraftRef.current[r.id] = e.target.value;
                            }}
                            onBlur={async (e) => {
                              const next = e.currentTarget.value ?? "";
                              const prev = r.nota ?? "";
                              if (String(next).trim() === String(prev).trim()) return;
                              await saveNota(r.id, next);
                            }}
                            style={{
                              width: 240,
                              padding: "10px 12px",
                              borderRadius: 12,
                              border: "1px solid #d4d4d4",
                              fontWeight: 800,
                              background: disabledNote ? "#f1f5f9" : "white",
                              opacity: disabledNote ? 0.85 : 1,
                              cursor: disabledNote ? "not-allowed" : "text",
                            }}
                          />
                          {savingNoteRowId === r.id ? (
                            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, opacity: 0.75 }}>Salvo…</div>
                          ) : null}
                        </td>

                        <td style={{ padding: 14 }}>
                          <RigaBadge qty={r.qty} qtyPrepared={r.qtyPrepared ?? 0} />
                        </td>

                        <td style={{ padding: 14 }}>
                          {ordine.stato === "CHIUSA" && isPartial ? (
                            <button
                              onClick={() => splitResidualToNext(r)}
                              disabled={!canSplit || splittingRowId === r.id}
                              style={{
                                padding: "9px 12px",
                                borderRadius: 12,
                                border: "none",
                                fontWeight: 950,
                                cursor: !canSplit || splittingRowId === r.id ? "not-allowed" : "pointer",
                                background: "#0f172a",
                                color: "white",
                                opacity: !canSplit || splittingRowId === r.id ? 0.65 : 1,
                                whiteSpace: "nowrap",
                              }}
                              title="Sposta automaticamente il residuo su ordine successivo (es .1)"
                            >
                              {splittingRowId === r.id ? "Sposto…" : "Residuo → .1"}
                            </button>
                          ) : (
                            <span style={{ opacity: 0.6, fontWeight: 800, fontSize: 12 }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ padding: 14, borderTop: "1px solid #eef2f7", opacity: 0.7, fontSize: 13, fontWeight: 700 }}>
            Tip: per la modalità “veloce” usa la pagina con scanner dedicato: apri un ordine e vai su “Apri scanner”.
          </div>
        </div>
      </section>

      <footer style={{ marginTop: 16, opacity: 0.65, fontSize: 13 }}>Inventario CB • Preparazione ordini</footer>
    </main>
  );
}