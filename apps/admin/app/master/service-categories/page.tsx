// apps/admin/app/master/service-categories/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

import "react-quill/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill"), {
  ssr: false,
  loading: () => <p>Загрузка редактора...</p>,
});

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

const PUBLIC_SITE =
  (process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "").replace(/\/+$/, "") ||
  "https://moydompro.ru";

// --- Types ---

type Id = number;

type Region = { id: Id; slug: string; name: string };

type ServiceCategory = {
  id: Id;
  slug: string;
  name: string;
  parent_id: Id | null;
  sort_order?: number | null;
  is_active?: boolean | null;
  image_url?: string | null;
  image_thumb_url?: string | null;
  seo_h1?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_text?: string | null;
  depth?: number;
  path_name?: string;
};

type RegionSeo = {
  id?: Id;
  region_id: Id;
  category_id: Id;
  seo_h1: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_text: string | null;
};

type SeoMode = "base" | "override";
type SeoTone = "neutral" | "selling" | "technical";

// --- Helpers ---

async function apiJson(url: string, init?: RequestInit) {
  const r = await fetch(url, { credentials: "include", ...init });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
  return j;
}

function toPublicUploadsUrl(u?: string | null) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/uploads/")) return `${PUBLIC_SITE}${s}`;
  if (s.startsWith("uploads/")) return `${PUBLIC_SITE}/${s}`;
  if (s.startsWith("//")) return `https:${s}`;
  return s;
}

function toBigOnlyUrl(u?: string | null) {
  const abs = toPublicUploadsUrl(u);
  if (!abs) return "";
  return abs.replace(/-70x50\.webp$/i, ".webp");
}

