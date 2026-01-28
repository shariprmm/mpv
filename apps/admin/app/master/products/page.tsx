// /apps/admin/app/master/products/page.tsx
import Link from "next/link";
import { cookies } from "next/headers";
import type React from "react";
import DeleteProductButton from "./DeleteProductButton";
import ToggleShowOnSite from "./ToggleShowOnSite";
import CopyProductButton from "./CopyProductButton";

export const dynamic = "force-dynamic";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  process.env.API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

const PUBLIC_SITE =
  (process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "").replace(/\/+$/, "") ||
  process.env.PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
  "https://moydompro.ru";

type Item = {
  id: number;
  slug: string;
  name: string;
  category_id?: number | null;
  category_name?: string | null;
  cover_image?: string | null;
  description_preview?: string | null;
  updated_at?: string | null;
  show_on_site?: boolean | null;
};

type Category = {
  id: number;
  name: string;
  path_name?: string | null;
};

async function apiGet(path: string) {
  const cookie = cookies().toString();
  const r = await fetch(`${API}${path}`, {
    cache: "no-store",
    headers: { cookie },
  });
  if (!r.ok) return null;
  return r.json();
}

function toPublicUploadsUrl(u: string | null | undefined) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/uploads/")) return `${PUBLIC_SITE}${s}`;
  return s;
}

function fmtDate(s?: string | null) {
  const v = String(s || "").trim();
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function categoryLabel(cat: Category) {
  const label = String(cat.path_name || "").trim();
  return label || cat.name;
}

export default async function MasterProductsPage({
  searchParams,
}: {
  searchParams?: { category?: string };
}) {
  const data = await apiGet(`/master/products`);
  const items: Item[] = Array.isArray(data?.items) ? data.items : [];
  const categoriesData = await apiGet(`/product-categories?flat=1`);
  const categories: Category[] = Array.isArray(categoriesData?.result)
    ? categoriesData.result
    : Array.isArray(categoriesData?.items)
      ? categoriesData.items
      : [];

  categories.sort((a, b) =>
    categoryLabel(a).localeCompare(categoryLabel(b), "ru")
  );

  const rawCategory = typeof searchParams?.category === "string" ? searchParams.category : "";
  const selectedCategoryId = rawCategory ? Number(rawCategory) : null;
  const selectedCategory = Number.isFinite(selectedCategoryId)
    ? categories.find((cat) => cat.id === selectedCategoryId) || null
    : null;

  const filteredItems =
    selectedCategory && Number.isFinite(selectedCategoryId)
      ? items.filter((it) => {
          if (it.category_id != null) {
            return Number(it.category_id) === selectedCategoryId;
          }
          if (!it.category_name || !selectedCategory) return false;
          return it.category_name === selectedCategory.name;
        })
      : items;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Товары</h1>
            <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
              Каноника
            </span>
          </div>
          <p className="text-sm text-gray-500 font-medium">
            Редактирование описаний, картинок и SEO из мастер-админки
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link 
            href="/master/products/new" 
            className="inline-flex items-center px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl transition-all active:scale-95 shadow-md text-sm"
          >
            <span className="mr-2 text-lg leading-none">+</span> Добавить товар
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Категория
            </span>
            <select
              name="category"
              defaultValue={selectedCategoryId ? String(selectedCategoryId) : ""}
              className="min-w-[240px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Все категории</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {categoryLabel(cat)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl transition-all active:scale-95 shadow-sm text-sm"
          >
            Показать
          </button>
          {selectedCategory ? (
            <Link
              href="/master/products"
              className="inline-flex items-center px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-all"
            >
              Сбросить
            </Link>
          ) : null}
        </form>
      </div>

      {/* TABLE CONTAINER */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-spacing-0 min-w-[1100px]">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-4 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest w-16">ID</th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest min-w-[200px]">Инфо</th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest min-w-[180px]">Категория</th>
                <th className="px-4 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest w-24">Сайт</th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest w-32">Обложка</th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest max-w-xs">Описание</th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest w-40">Обновлено</th>
                <th className="px-4 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest w-64">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center text-gray-400 font-medium italic">
                    Список товаров пуст
                  </td>
                </tr>
              ) : (
                filteredItems.map((it) => {
                  const coverUrl = toPublicUploadsUrl(it.cover_image);
                  const updated = fmtDate(it.updated_at);

                  return (
                    <tr key={it.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-4 py-5 text-xs font-mono text-gray-400 whitespace-nowrap">
                        #{it.id}
                      </td>

                      <td className="px-4 py-5">
                        <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-tight">
                          {it.name}
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono mt-1.5 truncate max-w-[180px]">
                          {it.slug}
                        </div>
                      </td>

                      <td className="px-4 py-5">
                        {it.category_name ? (
                          <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold">
                            {it.category_name}
                          </span>
                        ) : (
                          <span className="text-gray-300 italic text-sm">нет</span>
                        )}
                      </td>

                      <td className="px-4 py-5 text-center align-middle">
                        <ToggleShowOnSite id={it.id} initial={!!it.show_on_site} />
                      </td>

                      <td className="px-4 py-5">
                        {coverUrl ? (
                          <div className="w-24 h-14 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 shadow-sm relative group/thumb">
                            <img
                              src={coverUrl}
                              alt=""
                              className="w-full h-full object-cover transition-transform group-hover/thumb:scale-110"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div className="w-24 h-14 rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-gray-300 text-xs">
                            нет фото
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-5">
                        <div className="text-xs text-gray-500 leading-relaxed line-clamp-3 max-w-[300px]">
                          {it.description_preview || "—"}
                        </div>
                      </td>

                      <td className="px-4 py-5">
                        <div className="text-[11px] text-gray-400 font-medium">
                          {updated || "—"}
                        </div>
                      </td>

                      <td className="px-4 py-5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <Link 
                            href={`/master/products/${it.id}`} 
                            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm active:scale-95"
                          >
                            Открыть
                          </Link>
                          <CopyProductButton id={it.id} />
                          <DeleteProductButton id={it.id} name={it.name} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex items-center justify-start pt-4">
        <Link 
          href="/master" 
          className="text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors flex items-center gap-2"
        >
          <span>←</span> Назад в панель
        </Link>
      </div>
    </div>
  );
}
