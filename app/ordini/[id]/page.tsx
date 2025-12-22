"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const BRAND_RED = "#C73A3A";

type Riga = {
  id: string;
  codiceProdotto: string;
  descrizioneSnap: string | null;
  qty: number;
  createdAt: string;
};

type Ordine = {
  id: string;
  codice: string;
  stato: "DRAFT" | "INVIATA" | "IN_LAVORAZIONE" | "CHIUSA";
  createdAt: string;
  daMagazzinoId: string;
  aMagazzinoId: string;
  daMagazzino: { id: string; nome: string };
  aMagazzino: { id: string; nome: string };
  righe: Riga[];
  emailDestinatario?: string | null;
  sentAt?: string | null;
};

export default function OrdineDetailPage() {
  const params = useParams<{ id: string }>();
  const ordineId = typeof params?.id === "string" ? params.id : "";

  const [ordine, setOrdine] = useState<Ordine | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // popup invio email
  const [showSend, setShowSend] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const righeCount = ordine?.righe?.length ?? 0;

  // ✅ modificabile SOLO in DRAFT
  const canEdit = useMemo(() => ordine?.stato === "DRAFT", [ordine?.stato]);

  // ✅ invio: sempre disponibile se ordine non vuoto (anche reinvio)
  const canSend = useMemo(() => {
    if (!ordine) return false;
    if (righeCount <= 0) return false;
    return true;
  }, [ordine, righeCount]);

  const isFinal = useMemo(
    () => ordine?.stato === "INVIATA" || ordine?.stato === "CHIUSA",
    [ordine?.stato]
  );

  // Scanner: consentito SOLO in DRAFT
  const scannerHref = useMemo(() => {
    return `/scanner?from=${encodeURIComponent(
      `/ordini/${ordineId}`
    )}&mode=ordine&ordineId=${encodeURIComponent(ordineId)}`;
  }, [ordineId]);

  async function load() {
    if (!ordineId) return;
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(
        `/api/ordini/${encodeURIComponent(ordineId)}?t=${Date.now()}`,
        { cache: "no-store" }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Errore caricamento ordine");

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

  async function updateQty(rigaId: string, qty: number) {
    if (!canEdit) return;

    const res = await fetch("/api/ordini/righe/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rigaId, qty }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Errore update qty");

    await load();
  }

  async function deleteRow(rigaId: string) {
    if (!canEdit) return;

    const res = await fetch("/api/ordini/righe/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rigaId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Errore delete riga");

    await load();
  }

  async function completeOrder() {
    if (!ordineId) return;

    const res = await fetch("/api/ordini/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ordineId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Errore completamento");

    alert("Ordine completato ✅ Ora puoi inviarlo via email.");
    await load();
  }

  // ✅ download PDF (QR in ogni riga)
  async function downloadPDF() {
    if (!ordineId) return;

    try {
      const url = `/api/ordini/${encodeURIComponent(
        ordineId
      )}/document?format=pdf&t=${Date.now()}`;

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Errore download PDF");
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = objectUrl;

      const safeName = (ordine?.codice ?? `ordine-${ordineId}`).replace(
        /[^\w\-]+/g,
        "_"
      );
      a.download = `${safeName}.pdf`;

      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      alert(e?.message ?? "Errore");
    }
  }

  async function sendOrder() {
    if (!ordine) return;

    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      alert("Inserisci una mail valida");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/ordini/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordineId, email: trimmed }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Errore invio email");

      setShowSend(false);
      alert("Ordine inviato ✅ (PDF con QR allegato)");
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Errore");
    } finally {
      setSending(false);
    }
  }

  const statoLabel = useMemo(() => {
    const s = ordine?.stato;
    if (!s) return "";
    if (s === "DRAFT") return "Bozza";
    if (s === "IN_LAVORAZIONE") return "In lavorazione";
    if (s === "INVIATA") return "Inviata";
    return "Chiusa";
  }, [ordine?.stato]);

  const infoEdit = useMemo(() => {
    if (!ordine) return "";
    if (ordine.stato === "DRAFT") return "Modificabile (scanner + righe + quantità).";
    if (ordine.stato === "IN_LAVORAZIONE") return "Bloccato: puoi inviare / reinviare via email.";
    if (ordine.stato === "INVIATA") return "Inviato: non modificabile. Puoi reinviare il PDF.";
    return "Chiuso: non modificabile. Puoi reinviare il PDF.";
  }, [ordine]);

  return (
    <main style={{ maxWidth: 1050, margin: "24px auto", padding: "0 16px", color: "#0f172a" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <Link href="/ordini" style={{ fontWeight: 950, color: BRAND_RED, textDecoration: "none" }}>
          ← Ordini
        </Link>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {/* Scanner SOLO in DRAFT */}
          {canEdit ? (
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
              Scanner (aggiungi righe)
            </Link>
          ) : (
            <button
              disabled
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                fontWeight: 950,
                border: "none",
                color: "white",
                background: "#94a3b8",
                whiteSpace: "nowrap",
                cursor: "not-allowed",
                opacity: 0.9,
              }}
              title="Disponibile solo in bozza (DRAFT)"
            >
              Scanner (bloccato)
            </button>
          )}

          <button
            onClick={load}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              fontWeight: 950,
              border: "1px solid #e2e8f0",
              cursor: "pointer",
              background: "white",
              color: "#0f172a",
              whiteSpace: "nowrap",
            }}
            title="Ricarica dati ordine"
          >
            {loading ? "Ricarico…" : "Ricarica"}
          </button>

          <button
            onClick={downloadPDF}
            disabled={!ordineId}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              fontWeight: 950,
              border: `1px solid ${BRAND_RED}`,
              cursor: !ordineId ? "not-allowed" : "pointer",
              background: "white",
              color: BRAND_RED,
              whiteSpace: "nowrap",
              opacity: !ordineId ? 0.6 : 1,
            }}
            title="Scarica PDF con QR per ogni riga"
          >
            Scarica PDF (QR)
          </button>

          {/* Completa SOLO in DRAFT */}
          <button
            onClick={async () => {
              try {
                await completeOrder();
              } catch (e: any) {
                alert(e?.message ?? "Errore");
              }
            }}
            disabled={!canEdit || loading || righeCount <= 0}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              fontWeight: 950,
              border: "none",
              cursor: !canEdit || loading || righeCount <= 0 ? "not-allowed" : "pointer",
              background: "#0f172a",
              color: "white",
              opacity: !canEdit || loading || righeCount <= 0 ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
            title={
              !canEdit
                ? "Ordine non modificabile"
                : righeCount <= 0
                ? "Aggiungi almeno 1 riga"
                : "Porta l'ordine in 'IN_LAVORAZIONE' (blocco modifiche)"
            }
          >
            Completa ordine
          </button>

          {/* Invia SEMPRE se non vuoto (reinvio incluso) */}
          <button
            onClick={() => {
              setEmail((ordine?.emailDestinatario ?? "").toString());
              setShowSend(true);
            }}
            disabled={!canSend || loading}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              fontWeight: 950,
              border: "none",
              cursor: !canSend || loading ? "not-allowed" : "pointer",
              background: BRAND_RED,
              color: "white",
              opacity: !canSend || loading ? 0.6 : 1,
              whiteSpace: "nowrap",
              boxShadow: "0 10px 20px rgba(199,58,58,0.20)",
            }}
            title={
              !ordine
                ? "Caricamento ordine…"
                : righeCount <= 0
                ? "Ordine vuoto"
                : ordine.stato === "DRAFT"
                ? "Consiglio: completa l'ordine prima di inviarlo"
                : isFinal
                ? "Reinvio PDF (se la mail non è arrivata)"
                : "Invia ordine via email (PDF con QR allegato)"
            }
          >
            Invia ordine
          </button>
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
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 950 }}>{ordine?.codice ?? "Ordine"}</h1>

        {ordine && (
          <div style={{ marginTop: 6, opacity: 0.85, fontWeight: 800, lineHeight: 1.4 }}>
            {ordine.daMagazzino.nome} → {ordine.aMagazzino.nome} • Stato: <b>{statoLabel}</b>
            <span style={{ marginLeft: 10, fontWeight: 800, opacity: 0.75 }}>• {infoEdit}</span>

            {ordine.emailDestinatario ? (
              <div style={{ marginTop: 6, fontWeight: 800, opacity: 0.75 }}>
                Ultimo invio a: <span style={{ fontFamily: "monospace" }}>{ordine.emailDestinatario}</span>
                {ordine.sentAt ? (
                  <span style={{ marginLeft: 10 }}>• {new Date(ordine.sentAt).toLocaleString("it-IT")}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        {err && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#ffecec", color: "#8a1f1f", fontWeight: 900 }}>
            {err}
          </div>
        )}
      </div>

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
                  <th style={{ padding: 14, width: 220, fontSize: 13, opacity: 0.85 }}>Codice</th>
                  <th style={{ padding: 14, fontSize: 13, opacity: 0.85 }}>Descrizione</th>
                  <th style={{ padding: 14, width: 140, fontSize: 13, opacity: 0.85 }}>Qty</th>
                  <th style={{ padding: 14, width: 180, fontSize: 13, opacity: 0.85 }}>Azioni</th>
                </tr>
              </thead>

              <tbody>
                {(ordine?.righe ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 16, opacity: 0.75 }}>
                      {loading ? "Caricamento…" : canEdit ? "Nessuna riga. Vai su Scanner per aggiungere." : "Nessuna riga."}
                    </td>
                  </tr>
                ) : (
                  ordine!.righe.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid #eef2f7" }}>
                      <td style={{ padding: 14, fontWeight: 950 }}>{r.codiceProdotto}</td>
                      <td style={{ padding: 14, opacity: 0.9 }}>{r.descrizioneSnap ?? "—"}</td>
                      <td style={{ padding: 14 }}>
                        <input
                          type="number"
                          defaultValue={r.qty}
                          disabled={!canEdit}
                          onBlur={async (e) => {
                            if (!canEdit) return;
                            const v = Number((e.target as HTMLInputElement).value);
                            if (!Number.isFinite(v) || v <= 0) {
                              (e.target as HTMLInputElement).value = String(r.qty);
                              return;
                            }
                            if (v === r.qty) return;
                            try {
                              await updateQty(r.id, v);
                            } catch (err: any) {
                              alert(err?.message ?? "Errore");
                              await load();
                            }
                          }}
                          style={{
                            width: 120,
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid #d4d4d4",
                            fontWeight: 900,
                            background: canEdit ? "white" : "#f1f5f9",
                            opacity: canEdit ? 1 : 0.85,
                            cursor: canEdit ? "text" : "not-allowed",
                          }}
                        />
                      </td>
                      <td style={{ padding: 14 }}>
                        <button
                          onClick={async () => {
                            if (!canEdit) return;
                            if (!confirm("Eliminare la riga?")) return;
                            try {
                              await deleteRow(r.id);
                            } catch (err: any) {
                              alert(err?.message ?? "Errore");
                            }
                          }}
                          disabled={!canEdit}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid #e2e8f0",
                            background: canEdit ? "white" : "#f1f5f9",
                            fontWeight: 950,
                            cursor: !canEdit ? "not-allowed" : "pointer",
                            opacity: !canEdit ? 0.6 : 1,
                          }}
                        >
                          Elimina
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <footer style={{ marginTop: 16, opacity: 0.65, fontSize: 13 }}>Inventario CB • Ordine</footer>

      {/* POPUP INVIO EMAIL */}
      {showSend && (
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
            if (!sending) setShowSend(false);
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
            <div style={{ fontSize: 18, fontWeight: 950, color: "#0f172a" }}>Invia ordine per email</div>
            <div style={{ marginTop: 6, opacity: 0.75, fontWeight: 700 }}>
              Verrà allegato un <b>PDF</b> con <b>QR per ogni riga</b>.
            </div>

            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@azienda.it"
              inputMode="email"
              style={{
                marginTop: 12,
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid #d4d4d4",
                fontWeight: 800,
              }}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                onClick={() => setShowSend(false)}
                disabled={sending}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  background: "white",
                  fontWeight: 950,
                  cursor: sending ? "not-allowed" : "pointer",
                  opacity: sending ? 0.6 : 1,
                }}
              >
                Annulla
              </button>

              <button
                onClick={sendOrder}
                disabled={sending}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: BRAND_RED,
                  color: "white",
                  fontWeight: 950,
                  cursor: sending ? "not-allowed" : "pointer",
                  opacity: sending ? 0.75 : 1,
                }}
              >
                {sending ? "Invio…" : ordine?.stato === "INVIATA" || ordine?.stato === "CHIUSA" ? "Reinvia" : "Invia"}
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7, fontWeight: 700 }}>
              Tip: puoi reinviare il PDF anche se l’ordine è già <b>INVIATA</b> o <b>CHIUSA</b>.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}