// apps/admin/app/master/blog-posts/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

type PostRow = {
  id: number;
  slug: string;
  title: string;
  category_name: string | null;
  is_published: boolean;
  published_at: string | null;
  updated_at: string | null;
};

export default function MasterBlogPosts() {
  const [items, setItems] = useState<PostRow[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setErr("");
      setLoading(true);
      const r = await fetch(`${API}/master/blog-posts`, { credentials: "include" });
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

  async function togglePublish(p: PostRow) {
    try {
      const r = await fetch(`${API}/master/blog-posts/${p.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: !p.is_published }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) return alert(j.error || "save_failed");
      load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function del(id: number) {
    if (!confirm("Удалить статью?")) return;
    try {
      const r = await fetch(`${API}/master/blog-posts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) return alert(j.error || "delete_failed");
      load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Журнал — статьи</h1>
        <Link 
          href="/master/blog-posts/new" 
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm shadow-blue-100 transition-all active:scale-95 text-sm"
        >
          <span className="mr-2">+</span> Новая статья
        </Link>
      </div>

      {err && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
          Ошибка: {err}
        </div>
      )}

      {/* TABLE CONTAINER */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 animate-pulse font-medium">
            Загрузка списка статей...
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-[70px_1fr_200px_140px_220px] gap-4 px-6 py-4 bg-gray-50/50 border-b border-gray-100 text-[11px] font-black text-gray-400 uppercase tracking-widest">
              <div>ID</div>
              <div>Контент</div>
              <div>Категория</div>
              <div>Статус</div>
              <div className="text-right">Управление</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-gray-100">
              {items.map((p) => (
                <div 
                  key={p.id} 
                  className="grid grid-cols-1 md:grid-cols-[70px_1fr_200px_140px_220px] gap-4 px-6 py-5 items-center hover:bg-blue-50/30 transition-colors group"
                >
                  <div className="text-xs font-mono text-gray-400">#{p.id}</div>

                  <div className="min-w-0">
                    <Link 
                      href={`/master/blog-posts/${p.id}`} 
                      className="block font-bold text-gray-900 hover:text-blue-600 transition-colors truncate"
                    >
                      {p.title}
                    </Link>
                    <div className="text-[11px] text-gray-400 font-mono mt-1 truncate">
                      /journal/{p.slug}
                    </div>
                  </div>

                  <div className="text-sm">
                    {p.category_name ? (
                      <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg font-medium">
                        {p.category_name}
                      </span>
                    ) : (
                      <span className="text-gray-300 italic">—</span>
                    )}
                  </div>

                  <div>
                    <StatusBadge published={p.is_published} date={p.published_at} />
                  </div>

                  <div className="flex items-center justify-end gap-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => togglePublish(p)} 
                      className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all border ${
                        p.is_published 
                          ? "bg-white text-gray-600 border-gray-200 hover:bg-gray-50" 
                          : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-sm"
                      }`}
                    >
                      {p.is_published ? "Снять" : "В эфир"}
                    </button>
                    <button 
                      onClick={() => del(p.id)} 
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Удалить"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {items.length === 0 && (
              <div className="p-20 text-center text-gray-400 font-medium">
                Статей пока нет. Создайте первую!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Вспомогательные компоненты ---

function StatusBadge({ published, date }: { published: boolean; date: string | null }) {
  if (!published) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-500">
        Черновик
      </span>
    );
  }

  const isScheduled = date && new Date(date).getTime() > Date.now();

  if (isScheduled) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-700">
        Запланировано
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-green-100 text-green-700 border border-green-200">
      Опубликовано
    </span>
  );
}