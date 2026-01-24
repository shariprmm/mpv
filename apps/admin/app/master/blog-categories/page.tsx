// apps/admin/app/master/blog-categories/page.tsx
"use client";

import React, { useEffect, useState } from "react";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

type Cat = { id: number; slug: string; name: string; sort_order: number };

export default function MasterBlogCategories() {
  const [items, setItems] = useState<Cat[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const [newCat, setNewCat] = useState({ slug: "", name: "", sort_order: 100 });

  async function load() {
    try {
      setErr("");
      setLoading(true);
      const r = await fetch(`${API}/master/blog-categories`, { credentials: "include" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) return setErr(j.error || "load_failed");
      setItems(j.items || []);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create() {
    const r = await fetch(`${API}/master/blog-categories`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCat),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) return alert(j.error || "create_failed");
    setNewCat({ slug: "", name: "", sort_order: 100 });
    load();
  }

  async function save(id: number, patch: Partial<Cat>) {
    const r = await fetch(`${API}/master/blog-categories/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) return alert(j.error || "save_failed");
    alert("Сохранено");
    load();
  }

  async function del(id: number) {
    if (!confirm("Удалить категорию? (у статей станет категория = пусто)")) return;
    const r = await fetch(`${API}/master/blog-categories/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) return alert(j.error || "delete_failed");
    load();
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Журнал — категории</h1>
        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          Всего: {items.length}
        </span>
      </div>

      {err && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
          Ошибка: {err}
        </div>
      )}

      {/* CREATE FORM */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr_140px_140px] gap-4 items-end">
          <label className="block space-y-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Slug</span>
            <input
              placeholder="category-slug"
              value={newCat.slug}
              onChange={(e) => setNewCat({ ...newCat, slug: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Название</span>
            <input
              placeholder="Название категории"
              value={newCat.name}
              onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Сортировка</span>
            <input
              type="number"
              placeholder="100"
              value={String(newCat.sort_order)}
              onChange={(e) => setNewCat({ ...newCat, sort_order: Number(e.target.value || 100) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </label>
          <button
            onClick={create}
            className="px-5 py-2.5 bg-gray-900 text-white font-bold rounded-lg hover:bg-gray-800 active:scale-95 transition-all shadow-sm"
          >
            Добавить
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 animate-pulse">Загрузка категорий...</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-[70px_240px_1fr_140px_220px] gap-4 px-6 py-3 bg-gray-50/50 text-[10px] font-black text-gray-500 uppercase tracking-widest">
              <div>ID</div>
              <div>Slug</div>
              <div>Название</div>
              <div>Сортировка</div>
              <div className="text-right pr-4">Действия</div>
            </div>

            {/* Table Body */}
            {items.map((c) => (
              <Row key={c.id} item={c} onSave={save} onDelete={del} />
            ))}

            {items.length === 0 && (
              <div className="p-12 text-center text-gray-400">Список категорий пуст</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  item,
  onSave,
  onDelete,
}: {
  item: Cat;
  onSave: (id: number, patch: Partial<Cat>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [v, setV] = useState(item);
  const isDirty = v.slug !== item.slug || v.name !== item.name || v.sort_order !== item.sort_order;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[70px_240px_1fr_140px_220px] gap-4 px-6 py-4 items-center hover:bg-gray-50/50 transition-colors group">
      <div className="text-xs font-mono text-gray-400">#{item.id}</div>
      
      <div>
        <input
          value={v.slug}
          onChange={(e) => setV({ ...v, slug: e.target.value })}
          className="w-full bg-transparent border-b border-transparent focus:border-blue-400 focus:outline-none hover:border-gray-200 py-1 transition-colors font-mono text-sm text-gray-600"
        />
      </div>

      <div>
        <input
          value={v.name}
          onChange={(e) => setV({ ...v, name: e.target.value })}
          className="w-full bg-transparent border-b border-transparent focus:border-blue-400 focus:outline-none hover:border-gray-200 py-1 transition-colors font-bold text-gray-900"
        />
      </div>

      <div>
        <input
          type="number"
          value={String(v.sort_order)}
          onChange={(e) => setV({ ...v, sort_order: Number(e.target.value || 100) })}
          className="w-20 bg-transparent border-b border-transparent focus:border-blue-400 focus:outline-none hover:border-gray-200 py-1 transition-colors text-sm text-gray-600"
        />
      </div>

      <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onSave(item.id, { slug: v.slug, name: v.name, sort_order: v.sort_order })}
          disabled={!isDirty}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
            isDirty 
              ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700" 
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          Сохранить
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-md transition-all border border-transparent hover:border-red-100"
        >
          Удалить
        </button>
      </div>
    </div>
  );
}