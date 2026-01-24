// /apps/admin/app/master/products/new/NewProductForm.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  process.env.API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

type CategoryFlat = {
  id: number;
  slug: string;
  name: string;
  parent_id: number | null;
  sort_order: number;
  is_active?: boolean;
};

// --- Helpers ---

function slugifyRu(v: string) {
  const raw = String(v || "").trim().toLowerCase().replace(/ё/g, "e");

  // 1) нормализуем пробелы/подчёркивания/тире → дефисы
  const normalized = raw
    .replace(/[_\s]+/g, "-")
    .replace(/[–—]+/g, "-")
    .replace(/-+/g, "-");

  // 2) оставляем только лат/кирилл/цифры/дефисы
  const keep = normalized.replace(/[^a-z0-9а-я-]/gi, "");

  // 3) транслитерация
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i",
    й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
    э: "e", ю: "yu", я: "ya",
  };

  const translit = keep
    .split("")
    .map((ch) => (map[ch] !== undefined ? map[ch] : ch))
    .join("");

  // 4) финальная чистка
  return translit
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// --- Component ---

export default function NewProductForm() {
  const router = useRouter();

  const [cats, setCats] = useState<CategoryFlat[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [categoryId, setCategoryId] = useState<number | "">("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingCats(true);
        const r = await fetch(`${API}/product-categories?flat=1`, {
          credentials: "include",
          cache: "no-store",
        });
        const j = await r.json().catch(() => null);
        const list = Array.isArray(j?.result) ? j.result : [];
        if (alive) setCats(list);
      } finally {
        if (alive) setLoadingCats(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const canSave = useMemo(() => {
    return name.trim().length >= 2 && slug.trim().length >= 2 && Number(categoryId) > 0;
  }, [name, slug, categoryId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || saving) return;

    setSaving(true);
    try {
      const res = await fetch(`${API}/master/products`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          category_id: Number(categoryId),
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 409 && data?.error === "slug_exists") {
          alert("Slug уже занят. Укажи другой slug.");
          return;
        }
        alert(`Ошибка создания: ${data?.error || res.status}`);
        return;
      }

      const newId = data?.item?.id;
      if (newId) router.push(`/master/products/${newId}`);
      else router.push("/master/products");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <form
        onSubmit={onSubmit}
        className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden transition-all"
      >
        <div className="p-8 space-y-6">
          <div className="space-y-1 border-b border-gray-50 pb-4">
            <h2 className="text-xl font-black text-gray-900 tracking-tight">Основные данные товара</h2>
            <p className="text-sm text-gray-400 font-medium">Заполните базовую информацию для создания канонической записи</p>
          </div>

          <div className="grid gap-6">
            {/* NAME */}
            <label className="block space-y-2 group">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-blue-600">
                Название товара
              </span>
              <input
                value={name}
                onChange={(e) => {
                  const v = e.target.value;
                  setName(v);
                  if (!slugTouched) setSlug(slugifyRu(v));
                }}
                placeholder="Напр. «Колос 8»"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 ring-blue-50 transition-all text-gray-900 font-bold placeholder:font-normal"
                required
              />
            </label>

            {/* SLUG */}
            <label className="block space-y-2 group">
              <div className="flex justify-between items-center ml-1">
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest transition-colors group-focus-within:text-blue-600">
                  Slug (URL путь)
                </span>
                {slugTouched && (
                    <button 
                      type="button" 
                      onClick={() => { setSlugTouched(false); setSlug(slugifyRu(name)); }}
                      className="text-[10px] font-bold text-blue-500 hover:text-blue-700 uppercase"
                    >
                      Сбросить авто
                    </button>
                )}
              </div>
              <input
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugifyRu(e.target.value));
                }}
                onBlur={() => {
                  if (!slug.trim()) setSlugTouched(false);
                }}
                placeholder="kolos-8"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 ring-blue-50 transition-all text-blue-600 font-mono text-sm"
                required
              />
              <p className="text-[10px] text-gray-400 font-medium italic ml-1">
                Кириллица и пробелы будут автоматически исправлены.
              </p>
            </label>

            {/* CATEGORY */}
            <label className="block space-y-2 group">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-blue-600">
                Категория
              </span>
              <div className="relative">
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 ring-blue-50 transition-all text-gray-900 font-bold appearance-none disabled:opacity-50"
                  disabled={loadingCats}
                  required
                >
                  <option value="">{loadingCats ? "Загрузка категорий…" : "Выберите категорию"}</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="bg-gray-50 px-8 py-6 flex items-center justify-between border-t border-gray-100">
          <button 
            type="button" 
            onClick={() => router.back()}
            className="text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
          >
            Отмена
          </button>
          
          <button
            type="submit"
            disabled={!canSave || saving}
            className={`
              inline-flex items-center px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg
              ${canSave && !saving 
                ? "bg-gray-900 text-white hover:bg-gray-800 active:scale-95 shadow-gray-200" 
                : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"}
            `}
          >
            {saving ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Создание...
              </>
            ) : "Создать товар"}
          </button>
        </div>
      </form>
    </div>
  );
}