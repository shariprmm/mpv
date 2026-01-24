// /apps/admin/app/master/companies/[id]/page.tsx
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import CompanyEditorClient from "./CompanyEditorClient";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

export const revalidate = 0;

async function apiGet(path: string) {
  const h = headers();
  const cookie = h.get("cookie") || "";

  const r = await fetch(`${API}${path}`, {
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
  });

  if (!r.ok) return null;
  return r.json().catch(() => null);
}

export default async function CompanyEditPage({ params }: { params: { id: string } }) {
  const id = Number(params?.id);
  if (!Number.isFinite(id) || id <= 0) notFound();

  const data = await apiGet(`/admin/companies/${id}`);
  
  // Универсальный маппинг данных из разных форматов API
  const item = data?.item ?? data?.company ?? data;

  if (!item?.id) notFound();

  return (
    <div className="animate-in fade-in duration-500">
      <CompanyEditorClient item={item} apiBase={API} />
    </div>
  );
}