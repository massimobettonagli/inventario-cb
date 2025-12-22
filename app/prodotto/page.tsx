"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const BRAND_RED = "#C73A3A";

type Magazzino = { id: string; nome: string };

function ProdottoInner() {
  const sp = useSearchParams();
  const router = useRouter();

  const codice = (sp.get("codice") ?? "").trim();

  // ritorno
  const backTo = (sp.get("from") ?? "/lista").trim() || "/lista";

  // contesto magazzino (solo per inventario)
  const magazzinoFromUrl = (sp.get("magazzinoId") ?? "").trim();

  // ✅ contesto ordine
  const mode = (sp.get("mode") ?? "").trim().toLowerCase();
  const ordineId = (sp.get("ordineId") ?? "").trim();
  const isOrderMode = mode === "ordine" && Boolean(ordineId);

  // ✅ se arrivo dallo scanner (sia inventario che ordine) torno lì dopo l’azione
  const isFromScanner = backTo.startsWith("/scanner");

  const [magazzini, setMagazzini] = useState<Magazzino[]>([]);
  const [magazzinoId, setMagazzinoId] = useState<string>(magazzinoFromUrl);

  const [descrizione, setDescrizione] = useState<string>("");
  const [qtyAttuale, setQtyAttuale] = useState<number>(0);

  // input unico:
  // - inventario: nuova quantità
  // - ordine: quantità da aggiungere
  const [qtyInput, setQtyInput] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const magazzinoNome = useMemo(() => {
    const m = magazzini.find((x) => x.id === magazzinoId);
    return m?.nome ?? "";
  }, [magazzini, magazzinoId]);

  // 1) carico magazzini solo se NON sono in modalità ordine
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch("/api/magazzini", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        const list = (data.magazzini ?? []) as Magazzino[];
        if (!alive) return;
        setMagazzini(list);

        // default magazzino solo per inventario
        if (!isOrderMode && !magazzinoFromUrl) {
          const treviolo = list.find((m) => m.nome === "Treviolo");
          setMagazzinoId(treviolo?.id ?? list?.[0]?.id ?? "");
        }
      } catch {
        // ok: non blocco
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) carico prodotto
  async function load() {
    if (!codice) return;

    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      // ✅ in modalità ordine: non mi serve magazzinoId per funzionare,
      // ma voglio comunque mostrare la descrizione (e se API supporta, anche qtyAttuale)
      const qs = new URLSearchParams();
      if (!isOrderMode && magazzinoId) qs.set("magazzinoId", magazzinoId);
      // se sei in ordine e ti interessa anche lo stock, puoi passare comunque un magazzinoId
      // (facoltativo). Se non c’è, l’API dovrebbe almeno tornare prodotto+descrizione.
      if (isOrderMode && magazzinoId) qs.set("magazzinoId", magazzinoId);
      qs.set("t", String(Date.now()));

      const res = await fetch(`/api/prodotti/${encodeURIComponent(codice)}?${qs.toString()}`, {
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Errore caricamento prodotto");

      setDescrizione(data?.prodotto?.descrizione ?? "");

      const q = Number(data?.qtyAttuale ?? 0);
      setQtyAttuale(q);

      // default input:
      // - ordine: 1
      // - inventario: qty attuale
      if (isOrderMode) {
        setQtyInput(1);
      } else {
        setQtyInput(q);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Errore");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!codice) return;
    // per inventario serve magazzinoId
    if (!isOrderMode && !magazzinoId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codice, magazzinoId, isOrderMode]);

  // ✅ azione principale
  async function onConfirm() {
    if (!codice) return;

    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      if (isOrderMode) {
        // ✅ MODALITÀ ORDINE: aggiungo riga, NON tocco inventario
        const qty = Math.max(0, Number(qtyInput || 0));
        if (!Number.isFinite(qty) || qty <= 0) throw new Error("Quantità non valida");

        const res = await fetch("/api/ordini/righe/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ordineId,
            codiceProdotto: codice,
            qty,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? "Errore aggiunta riga");

        setMsg("✅ Riga aggiunta all’ordine");

        // torno allo scanner o all’ordine
        window.setTimeout(() => {
          if (isFromScanner) router.replace(backTo);
          else router.replace(`/ordini/${ordineId}`);
        }, 250);

        return;
      }

      // ✅ MODALITÀ INVENTARIO: salvo quantità attuale
      if (!magazzinoId) throw new Error("Magazzino non selezionato");

      const res = await fetch("/api/giacenze", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codice,
          magazzinoId,
          qtyAttuale: Math.max(0, Math.round(Number(qtyInput || 0))),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Errore salvataggio quantità");

      setMsg("✅ Quantità salvata");

      // se arrivo dallo scanner inventario: torno allo scanner
      if (isFromScanner) {
        window.setTimeout(() => router.replace(backTo), 250);
        return;
      }

      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Errore");
    } finally {
      setSaving(false);
    }
  }

  if (!codice) {
    return (
      <main style={{ maxWidth: 860, margin: "24px auto", padding: "0 16px" }}>
        <Link href={backTo} style={{ fontWeight: 950, color: BRAND_RED, textDecoration: "none" }}>
          ← Indietro
        </Link>
        <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: "1px solid #e6e6e6" }}>
          ⛔ Codice mancante nell’URL.
        </div>
      </main>
    );
  }

  const titleRight = isOrderMode ? "Ordine (aggiungi riga)" : "Inventario (aggiorna quantità)";
  const inputLabel = isOrderMode ? "Quantità da aggiungere all’ordine" : "Imposta nuova quantità";

  return (
    <main style={{ maxWidth: 860, margin: "24px auto", padding: "0 16px", color: "#0f172a" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <Link href={backTo} style={{ fontWeight: 950, color: BRAND_RED, textDecoration: "none" }}>
          ← Indietro
        </Link>

        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            background: "white",
            fontWeight: 950,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Ricarico…" : "Ricarica"}
        </button>
      </div>

      <div
        style={{
          marginTop: 12,
          borderRadius: 18,
          border: "1px solid #e6e6e6",
          background: "white",
          padding: 16,
          boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 950 }}>{codice}</h1>
            <div style={{ marginTop: 6, opacity: 0.85, fontWeight: 800 }}>{descrizione || "—"}</div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7, fontWeight: 800 }}>{titleRight}</div>
          </div>

          {/* ✅ Magazzino: utile per inventario (obbligatorio), per ordine è facoltativo (solo display stock) */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 950 }}>Magazzino</div>
            <select
              value={magazzinoId}
              onChange={(e) => setMagazzinoId(e.target.value)}
              style={{
                padding: 10,
                borderRadius: 12,
                border: "1px solid #d4d4d4",
                background: "white",
                fontWeight: 900,
                minWidth: 200,
              }}
            >
              {magazzini.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ✅ Stock sempre visibile se disponibile */}
        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 950, minWidth: 190 }}>Quantità attuale ({magazzinoNome || "magazzino"})</div>
            <div style={{ fontWeight: 950, fontSize: 18 }}>{qtyAttuale}</div>
            {isOrderMode && (
              <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 800 }}>
                (solo lettura: in modalità ordine non modifichi l’inventario)
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 950, minWidth: 190 }}>{inputLabel}</div>
            <input
              type="number"
              value={qtyInput}
              onChange={(e) => setQtyInput(Number(e.target.value))}
              style={{
                width: 180,
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid #d4d4d4",
                fontWeight: 950,
              }}
            />

            <button
              onClick={onConfirm}
              disabled={saving || (!isOrderMode && !magazzinoId)}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: "none",
                background: BRAND_RED,
                color: "white",
                fontWeight: 950,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                boxShadow: "0 10px 20px rgba(199,58,58,0.20)",
              }}
            >
              {saving ? "Salvo…" : isOrderMode ? "Aggiungi riga" : "Salva"}
            </button>
          </div>

          {err && (
            <div style={{ padding: 12, borderRadius: 12, background: "#ffecec", color: "#8a1f1f", fontWeight: 900 }}>
              ⛔ {err}
            </div>
          )}

          {msg && (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: "rgba(34,197,94,0.12)",
                border: "1px solid rgba(34,197,94,0.25)",
                fontWeight: 900,
              }}
            >
              {msg}
            </div>
          )}

          {isFromScanner && (
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.65, fontWeight: 800 }}>
              Dopo la conferma torni automaticamente allo scanner.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ProdottoPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Caricamento…</div>}>
      <ProdottoInner />
    </Suspense>
  );
}