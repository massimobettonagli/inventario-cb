import { Suspense } from "react";
import ListaClient from "./ListaClient";

export default function ListaPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Caricamento…</div>}>
      <ListaClient />
    </Suspense>
  );
}