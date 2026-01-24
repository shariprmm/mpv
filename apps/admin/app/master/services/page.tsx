// /apps/admin/app/master/services/page.tsx
import Link from "next/link";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import CreateServiceButton from "./CreateServiceButton";

export const dynamic = "force-dynamic";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  process.env.API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

// ✅ Домен, где лежат картинки
const IMG_BASE_URL = "https://moydompro.ru";

/**
 * ✅ Хелпер для исправления путей картинок
 */
function resolveImgSrc(src: string | null | undefined) {
  if (!src) return "";
  const s = String(src).trim();
  if (!s) return "";

  // Если ссылка ведет на админку, меняем на основной сайт
  if (s.includes("https://admin.moydompro.ru")) {
    return s.replace("https://admin.moydompro.ru", IMG_BASE_URL);
  }

  // Если путь относительный (начинается с /), добавляем домен
  if (s.startsWith("/")) {
    return `${IMG_BASE_URL}${s}`;
  }

  return s;
}

type Item = {
  id: number;
  slug: string;
  name: string;
  category_name?: string | null;
  cover_image?: string | null;
  description_preview?: string | null;
  updated_at?: string | null;
  show_on_site?: boolean | null;
};

async function apiGet(path: string) {
  try {
    const cookie = cookies().toString();
    const r = await fetch(`${API}${path}`, {
      cache: "no-store",
      headers: { cookie },
    });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch {
    return null;
  }
}

/**
 * ✅ DELETE service (server action)
 */
async function deleteServiceAction(formData: FormData) {
  "use server";

  const id = Number(formData.get("id") || 0);
  if (!id) return;

  const cookie = cookies().toString();

  const r = await fetch(`${API}/master/services/${id}`, {
    method: "DELETE",
    headers: { cookie },
    cache: "no-store",
  });

  if (!r.ok) {
    revalidatePath("/master/services");
    redirect("/master/services");
  }

  revalidatePath("/master/services");
  redirect("/master/services");
}

export default async function MasterServicesPage() {
  const data = await apiGet(`/master/services`);
  const items: Item[] = Array.isArray(data?.items) ? data.items : [];

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Услуги</h1>
            <span className="text-xs bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
              Каноника
            </span>
          </div>
          <p className="text-sm text-gray-500 font-medium">
            База услуг: описания, изображения, SEO-шаблоны
          </p>
        </div>

        <div className="flex items-center gap-3">
          <CreateServiceButton apiBase={API} />
        </div>
      </div>

      {!data && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-bold flex items-center gap-3">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          Не удалось загрузить список услуг. Проверьте API.
        </div>
      )}

      {/* TABLE */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest w-16">ID</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest min-w-[200px]">Услуга</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest w-40">Категория</th>
                <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest w-24">Сайт</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest w-32">Обложка</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest max-w-sm">Описание</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest w-40">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-gray-400 font-medium italic">
                    Список услуг пуст
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.id} className="hover:bg-rose-50/30 transition-colors group">
                    <td className="px-6 py-5 text-xs font-mono text-gray-400 whitespace-nowrap">
                      #{it.id}
                    </td>

                    <td className="px-6 py-5">
                      <div className="font-bold text-gray-900 group-hover:text-rose-600 transition-colors">
                        {it.name}
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono mt-1 truncate max-w-[180px]">
                        {it.slug}
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      {it.category_name ? (
                        <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold">
                          {it.category_name}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </td>

                    <td className="px-6 py-5 text-center">
                      {it.show_on_site ? (
                        <span className="text-green-500 font-bold text-lg">✓</span>
                      ) : (
                        <span className="text-gray-200 text-lg">•</span>
                      )}
                    </td>

                    <td className="px-6 py-5">
                      {it.cover_image ? (
                        <div className="w-20 h-12 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 shadow-sm relative group/thumb">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={resolveImgSrc(it.cover_image)}
                            alt=""
                            className="w-full h-full object-cover transition-transform group-hover/thumb:scale-110"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-12 rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-gray-300 text-[10px]">
                          нет фото
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-5">
                      <div className="text-xs text-gray-500 leading-relaxed line-clamp-2 max-w-[280px]">
                        {it.description_preview || "—"}
                      </div>
                    </td>

                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <Link 
                          href={`/master/services/${it.id}`} 
                          className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:border-rose-400 hover:text-rose-600 transition-all shadow-sm active:scale-95"
                        >
                          Открыть
                        </Link>
                        
                        <form action={deleteServiceAction as any}>
                          <input type="hidden" name="id" value={it.id} />
                          <button
                            type="submit"
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Удалить услугу"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pt-4">
        <Link href="/master" className="text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors flex items-center gap-2">
          <span>←</span> Назад в панель
        </Link>
      </div>
    </div>
  );
}