function clean(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

// --- Main Component ---

export default function MasterServiceCategoriesPage() {
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<Region[]>([]);
  const [cats, setCats] = useState<ServiceCategory[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [newCat, setNewCat] = useState<{
    name: string;
    slug: string;
    parent_id: number | "";
    sort_order: number;
    is_active: boolean;
  }>({
    name: "",
    slug: "",
    parent_id: "",
    sort_order: 0,
    is_active: true,
  });

  const [baseSeo, setBaseSeo] = useState({
    seo_h1: "",
    seo_title: "",
    seo_description: "",
    seo_text: "",
  });
  const [baseSaving, setBaseSaving] = useState(false);
  const [baseMeta, setBaseMeta] = useState({ name: "" });
  const [baseMetaDirty, setBaseMetaDirty] = useState(false);

  const [ovr, setOvr] = useState<RegionSeo | null>(null);
  const [ovrLoading, setOvrLoading] = useState(false);
  const [ovrSaving, setOvrSaving] = useState(false);

  const [seoAssistantOpen, setSeoAssistantOpen] = useState(false);
  const [seoMode, setSeoMode] = useState<SeoMode>("base");
  const [seoTone, setSeoTone] = useState<SeoTone>("neutral");
  const [seoLoading, setSeoLoading] = useState(false);

  const selectedCat = useMemo(
    () => cats.find((c) => c.id === selectedCatId) || null,
    [cats, selectedCatId]
  );

  const selectedRegion = useMemo(
    () => regions.find((r) => r.id === selectedRegionId) || null,
    [regions, selectedRegionId]
  );

  async function loadData(keepSelectedId?: number | null, keepRegionId?: number | null) {
    try {
      setLoading(true);
      const [r1, r2] = await Promise.all([
        apiJson(`${API}/admin/regions`),
        apiJson(`${API}/admin/service-categories?flat=1`),
      ]);

      // ✅ FIX: Явно указываем тип Region[]
      const regionList: Region[] = Array.isArray(r1?.items) ? r1.items : Array.isArray(r1?.result) ? r1.result : [];
      setRegions(regionList);

      const list: ServiceCategory[] = Array.isArray(r2?.result) ? r2.result : Array.isArray(r2?.items) ? r2.items : [];
      list.sort((a, b) => {
        const ao = Number(a.sort_order ?? 100);
        const bo = Number(b.sort_order ?? 100);
        if (ao !== bo) return ao - bo;
        return String(a.path_name || a.name).localeCompare(String(b.path_name || b.name), "ru");
      });
      setCats(list);

      const nextSelectedId = keepSelectedId ?? selectedCatId;
      if (nextSelectedId && list.some((c) => c.id === nextSelectedId)) {
        setSelectedCatId(nextSelectedId);
      } else if (list.length) {
        setSelectedCatId(list[0].id);
      } else {
        setSelectedCatId(null);
      }

      const nextRegionId = keepRegionId ?? selectedRegionId;
      if (nextRegionId && regionList.some((r) => r.id === nextRegionId)) {
        setSelectedRegionId(nextRegionId);
      } else if (regionList.length) {
        setSelectedRegionId(regionList[0].id);
      } else {
        setSelectedRegionId(null);
      }
    } catch (e) {
      alert(`Ошибка загрузки: ${(e as any)?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedCat) {
      setBaseSeo({
        seo_h1: String(selectedCat.seo_h1 ?? ""),
        seo_title: String(selectedCat.seo_title ?? ""),
        seo_description: String(selectedCat.seo_description ?? ""),
        seo_text: String(selectedCat.seo_text ?? ""),
      });
      setBaseMeta({ name: String(selectedCat.name ?? "") });
      setBaseMetaDirty(false);
    }
  }, [selectedCatId, selectedCat]);

  useEffect(() => {
    (async () => {
      if (!selectedCatId || !selectedRegionId) return;
      try {
        setOvrLoading(true);
        const j = await apiJson(`${API}/admin/service-category-region-seo?region_id=${selectedRegionId}&category_id=${selectedCatId}`);
        const item = j?.item || null;
        setOvr(item ? {
          id: item.id,
          region_id: item.region_id,
          category_id: item.category_id,
          seo_h1: item.seo_h1 ?? null,
          seo_title: item.seo_title ?? null,
          seo_description: item.seo_description ?? null,
          seo_text: item.seo_text ?? null,
        } : {
          region_id: selectedRegionId,
          category_id: selectedCatId,
          seo_h1: null,
          seo_title: null,
          seo_description: null,
          seo_text: null,
        });
      } catch (e) {
        alert(`Ошибка загрузки override: ${(e as any)?.message || e}`);
      } finally {
        setOvrLoading(false);
      }
    })();
  }, [selectedCatId, selectedRegionId]);

  async function saveBaseSeo() {
    if (!selectedCatId) return;
    try {
      setBaseSaving(true);
      const payload = {
        seo_h1: clean(baseSeo.seo_h1),
        seo_title: clean(baseSeo.seo_title),
        seo_description: clean(baseSeo.seo_description),
        seo_text: clean(baseSeo.seo_text),
      };
      const j = await apiJson(`${API}/admin/service-categories/${selectedCatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (j?.item?.id) {
        setCats((prev) => prev.map((c) => (c.id === j.item.id ? { ...c, ...j.item } : c)));
        alert("Базовое SEO сохранено");
      }
    } catch (e) {
      alert(`Ошибка сохранения: ${(e as any)?.message || e}`);
    } finally {
      setBaseSaving(false);
    }
  }

  async function saveBaseMeta() {
    if (!selectedCatId) return;
    if (!baseMeta.name.trim()) {
      alert("Укажите название категории");
      return;
    }
    try {
      setBaseSaving(true);
      const payload = { name: clean(baseMeta.name) };
      const j = await apiJson(`${API}/admin/service-categories/${selectedCatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (j?.item?.id) {
        setCats((prev) => prev.map((c) => (c.id === j.item.id ? { ...c, ...j.item } : c)));
        setBaseMeta({ name: String(j.item.name ?? "") });
        setBaseMetaDirty(false);
        alert("Название обновлено");
      }
    } catch (e) {
      alert(`Ошибка сохранения: ${(e as any)?.message || e}`);
    } finally {
      setBaseSaving(false);
    }
  }

  async function saveOverride() {
    if (!ovr || !selectedCatId || !selectedRegionId) return;
    try {
      setOvrSaving(true);
      const payload = {
        region_id: selectedRegionId,
        category_id: selectedCatId,
        seo_h1: clean(ovr.seo_h1),
        seo_title: clean(ovr.seo_title),
        seo_description: clean(ovr.seo_description),
        seo_text: clean(ovr.seo_text),
      };
      const j = await apiJson(`${API}/admin/service-category-region-seo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (j?.item?.id) {
        setOvr(j.item);
        alert("Региональный override сохранен");
      }
    } catch (e) {
      alert(`Ошибка сохранения: ${(e as any)?.message || e}`);
    } finally {
      setOvrSaving(false);
    }
  }

  async function deleteOverride() {
    if (!selectedCatId || !selectedRegionId) return;
    if (!confirm("Удалить региональный override?")) return;
    try {
      setOvrSaving(true);
      await apiJson(`${API}/admin/service-category-region-seo?region_id=${selectedRegionId}&category_id=${selectedCatId}`, { method: "DELETE" });
      setOvr({ region_id: selectedRegionId, category_id: selectedCatId, seo_h1: null, seo_title: null, seo_description: null, seo_text: null });
      alert("Override удален");
    } catch (e) {
      alert(`Ошибка удаления: ${(e as any)?.message || e}`);
    } finally {
      setOvrSaving(false);
    }
  }

  async function uploadCategoryImage(file: File) {
    if (!selectedCatId) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API}/admin/service-categories/${selectedCatId}/image`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok || !raw?.ok) throw new Error(raw?.error || "Ошибка загрузки");
    setCats((prev) => prev.map((c) => (c.id === selectedCatId ? { ...c, ...raw.item } : c)));
  }

  async function createCategory() {
    try {
      if (!newCat.name.trim() || !newCat.slug.trim()) {
        alert("Укажите название и slug");
        return;
      }
      const payload = {
        name: newCat.name.trim(),
        slug: newCat.slug.trim(),
        parent_id: newCat.parent_id === "" ? null : Number(newCat.parent_id),
        sort_order: Number(newCat.sort_order || 0),
        is_active: !!newCat.is_active,
      };
      const j = await apiJson(`${API}/admin/service-categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setNewCat({ name: "", slug: "", parent_id: "", sort_order: 0, is_active: true });
      await loadData(j?.item?.id ?? selectedCatId, selectedRegionId);
      alert("Категория добавлена");
    } catch (e) {
      alert(`Ошибка: ${(e as any)?.message || e}`);
    }
  }

  async function setCategoryActive(nextActive: boolean) {
    if (!selectedCatId) return;
    if (!confirm(nextActive ? "Включить категорию?" : "Отключить категорию?")) return;
    try {
      const j = await apiJson(`${API}/admin/service-categories/${selectedCatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextActive }),
      });
      if (j?.item?.id) {
        setCats((prev) => prev.map((c) => (c.id === j.item.id ? { ...c, ...j.item } : c)));
      }
    } catch (e) {
      alert(`Ошибка: ${(e as any)?.message || e}`);
    }
  }

  async function deleteCategory() {
    if (!selectedCatId) return;
    if (!confirm("Удалить категорию? Это действие необратимо.")) return;
    try {
      await apiJson(`${API}/admin/service-categories/${selectedCatId}`, {
        method: "DELETE",
      });
      await loadData(null, selectedRegionId);
    } catch (e) {
      alert(`Ошибка: ${(e as any)?.message || e}`);
    }
  }

  async function generateSeoWithAssistant() {
    if (!selectedCat) return;
    if (seoMode === "override" && !selectedRegion) return alert("Выбери регион");
    try {
      setSeoLoading(true);
      const res = await apiJson(`${API}/admin/seo/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "service_category",
          name: selectedCat.name,
          slug: selectedCat.slug,
          mode: seoMode,
          tone: seoTone,
          region: seoMode === "override" ? { id: selectedRegion!.id, name: selectedRegion!.name, slug: selectedRegion!.slug } : null,
        }),
      });
      const data = res?.item || res;
      const next = { seo_h1: data?.h1 || "", seo_title: data?.title || "", seo_description: data?.description || "", seo_text: data?.seo_text || "" };
      if (seoMode === "base") setBaseSeo(next);
      else setOvr(p => p ? { ...p, seo_h1: clean(next.seo_h1), seo_title: clean(next.seo_title), seo_description: clean(next.seo_description), seo_text: clean(next.seo_text) } : p);
      setSeoAssistantOpen(false);
    } catch (e) {
      alert(`Ошибка генерации: ${(e as any)?.message || e}`);
    } finally {
      setSeoLoading(false);
    }
  }

  if (loading) return <div className="p-8 text-gray-500 animate-pulse">Загрузка структуры данных...</div>;

  const bigPreviewUrl = selectedCat ? toBigOnlyUrl(selectedCat.image_url || selectedCat.image_thumb_url) : "";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 p-6 min-h-screen bg-gray-50">
      {/* Sidebar List */}
      <aside className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-120px)]">
        <div className="p-4 border-b border-gray-100 font-bold text-gray-800 flex justify-between items-center">
          <span>Категории услуг</span>
          <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-500">{cats.length}</span>
        </div>
        <div className="border-b border-gray-100 p-4 space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
            Новая категория
          </div>
          <input
            value={newCat.name}
            onChange={(e) => setNewCat((p) => ({ ...p, name: e.target.value }))}
            placeholder="Название"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 ring-indigo-500/20"
          />
          <input
            value={newCat.slug}
            onChange={(e) => setNewCat((p) => ({ ...p, slug: e.target.value }))}
            placeholder="Slug"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 ring-indigo-500/20 font-mono"
          />
          <select
            value={newCat.parent_id}
            onChange={(e) =>
              setNewCat((p) => ({
                ...p,
                parent_id: e.target.value ? Number(e.target.value) : "",
              }))
            }
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 ring-indigo-500/20 bg-white"
          >
            <option value="">Без родителя</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.path_name || c.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={String(newCat.sort_order)}
              onChange={(e) =>
                setNewCat((p) => ({ ...p, sort_order: Number(e.target.value || 0) }))
              }
              placeholder="Сортировка"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 ring-indigo-500/20"
            />
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={newCat.is_active}
                onChange={(e) => setNewCat((p) => ({ ...p, is_active: e.target.checked }))}
              />
              Активна
            </label>
          </div>
          <button
            onClick={createCategory}
            className="w-full px-4 py-2 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors"
          >
            Добавить
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {cats.map((c) => {
            const active = c.id === selectedCatId;
            const indent = Math.min(24, (c.depth ?? 0) * 12);
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCatId(c.id)}
                className={`w-full text-left p-3 rounded-xl transition-all border ${
                  active ? "bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm" : "bg-white border-transparent hover:bg-gray-50 text-gray-700"
                }`}
                style={{ marginLeft: `${indent}px`, width: `calc(100% - ${indent}px)` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold truncate">{c.name}</div>
                  {c.is_active === false && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-600">
                      OFF
                    </span>
                  )}
                </div>
                <div className="text-xs opacity-60 truncate font-mono">/{c.slug}</div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Editor Area */}
      <main className="space-y-6 overflow-y-auto pb-20">
        {/* Base SEO Card */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-6">
          <header className="flex justify-between items-start gap-4">
            <div>
              <h1 className="text-2xl font-black text-gray-900">{selectedCat?.name || "—"}</h1>
              <p className="text-sm text-gray-500 font-mono">ID: {selectedCat?.id} • slug: {selectedCat?.slug}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => { setSeoMode("base"); setSeoAssistantOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold hover:bg-indigo-100 transition-colors border border-indigo-100"
              >
                🧠 Помощник
              </button>
              {selectedCat && (
                <>
                  <button
                    onClick={() => setCategoryActive(selectedCat.is_active === false)}
                    className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                  >
                    {selectedCat.is_active === false ? "Включить" : "Отключить"}
                  </button>
                  <button
                    onClick={deleteCategory}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors border border-red-100"
                  >
                    Удалить
                  </button>
                </>
              )}
              <button
                onClick={saveBaseMeta}
                disabled={!baseMetaDirty || baseSaving}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Сохранить название
              </button>
              <button
                onClick={saveBaseSeo}
                disabled={baseSaving}
                className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50 transition-all shadow-md active:scale-95"
              >
                {baseSaving ? "Сохранение..." : "Сохранить базу"}
              </button>
            </div>
          </header>

          <div className="grid gap-4 md:grid-cols-2">
            <InputField
              label="Название категории"
              value={baseMeta.name}
              onChange={(v) => {
                setBaseMeta((p) => ({ ...p, name: v }));
                setBaseMetaDirty(true);
              }}
            />
          </div>

          {/* Image Block */}
          {selectedCat && (
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">Изображение</span>
                <label className="cursor-pointer text-xs font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-4">
                  Загрузить новое
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadCategoryImage(e.target.files[0])} />
                </label>
              </div>
              <div className="flex flex-wrap gap-6 items-end">
                <div className="space-y-2">
                  <div className="text-[10px] text-gray-400 font-bold uppercase">Превью (70x50)</div>
                  <div className="w-[70px] h-[50px] rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                    <img src={toPublicUploadsUrl(selectedCat.image_thumb_url) || "/images/product-placeholder.png"} className="w-full h-full object-cover" alt="thumb" />
                  </div>
                </div>
                <div className="space-y-2 flex-1 min-w-[240px]">
                  <div className="text-[10px] text-gray-400 font-bold uppercase">Основное (Big)</div>
                  <div className="h-[90px] w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm relative group">
                    <img src={toPublicUploadsUrl(selectedCat.image_url) || "/images/product-placeholder.png"} className="w-full h-full object-cover" alt="big" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 text-center text-[10px] text-white">
                      {bigPreviewUrl}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200 font-mono text-[10px] text-gray-500 break-all select-all">
                {bigPreviewUrl || "URL не сформирован"}
              </div>
            </div>
          )}

          {/* Base SEO Fields */}
          <div className="grid gap-5">
            <InputField label="SEO H1" value={baseSeo.seo_h1} onChange={(v) => setBaseSeo(p => ({ ...p, seo_h1: v }))} />
            <InputField label="SEO Title" value={baseSeo.seo_title} onChange={(v) => setBaseSeo(p => ({ ...p, seo_title: v }))} />
            <TextareaField label="Meta Description" rows={3} value={baseSeo.seo_description} onChange={(v) => setBaseSeo(p => ({ ...p, seo_description: v }))} />
            <RichTextField label="SEO Текст (HTML)" value={baseSeo.seo_text} onChange={(v) => setBaseSeo(p => ({ ...p, seo_text: v }))} />
          </div>
        </section>

        {/* Regional Override Card */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-6">
          <header className="flex flex-wrap justify-between items-center gap-4">
            <h2 className="text-xl font-black text-gray-900">Региональные перекрытия (Overrides)</h2>
            <div className="flex gap-3 items-center">
              <select
                value={selectedRegionId ?? ""}
                onChange={(e) => setSelectedRegionId(Number(e.target.value))}
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:ring-2 ring-indigo-500/20"
              >
                {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button
                onClick={() => { setSeoMode("override"); setSeoAssistantOpen(true); }}
                className="p-2 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-colors"
                title="AI Override"
              >
                🧠
              </button>
              <button
                onClick={saveOverride}
                disabled={ovrSaving || !selectedRegionId}
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-md active:scale-95 transition-all text-sm"
              >
                Сохранить для {selectedRegion?.name || "региона"}
              </button>
              {ovr?.id && (
                <button
                  onClick={deleteOverride}
                  className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors text-sm border border-red-100"
                >
                  Сбросить
                </button>
              )}
            </div>
          </header>

          {ovrLoading ? (
            <div className="py-12 text-center text-gray-400 italic">Синхронизация региональных данных...</div>
          ) : (
            <div className="grid gap-5">
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl text-xs font-bold text-amber-700 uppercase">
                {ovr?.id ? "🟢 Настроен уникальный текст для региона" : "⚪️ Используется базовое SEO"}
              </div>
              <InputField label="Override H1" value={ovr?.seo_h1 || ""} onChange={(v) => setOvr(p => p ? { ...p, seo_h1: v } : p)} />
              <InputField label="Override Title" value={ovr?.seo_title || ""} onChange={(v) => setOvr(p => p ? { ...p, seo_title: v } : p)} />
              <TextareaField label="Override Description" rows={3} value={ovr?.seo_description || ""} onChange={(v) => setOvr(p => p ? { ...p, seo_description: v } : p)} />
              <RichTextField label="Override SEO Текст" value={ovr?.seo_text || ""} onChange={(v) => setOvr(p => p ? { ...p, seo_text: v } : p)} />
            </div>
          )}
        </section>
      </main>

      {/* SEO Assistant Modal */}
      {seoAssistantOpen && (
        <div className="fixed inset-0 z-[999] bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
              <h3 className="text-xl font-black text-indigo-900 flex items-center gap-2">🧠 SEO-помощник</h3>
              <button onClick={() => setSeoAssistantOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">✕</button>
            </div>
            <div className="p-6 space-y-6">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-1 text-sm">
                <div className="text-gray-400 uppercase text-[10px] font-black">Контекст</div>
                <div className="font-bold text-gray-800">Категория: {selectedCat?.name}</div>
                {seoMode === "override" && <div className="font-bold text-indigo-600">Регион: {selectedRegion?.name}</div>}
              </div>

              <div className="grid gap-4">
                <label className="space-y-2">
                  <div className="text-xs font-bold text-gray-500 uppercase">Режим генерации</div>
                  <select
                    value={seoMode}
                    onChange={(e) => setSeoMode(e.target.value as SeoMode)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 ring-indigo-500/20"
                  >
                    <option value="base">Базовое SEO (общие фразы)</option>
                    <option value="override">Региональное SEO (с привязкой к городу)</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <div className="text-xs font-bold text-gray-500 uppercase">Тональность текста</div>
                  <select
                    value={seoTone}
                    onChange={(e) => setSeoTone(e.target.value as SeoTone)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 ring-indigo-500/20"
                  >
                    <option value="neutral">Нейтральная (информативная)</option>
                    <option value="selling">Продающая (акцент на выгодах)</option>
                    <option value="technical">Техническая (акцент на деталях)</option>
                  </select>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setSeoAssistantOpen(false)} className="flex-1 px-6 py-3 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-colors">Отмена</button>
                <button
                  onClick={generateSeoWithAssistant}
                  disabled={seoLoading}
                  className="flex-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {seoLoading ? "Думаю..." : "Сгенерировать текст"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Small UI Components ---

function InputField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-2">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-4 ring-indigo-50 transition-all text-gray-800 font-medium"
      />
    </label>
  );
}

function TextareaField({ label, value, onChange, rows }: { label: string; value: string; onChange: (v: string) => void; rows: number }) {
  return (
    <label className="block space-y-2">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</div>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-4 ring-indigo-50 transition-all text-gray-800 font-medium resize-none"
      />
    </label>
  );
}

function RichTextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-2">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-inner">
        <ReactQuill
          theme="snow"
          value={value}
          onChange={(val: string) => onChange(val)}
          className="min-h-[240px]"
          placeholder="Введите SEO-текст..."
        />
      </div>
    </label>
  );
}
