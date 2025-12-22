"use client";

import { useState } from "react";

const BRAND_RED = "#C73A3A";

export default function LoginClient({ nextUrl }: { nextUrl: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setErr(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Accesso non riuscito");

      window.location.href = nextUrl || "/";
    } catch (e: any) {
      setErr(e?.message ?? "Errore");
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: "28px auto", padding: "0 16px", color: "#0f172a" }}>
      <div
        style={{
          borderRadius: 18,
          border: "1px solid #e6e6e6",
          background: "linear-gradient(180deg, #ffffff, #fbfbfb)",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
          padding: 18,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 950 }}>Accesso Inventario CB</h1>
        <div style={{ marginTop: 8, opacity: 0.75 }}>Inserisci le credenziali per accedere.</div>

        <form onSubmit={onSubmit} style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nome utente"
            autoComplete="username"
            style={{
              padding: "12px 12px",
              borderRadius: 12,
              border: "1px solid #d4d4d4",
              fontSize: 14,
              fontWeight: 800,
            }}
          />

          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            style={{
              padding: "12px 12px",
              borderRadius: 12,
              border: "1px solid #d4d4d4",
              fontSize: 14,
              fontWeight: 800,
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              padding: "12px 14px",
              borderRadius: 12,
              border: "none",
              fontWeight: 950,
              cursor: loading ? "not-allowed" : "pointer",
              background: BRAND_RED,
              color: "white",
              boxShadow: "0 10px 20px rgba(199,58,58,0.20)",
              opacity: loading ? 0.75 : 1,
            }}
          >
            {loading ? "Accesso..." : "Entra"}
          </button>

          {err && (
            <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: "#ffecec", color: "#8a1f1f", fontWeight: 900 }}>
              {err}
            </div>
          )}

          <div style={{ marginTop: 8, opacity: 0.65, fontSize: 12 }}>
            Dopo l’accesso verrai reindirizzato a: <b>{nextUrl}</b>
          </div>
        </form>
      </div>
    </main>
  );
}