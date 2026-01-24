// apps/admin/app/master/companies/page.tsx
import Link from "next/link";
import { headers } from "next/headers";

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

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`API ${r.status}: ${txt}`);
  }
  return r.json();
}

export default async function MasterCompaniesPage({
  searchParams,
}: {
  searchParams?: { q?: string; page?: string };
}) {
  const q = String(searchParams?.q ?? "").trim();
  const page = Math.max(1, Number(searchParams?.page ?? 1) || 1);

  const data = await apiGet(
    `/admin/companies?search=${encodeURIComponent(q)}&page=${page}&limit=50`
  );

  const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Компании</h1>
          <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
            {items.length} объектов
          </span>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <form className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              name="q"
              defaultValue={q}
              placeholder="Название, телефон или город..."
              className="block w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white text-sm transition-all"
            />
          </div>
          <button
            type="submit"
            className="px-8 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl transition-all active:scale-95 shadow-md shadow-gray-200 text-sm"
          >
            Найти
          </button>
        </form>
      </div>

      {/* TABLE CONTAINER */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.1em]">ID</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.1em]">Компания</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.1em]">Локация</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.1em]">Контакты</th>
                <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.1em]">Вериф.</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.1em]">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((c: any) => (
                <tr key={String(c?.id)} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-400">
                    #{c?.id}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {c?.name || "—"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 flex items-center gap-2">
                      <span className="text-gray-300">📍</span>
                      <span className="truncate max-w-[200px]">
                        {(c?.city || c?.city_name || "") + (c?.region_name ? `, ${c.region_name}` : "") || "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500 font-medium font-mono">
                      {c?.phone || c?.tel || "—"}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {c?.is_verified ? (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-600">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                           <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                    ) : (
                      <span className="text-gray-200 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link 
                      href={`/master/companies/${c?.id}`}
                      className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm active:scale-95"
                    >
                      Редактировать
                      <svg className="ml-1.5 w-3.5 h-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))}

              {!items.length && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="text-gray-400 font-medium">Ничего не найдено</div>
                    <div className="text-gray-300 text-xs mt-1 font-normal">Попробуйте изменить поисковый запрос</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}