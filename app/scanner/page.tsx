import ScannerClient from "./ScannerClient";

function sanitizePath(input: unknown) {
  const raw = String(input ?? "/").trim() || "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  return raw;
}

function sanitizeStr(input: unknown) {
  return String(input ?? "").trim();
}

export default async function ScannerPage({
  searchParams,
}: {
  searchParams?: Promise<{
    from?: string;
    mode?: string;
    ordineId?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};

  const from = sanitizePath(sp.from || "/");
  const mode = sanitizeStr(sp.mode).toLowerCase();
  const ordineId = sanitizeStr(sp.ordineId);

  return <ScannerClient from={from} mode={mode} ordineId={ordineId} />;
}