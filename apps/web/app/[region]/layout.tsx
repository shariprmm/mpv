// apps/web/app/[region]/layout.tsx
import React from "react";
import { notFound } from "next/navigation";

const API =
  (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || "")
    .replace(/\/+$/, "") || "https://api.moydompro.ru";

async function isValidRegion(slug: string): Promise<boolean> {
  // slug обязателен
  const s = String(slug || "").trim().toLowerCase();
  if (!s) return false;

  try {
    // важное: короткий таймаут через AbortController
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 2500);

    const r = await fetch(`${API}/public/regions`, {
      next: { revalidate: 3600 },
      signal: controller.signal,
    }).finally(() => clearTimeout(t));

    if (!r.ok) {
      // если API вернул не-OK — считаем "не можем проверить"
      // и НЕ валим сайт 500
      return true;
    }

    const data = await r.json().catch(() => ({}));
    const items = Array.isArray((data as any)?.items) ? (data as any).items : [];

    // если список пустой — тоже не валим сайт
    if (!items.length) return true;

    return items.some((x: any) => String(x?.slug || "").toLowerCase() === s);
  } catch {
    // если API недоступен/таймаут — НЕ ломаем сайт
    return true;
  }
}

export default async function RegionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { region: string };
}) {
  const regionSlug = String(params?.region || "").trim().toLowerCase();
  if (!regionSlug) notFound();

  const ok = await isValidRegion(regionSlug);
  if (!ok) notFound();

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "16px" }}>
      {children}
    </main>
  );
}
