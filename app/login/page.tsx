import LoginClient from "./LoginClient";

function sanitizeNext(input: unknown) {
  const raw = String(input ?? "/").trim() || "/";
  // consenti solo path interni
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  return raw;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const nextUrl = sanitizeNext(sp?.next);

  return <LoginClient nextUrl={nextUrl} />;
}