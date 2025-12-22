"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

type Magazzino = { id: string; nome: string };
type Prodotto = { codice: string; descrizione: string; immagini: { url: string }[] };

export default function ProdottoPage() {
  const params = useParams<{ codice: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const codice = decodeURIComponent(params.codice);
  const magazzinoIdFromUrl = searchParams.get("magazzinoId") ?? "";

  const [magazzini, setMagazzini] = useState<Magazzino[]>([]);
  const [magazzinoId, setMagazzinoId] = useState<string>(magazzinoIdFromUrl);
  const [prodotto, setProdotto] = useState<Prodotto | null>(null);

  const [qty, setQty] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // carica magazzini
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/magazzini");
      const data = await res.json();
      const list = data.magazzini ?? [];
      setMagazzini(list);

      // default Treviolo
      if (!magazzinoId && list.length > 0) {
        const treviolo = list.find((m: Magazzino) => m.nome === "Treviolo");
        setMagazzinoId(treviolo?.id ?? list[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // carica prodotto
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/prodotti/${encodeURIComponent(codice)}`);
        if (!res.ok) throw new Error("Prodotto non trovato");
        const data = await res.json();
        setProdotto(data.prodotto);
      } catch (e: any) {
        setError(e?.message ?? "Errore");
      } finally {
        setLoading(false);
      }
    })();
  }, [codice]);

  // carica qty dal magazzino selezionato
  async function loadQty() {
    if (!magazzinoId) return;
    const res = await fetch(`/api/giacenze/get?codice=${encodeURIComponent(codice)}&magazzinoId=${magazzinoId}`);
    const data = await res.json();
    setQty(data.qtyAttuale ?? 0);
  }

  useEffect(() => {
    if (magazzinoId) {
      // aggiorna querystring così tornando indietro mantiene magazzino
      router.replace(
  `/prodotto/${encodeURIComponent(codice)}?magazzinoId=${magazzinoId}`,
  { scroll: false }
);
      loadQty();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [magazzinoId]);

  const thumb = useMemo(() => prodotto?.immagini?.[0]?.url ?? null, [prodotto]);

  async function delta(d: number) {
    if (!magazzinoId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/giacenze/delta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codice, magazzinoId, delta: d }),
      });
      if (!res.ok) throw new Error("Errore aggiornamento quantità");
      const data = await res.json();
      setQty(data.qtyAttuale);
    } catch (e: any) {
      setError(e?.message ?? "Errore");
    } finally {
      setSaving(false);
    }
  }

  async function setValue() {
    if (!magazzinoId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/giacenze/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codice, magazzinoId, qtyAttuale: qty }),
      });
      if (!res.ok) throw new Error("Errore salvataggio quantità");
      const data = await res.json();
      setQty(data.qtyAttuale);
    } catch (e: any) {
      setError(e?.message ?? "Errore");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main style={{ padding: 24 }}>Caricamento…</main>;
  if (error && !prodotto) return <main style={{ padding: 24 }}>{error}</main>;

  return (
    <main style={{ maxWidth: 980, margin: "24px auto", padding: "0 16px" }}>
      <div style={{ marginBottom: 12 }}>
        <Link href="/" style={{ fontWeight: 800 }}>← Torna alla lista</Link>
      </div>

      <header style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 420px" }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>{prodotto?.codice}</h1>
          <div style={{ marginTop: 6, opacity: 0.8, fontSize: 16 }}>{prodotto?.descrizione}</div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontWeight: 800 }}>Magazzino</label>
            <select
              value={magazzinoId}
              onChange={(e) => setMagazzinoId(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
            >
              {magazzini.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 16, padding: 14, borderRadius: 14, border: "1px solid #e6e6e6" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontSize: 14, opacity: 0.75 }}>Quantità attuale</div>
              <div style={{ fontSize: 28, fontWeight: 900, marginLeft: 8 }}>{qty}</div>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[-5, -1, +1, +5].map((d) => (
                <button
                  key={d}
                  onClick={() => delta(d)}
                  disabled={saving}
                  style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", fontWeight: 900 }}
                >
                  {d > 0 ? `+${d}` : d}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", width: 140 }}
              />
              <button
                onClick={setValue}
                disabled={saving}
                style={{ padding: "10px 14px", borderRadius: 10, border: "none", fontWeight: 900 }}
              >
                {saving ? "Salvo…" : "Imposta quantità"}
              </button>
            </div>

            {error && (
              <div style={{ marginTop: 10, color: "crimson", fontWeight: 700 }}>{error}</div>
            )}
          </div>
        </div>

        <div style={{ width: 280 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Foto</div>
          <div style={{ border: "1px solid #e6e6e6", borderRadius: 14, padding: 12 }}>
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="foto prodotto" style={{ width: "100%", borderRadius: 12 }} />
            ) : (
              <div style={{ opacity: 0.7 }}>Nessuna foto (la aggiungiamo dopo)</div>
            )}
            <button
              onClick={() => router.push(`/foto/${encodeURIComponent(codice)}`)}
              style={{ marginTop: 10, width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", fontWeight: 900 }}
            >
              Aggiungi foto
            </button>
          </div>
        </div>
      </header>
    </main>
  );
}