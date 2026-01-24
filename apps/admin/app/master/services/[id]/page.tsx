// /apps/admin/app/master/services/[id]/page.tsx
import { cookies } from "next/headers";
import Link from "next/link";
import ServiceEditorClient from "./ui";

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

export default async function MasterServiceEditPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);

  // 1. Ошибка валидации ID
  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6">
        <div className="bg-red-50 border border-red-100 text-red-800 px-6 py-4 rounded-xl shadow-sm text-center mb-6">
          <h2 className="font-bold text-lg mb-1">Ошибка ID</h2>
          <p className="text-sm opacity-80">Указан некорректный идентификатор услуги</p>
        </div>
        <Link 
          href="/master/services" 
          className="text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
        >
          ← Вернуться к списку
        </Link>
      </div>
    );
  }

  const data = await apiGet(`/master/services/${id}`);
  const item = data?.item || null;

  // 2. Ошибка 404 (Не найдено)
  if (!item) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6">
        <div className="bg-gray-50 border border-gray-200 px-8 py-6 rounded-2xl text-center mb-6 max-w-md">
          <div className="text-4xl mb-3">🔍</div>
          <h2 className="font-black text-xl text-gray-900 mb-2">Услуга не найдена</h2>
          <p className="text-gray-500 text-sm">
            Запись #{id} не существует или была удалена.
          </p>
        </div>
        <Link 
          href="/master/services" 
          className="px-6 py-2.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-all shadow-md active:scale-95"
        >
          Вернуться назад
        </Link>
      </div>
    );
  }

  // 3. Успех — рендерим клиентский редактор
  return (
    <div className="animate-in fade-in duration-500">
      <ServiceEditorClient item={item} apiBase={API} />
    </div>
  );
}