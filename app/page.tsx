"use client";

import Link from "next/link";
import Image from "next/image";

const BRAND_RED = "#C73A3A";

type CardProps = {
  title: string;
  desc: string;
  href: string;
  variant?: "solid" | "outline";
};

function Card({ title, desc, href, variant = "solid" }: CardProps) {
  const solid = variant === "solid";

  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        borderRadius: 18,
        padding: 18,
        border: solid ? "none" : "1px solid #e2e8f0",
        background: solid ? BRAND_RED : "white",
        color: solid ? "white" : "#0f172a",
        boxShadow: solid
          ? "0 14px 30px rgba(199,58,58,0.25)"
          : "0 10px 30px rgba(15,23,42,0.06)",
        display: "grid",
        gap: 8,
        minHeight: 120,
        transition: "transform .15s ease, box-shadow .15s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 950 }}>{title}</div>
      <div style={{ opacity: solid ? 0.9 : 0.75, lineHeight: 1.4 }}>{desc}</div>
    </Link>
  );
}

export default function DashboardHome() {
  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // anche se fallisce, mando comunque al login
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <main style={{ maxWidth: 1000, margin: "24px auto", padding: "0 16px", color: "#0f172a" }}>
      {/* HEADER */}
      <div
        style={{
          borderRadius: 18,
          border: "1px solid #e6e6e6",
          background: "linear-gradient(180deg, #ffffff, #fbfbfb)",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
          padding: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {/* LEFT: logo + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center" }} aria-label="Home">
            <img
              src="/logo.png"
              alt="CB Bettonagli"
              width={50}
              height={50}
              style={{ borderRadius: 10, objectFit: "contain", display: "block" }}
              onError={(e) => {
                console.error("Logo non trovato su /logo.png");
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </Link>

          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 950 }}>Dashboard Inventario CB</h1>
            <div style={{ marginTop: 6, opacity: 0.8 }}>
              Scegli cosa vuoi fare: scanner, lista prodotti, statistiche, ordini.
            </div>
          </div>
        </div>

        {/* RIGHT: logout */}
        <button
          onClick={handleLogout}
          style={{
            padding: "10px 16px",
            borderRadius: 999,
            fontWeight: 950,
            border: `1px solid ${BRAND_RED}`,
            background: "white",
            color: BRAND_RED,
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "background .15s ease, color .15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = BRAND_RED;
            e.currentTarget.style.color = "white";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "white";
            e.currentTarget.style.color = BRAND_RED;
          }}
        >
          Logout
        </button>
      </div>

      {/* CARDS */}
      <section
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        <Card
          title="Scanner QR"
          desc="Scansiona → aggiorna quantità → ritorna subito allo scanner."
          href="/scanner"
          variant="solid"
        />

        <Card
          title="Lista prodotti"
          desc="Cerca codici e descrizioni, apri i prodotti e modifica le quantità."
          href="/lista"
          variant="outline"
        />

        <Card
          title="Caricamenti / Esportazioni"
          desc="Import prodotti, export, storico file caricati."
          href="/caricamenti-esportazioni"
          variant="outline"
        />

        <Card
          title="Statistiche"
          desc="Movimenti per periodo e ultimi codici modificati."
          href="/statistiche"
          variant="outline"
        />

        <Card
          title="Ordini di magazzino"
          desc="Crea ordini da un magazzino all’altro via scansione + quantità. Storico, stati e invio."
          href="/ordini"
          variant="outline"
        />

        <Card
          title="Gestione ordini magazzino"
          desc="Prepara gli ordini: scansiona QR, inserisci quantità preparata, stato parziale/completo e chiusura."
          href="/ordini/prepara"
          variant="outline"
        />

        {/* ✅ NUOVA CARD */}
        <Card
          title="Storico articoli spediti"
          desc="Tabella cronologica di tutti gli articoli spediti. Cerca per codice o descrizione e vedi le ultime date di spedizione."
          href="/dashboard/storico-articoli-spediti"
          variant="outline"
        />
      </section>

      <footer style={{ marginTop: 18, opacity: 0.65, fontSize: 13 }}>
        Inventario CB • PWA • Multi-magazzino (Treviolo / Treviglio)
      </footer>
    </main>
  );
}