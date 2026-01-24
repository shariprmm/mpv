// /apps/admin/app/master/products/[id]/page.tsx
import { cookies } from "next/headers";
import Link from "next/link";
import ProductEditorClient from "./ui";

export const dynamic = "force-dynamic";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  process.env.API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

async function apiGet(path: string) {
  const cookie = cookies().toString();
  const r = await fetch(`${API}${path}`, { cache: "no-store", headers: { cookie } });
  if (!r.ok) return null;
  return r.json();
}

export default async function MasterProductEditPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div style={{ padding: 24 }}>
        <div>bad id</div>
        <Link href="/master/products">← назад</Link>
      </div>
    );
  }

  const data = await apiGet(`/master/products/${id}`);
  const item = data?.item || null;

  if (!item) {
    return (
      <div style={{ padding: 24 }}>
        <div>Не найдено</div>
        <Link href="/master/products">← назад</Link>
      </div>
    );
  }

  return <ProductEditorClient item={item} apiBase={API} />;
}
