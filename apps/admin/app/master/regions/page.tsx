"use client";

import React, { useEffect, useMemo, useState } from "react";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "https://api.moydompro.ru";

type IdLike = number;
type Region = { id: IdLike; slug: string; name: string };

// Универсальная функция запроса
async function apiJson<T>(url: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...opts,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    cache: "no-store",
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok || !raw?.ok) throw new Error(raw?.error || `HTTP ${res.status}`);
  return raw as T;
}

export default function MasterRegionsPage() {
  const [items, setItems] = useState<Region[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");

  // Загрузка данных
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const r = await apiJson<{ ok: true; items: Region[] }>(`${API}/admin/regions`);
        setItems(r.items || []);
      } catch (e: any) {
        alert(`Ошибка загрузки регионов: ${e?.message || e}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Фильтрация поиска
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((r) => `${r.name} ${r.slug}`.toLowerCase().includes(t));
  }, [items, q]);

  // Создание региона
  async function createRegion() {
    const name = createName.trim();
    const slug = createSlug.trim();
    if (!name || !slug) return alert("Заполни name и slug");

    try {
      const r = await apiJson<{ ok: true; item: Region }>(`${API}/admin/regions`, {
        method: "POST",
        body: JSON.stringify({ name, slug }),
      });
      setItems((p) => [...p, r.item].sort((a, b) => a.name.localeCompare(b.name, "ru")));
      setCreateName("");
      setCreateSlug("");
    } catch (e: any) {
      alert(`Ошибка создания: ${e?.message || e}`);
    }
  }

  // Обновление региона
  async function patch(id: number, patch: Partial<Region>) {
    try {
      const r = await apiJson<{ ok: true; item: Region }>(`${API}/admin/regions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setItems((p) => p.map((x) => (x.id === id ? r.item : x)));
    } catch (e: any) {
      alert(`Ошибка сохранения: ${e?.message || e}`);
    }
  }

  // Удаление региона
  async function del(id: number) {
    if (!confirm("Удалить регион?")) return;
    try {
      await apiJson<{ ok: true }>(`${API}/admin/regions/${id}`, { method: "DELETE" });
      setItems((p) => p.filter((x) => x.id !== id));
    } catch (e: any) {
      alert(`Ошибка удаления: ${e?.message || e}`);
    }
  }

  return (
    <div className="space-y-6">
      {/* Заголовок страницы */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Регионы</h1>
        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          Всего: {items.length}
        </span>
      </div>

      {/* Карточка создания и поиска */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-gray-500 uppercase">Название</span>
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Например: Москва"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-gray-500 uppercase">Slug (URL)</span>
            <input
              value={createSlug}
              onChange={(e) => setCreateSlug(e.target.value)}
              placeholder="Например: moscow"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
          </label>
          <button
            onClick={createRegion}
            className="px-5 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 active:transform active:scale-95 transition-all"
          >
            Добавить
          </button>
        </div>

        <div className="pt-4 border-t border-gray-100">
           <input
             value={q}
             onChange={(e) => setQ(e.target.value)}
             placeholder="🔍 Поиск по регионам..."
             className="w-full md:w-1/2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-400 transition-colors"
           />
        </div>
      </div>

      {/* Список регионов */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Загрузка данных...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Ничего не найдено</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Заголовки таблицы (скрыты на мобильном) */}
            <div className="hidden md:grid grid-cols-[60px_1fr_1fr_200px] gap-4 px-6 py-3 bg-gray-50/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <div>ID</div>
              <div>Название</div>
              <div>Slug</div>
              <div className="text-right">Действия</div>
            </div>

            {filtered.map((r) => (
              <Row
                key={r.id}
                region={r}
                onSave={(patchObj) => patch(r.id, patchObj)}
                onDelete={() => del(r.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Компонент строки таблицы
function Row({
  region,
  onSave,
  onDelete,
}: {
  region: Region;
  onSave: (patch: Partial<Region>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(region.name);
  const [slug, setSlug] = useState(region.slug);
  const dirty = name !== region.name || slug !== region.slug;

  useEffect(() => {
    setName(region.name);
    setSlug(region.slug);
  }, [region.id, region.name, region.slug]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[60px_1fr_1fr_200px] gap-4 items-center px-6 py-4 hover:bg-gray-50 transition-colors group">
      <div className="text-xs text-gray-400 font-mono">#{region.id}</div>
      
      <div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none hover:border-gray-300 py-1 transition-colors text-gray-900 font-medium"
        />
      </div>

      <div>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none hover:border-gray-300 py-1 transition-colors text-gray-600 font-mono text-sm"
        />
      </div>

      <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        {dirty && (
          <button
            onClick={() => onSave({ name: name.trim(), slug: slug.trim() })}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm"
          >
            Сохранить
          </button>
        )}
        <button
          onClick={onDelete}
          className="px-3 py-1.5 text-red-600 hover:bg-red-50 text-sm font-medium rounded-md transition-colors"
        >
          Удалить
        </button>
      </div>
    </div>
  );
}