"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const BRAND_RED = "#C73A3A";

export default function ProdottoClient({
  codice,
  from,
  mode,
  ordineId,
}: {
  codice: string;
  from: string;
  mode: string;
  ordineId: string;
}) {
  const backHref = useMemo(() => {
    // fallback sicuro
    return from && from.startsWith("/") ? from : "/";
  }, [from]);

  const isOrderMode = mode === "ordine" && Boolean(ordineId);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // esempio: carica dati prodotto (adatta al tuo endpoint)
  const [prodotto, setProdotto] = useState<any>(null);

  useEffect(() => {
    if (!codice) return;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/prodotti/${encodeURIComponent(codice)}?t=${Date.now()}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? "Errore caricamento prodotto");
        setProdotto(data?.prodotto ?? null);
      } catch (e: any) {
        setErr(e?.message ?? "Errore");
      } finally {
        setLoading(false);
      }
    })();
  }, [codice]);

  return (
    <main style={{ maxWidth: 900, margin: "24px auto", padding: "0 16px", color: "#0f172a" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <Link href={backHref} style={{ fontWeight: 950, color: BRAND_RED, textDecoration: "none" }}>
          ← Indietro
        </Link>

        {isOrderMode ? (
          <div style={{ fontWeight: 900, opacity: 0.8 }}>
            Modalità ordine • ordineId: <span style={{ fontFamily: "monospace" }}>{ordineId}</span>
          </div>
        ) : null}
      </div>

      <h1 style={{ marginTop: 12, fontSize: 26, fontWeight: 950 }}>
        Prodotto {codice || "—"}
      </h1>

      {loading && <div style={{ opacity: 0.75 }}>Caricamento…</div>}
      {err && <div style={{ marginTop: 10, color: "crimson", fontWeight: 900 }}>{err}</div>}

      {prodotto && (
        <div style={{ marginTop: 12, padding: 14, borderRadius: 16, border: "1px solid #e6e6e6", background: "white" }}>
          <div style={{ fontWeight: 950 }}>{prodotto.descrizione}</div>
          {/* qui rimetti tutta la tua UI: immagini, quantità, pulsanti, ecc */}
        </div>
      )}
    </main>
  );
}