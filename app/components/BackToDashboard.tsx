"use client";

import Link from "next/link";

const BRAND_RED = "#C73A3A";

export default function BackToDashboard() {
  return (
    <Link href="/" style={{ fontWeight: 950, color: BRAND_RED, textDecoration: "none" }}>
      ← Dashboard
    </Link>
  );
}