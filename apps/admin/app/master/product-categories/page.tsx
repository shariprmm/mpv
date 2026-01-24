// apps/admin/app/master/product-categories/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

const PUBLIC_SITE =
  (process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "").replace(/\/+$/, "") ||
  "https://moydompro.ru";

type IdLike = number;

type Region = { id: IdLike; slug: string; name: string };

type ProductCategory = {
  id: IdLike;
  slug: string;
  name: string;
  parent_id: IdLike | null;
  sort_order: number | null;
  is_active?: boolean;

  image_url?: string | null;
  image_thumb_url?: string | null;

  seo_h1?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_text?: string | null;

  // computed (from flat list)
  depth?: number;
  path_name?: string;
};

type RegionSeo = {
  id: IdLike;
  region_id: IdLike;
  category_id: IdLike;
  seo_h1: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_text: string | null;
};

// --- Helpers ---

async function apiJson<T>(
  url: string,
  opts: RequestInit = {}
): Promise<{ ok: boolean; data: T; raw: any }> {
  const res = await fetch(url, {
    ...opts,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    cache: "no-store",
  });

  const raw = await res.json().catch(() => ({}));
  if (!res.ok || !raw?.ok) {
    const msg =
      raw?.error ||
      raw?.message ||
      `HTTP ${res.status} ${res.statusText || ""}`.trim();
    throw new Error(msg);
  }
  return { ok: true, data: raw as T, raw };
}

function toPublicUploadsUrl(u?: string | null) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/uploads/")) return `${PUBLIC_SITE}${s}`;
  if (s.startsWith("uploads/")) return `${PUBLIC_SITE}/${s}`;
  return s;
}

function LenBadge({ v, max }: { v: string; max: number }) {
  const n = v.length;
  const warn = n > max;
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
        warn ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
      }`}
      title={`${n}/${max}`}
    >
      {n}/{max}
    </span>
  );
}

// ✅ Tailwind-only class tokens (вместо <style jsx global> + @apply)
const inputBase =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-all " +
  "placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

const btnPrimary =
  "rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all " +
  "hover:bg-gray-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50";

const btnSecondary =
  "rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-all " +
  "hover:bg-gray-50 active:scale-95";

const btnGhost =
  "rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-all hover:bg-gray-100";

const btnDanger =
  "rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-all " +
  "hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50";

// --- Components ---

export default function MasterProductCategoriesPage() {
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<Region[]>([]);
  const [cats, setCats] = useState<ProductCategory[]>([]);

  const [q, setQ] = useState("");
  const [selectedCatId, setSelectedCatId] = useState<IdLike | null>(null);

  // Tabs
  const [tab, setTab] = useState<"base" | "region">("base");

  // Base Editor State
  const [baseForm, setBaseForm] = useState({
    name: "",
    slug: "",
    seo_h1: "",
    seo_title: "",
    seo_description: "",
    seo_text: "",
  });
  const [baseDirty, setBaseDirty] = useState(false);

  // Region Editor State
  const [selectedRegionId, setSelectedRegionId] = useState<IdLike | "">("");
  const [regionSeo, setRegionSeo] = useState({
    seo_h1: "",
    seo_title: "",
    seo_description: "",
    seo_text: "",
  });
  const [regionDirty, setRegionDirty] = useState(false);
  const [regionSeoExists, setRegionSeoExists] = useState(false);

  const selectedCat = useMemo(
    () => cats.find((c) => c.id === selectedCatId) || null,
    [cats, selectedCatId]
  );

  const filteredCats = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return cats;
    return cats.filter((c) => {
      const hay = `${c.name} ${c.slug} ${c.path_name || ""}`.toLowerCase();
      return hay.includes(term);
    });
  }, [cats, q]);

  // Load Data
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [rRegions, rCats] = await Promise.all([
          apiJson<{ ok: true; items: Region[] }>(`${API}/admin/regions`),
          apiJson<{ ok: true; result: ProductCategory[] }>(
            `${API}/admin/product-categories?flat=1`
          ),
        ]);

        const items = (rRegions.raw.items || rRegions.raw.result || []) as Region[];
        setRegions(items);

        const catRows = (rCats.raw.result || []) as ProductCategory[];
        const byId = new Map<number, ProductCategory>();
        catRows.forEach((c) => byId.set(c.id, c));

        function computePath(id: number): string {
          const node = byId.get(id);
          if (!node) return "";
          const parts: string[] = [];
          let cur: ProductCategory | undefined = node;
          let guard = 0;
          while (cur && guard++ < 50) {
            parts.unshift(cur.name);
            cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
          }
          return parts.join(" → ");
        }

        const withMeta = catRows.map((c) => {
          const path_name = c.path_name || computePath(c.id);
          const depth = path_name ? path_name.split(" → ").length - 1 : 0;
          return { ...c, path_name, depth };
        });

        withMeta.sort((a, b) =>
          (a.path_name || "").localeCompare(b.path_name || "", "ru")
        );
        setCats(withMeta);

        if (!selectedCatId && withMeta.length) {
          setSelectedCatId(withMeta[0].id);
        }
      } catch (e: any) {
        alert(`Ошибка загрузки: ${e?.message || e}`);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync Base Form
  useEffect(() => {
    if (!selectedCat) return;
    setBaseForm({
      name: selectedCat.name || "",
      slug: selectedCat.slug || "",
      seo_h1: selectedCat.seo_h1 || "",
      seo_title: selectedCat.seo_title || "",
      seo_description: selectedCat.seo_description || "",
      seo_text: selectedCat.seo_text || "",
    });
    setBaseDirty(false);

    setRegionSeo({ seo_h1: "", seo_title: "", seo_description: "", seo_text: "" });
    setRegionDirty(false);
    setRegionSeoExists(false);
  }, [selectedCatId, selectedCat]);

  // Load Region SEO
  useEffect(() => {
    (async () => {
      if (!selectedCatId || !selectedRegionId || selectedRegionId == null) return;
      try {
        const url =
          `${API}/admin/product-category-region-seo?region_id=${selectedRegionId}` +
          `&category_id=${selectedCatId}`;
        const r = await apiJson<{ ok: true; item: RegionSeo | null }>(url);

        const item = (r.raw.item || null) as RegionSeo | null;
        setRegionSeoExists(!!item);
        setRegionSeo({
          seo_h1: item?.seo_h1 || "",
          seo_title: item?.seo_title || "",
          seo_description: item?.seo_description || "",
          seo_text: item?.seo_text || "",
        });
        setRegionDirty(false);
      } catch (e: any) {
        console.error(e);
        setRegionSeoExists(false);
        setRegionSeo({ seo_h1: "", seo_title: "", seo_description: "", seo_text: "" });
        setRegionDirty(false);
      }
    })();
  }, [selectedCatId, selectedRegionId]);

  // Handlers
  async function saveBaseSeo() {
    if (!selectedCatId) return;
    try {
      const body = {
        name: baseForm.name,
        slug: baseForm.slug,
        seo_h1: baseForm.seo_h1 || null,
        seo_title: baseForm.seo_title || null,
        seo_description: baseForm.seo_description || null,
        seo_text: baseForm.seo_text || null,
      };

      const r = await apiJson<{ ok: true; item: ProductCategory }>(
        `${API}/admin/product-categories/${selectedCatId}`,
        { method: "PATCH", body: JSON.stringify(body) }
      );

      const updated = r.raw.item as ProductCategory;
      const old = cats.find((c) => c.id === selectedCatId);
      setCats((prev) =>
        prev.map((c) =>
          c.id === selectedCatId
            ? { ...c, ...updated, depth: old?.depth, path_name: old?.path_name }
            : c
        )
      );
      setBaseDirty(false);
      alert("Сохранено!");
    } catch (e: any) {
      alert(`Ошибка: ${e?.message || e}`);
    }
  }

  async function saveRegionSeo() {
    if (!selectedCatId || !selectedRegionId) return;
    try {
      const body = {
        region_id: Number(selectedRegionId),
        category_id: Number(selectedCatId),
        seo_h1: regionSeo.seo_h1 || null,
        seo_title: regionSeo.seo_title || null,
        seo_description: regionSeo.seo_description || null,
        seo_text: regionSeo.seo_text || null,
      };

      await apiJson(`${API}/admin/product-category-region-seo`, {
        method: "PUT",
        body: JSON.stringify(body),
      });

      setRegionSeoExists(true);
      setRegionDirty(false);
      alert("Региональные настройки сохранены");
    } catch (e: any) {
      alert(`Ошибка: ${e?.message || e}`);
    }
  }

  async function resetRegionOverride() {
    if (!selectedCatId || !selectedRegionId) return;
    if (!confirm("Сбросить региональные настройки?")) return;

    try {
      const url =
        `${API}/admin/product-category-region-seo?region_id=${selectedRegionId}` +
        `&category_id=${selectedCatId}`;
      await apiJson(url, { method: "DELETE" });

      setRegionSeoExists(false);
      setRegionSeo({ seo_h1: "", seo_title: "", seo_description: "", seo_text: "" });
      setRegionDirty(false);
    } catch (e: any) {
      alert(`Ошибка: ${e?.message || e}`);
    }
  }

  async function uploadCategoryImage(file: File) {
    if (!selectedCatId) return;
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch(`${API}/admin/product-categories/${selectedCatId}/image`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });

    const raw = await res.json().catch(() => ({}));
    if (!res.ok || !raw?.ok) {
      throw new Error(raw?.error || raw?.message || `HTTP ${res.status}`);
    }

    const updated = raw.item as ProductCategory;
    const old = cats.find((c) => c.id === selectedCatId);
    setCats((prev) =>
      prev.map((c) =>
        c.id === selectedCatId
          ? { ...c, ...updated, depth: old?.depth, path_name: old?.path_name }
          : c
      )
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Категории товаров <span className="font-normal text-gray-400">/ SEO</span>
        </h1>
        <div className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-400">
          API: {API}
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse rounded-xl bg-gray-50 p-12 text-center text-gray-400">
          Загрузка структуры категорий...
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[380px_1fr]">
          {/* LEFT: LIST */}
          <div className="flex h-[80vh] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 bg-gray-50/50 p-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="🔍 Поиск категории..."
                className={inputBase}
              />
            </div>

            <div className="flex-1 divide-y divide-gray-50 overflow-y-auto">
              {filteredCats.map((c) => {
                const active = c.id === selectedCatId;
                const indent = Math.min(6, c.depth || 0) * 16;

                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCatId(c.id)}
                    className={[
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      active
                        ? "bg-blue-50 text-blue-900"
                        : "text-gray-700 hover:bg-gray-50",
                    ].join(" ")}
                    type="button"
                  >
                    <div style={{ paddingLeft: indent }} className="flex-1 truncate">
                      <div
                        className={[
                          "truncate text-sm",
                          active ? "font-semibold" : "font-medium",
                        ].join(" ")}
                      >
                        {c.name}
                      </div>
                      <div
                        className={[
                          "truncate text-xs font-mono",
                          active ? "text-blue-400" : "text-gray-400",
                        ].join(" ")}
                      >
                        /{c.slug}
                      </div>
                    </div>

                    {c.is_active === false && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-600">
                        OFF
                      </span>
                    )}
                  </button>
                );
              })}

              {filteredCats.length === 0 && (
                <div className="p-6 text-center text-sm text-gray-400">
                  Ничего не найдено
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 bg-gray-50 p-2 text-center text-xs text-gray-400">
              Всего: {filteredCats.length}
            </div>
          </div>

          {/* RIGHT: EDITOR */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {/* Toolbar */}
            <div className="flex flex-col justify-between gap-4 border-b border-gray-100 bg-gray-50/30 px-6 py-4 sm:flex-row sm:items-center">
              <div>
                <div className="max-w-md truncate text-sm font-bold text-gray-900">
                  {selectedCat ? selectedCat.name : "Категория не выбрана"}
                </div>
                <div className="mt-0.5 font-mono text-xs text-gray-400">
                  ID: {selectedCat?.id || "—"}
                </div>
              </div>

              {/* Tabs Pills */}
              <div className="self-start rounded-lg bg-gray-200/50 p-1">
                <button
                  onClick={() => setTab("base")}
                  className={[
                    "rounded-md px-4 py-1.5 text-xs font-medium transition-all",
                    tab === "base"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700",
                  ].join(" ")}
                  type="button"
                >
                  Основные & SEO
                </button>
                <button
                  onClick={() => setTab("region")}
                  className={[
                    "rounded-md px-4 py-1.5 text-xs font-medium transition-all",
                    tab === "region"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700",
                  ].join(" ")}
                  type="button"
                >
                  По регионам
                </button>
              </div>
            </div>

            {/* CONTENT */}
            <div className="p-6">
              {!selectedCat ? (
                <div className="py-12 text-center text-gray-400">
                  Select a category to edit
                </div>
              ) : (
                <>
                  {/* === BASE TAB === */}
                  {tab === "base" && (
                    <div className="max-w-3xl space-y-6">
                      {/* Основные поля */}
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Field label="Название">
                          <input
                            value={baseForm.name}
                            onChange={(e) => {
                              setBaseForm((p) => ({ ...p, name: e.target.value }));
                              setBaseDirty(true);
                            }}
                            className={inputBase}
                          />
                        </Field>

                        <Field label="Slug (URL)">
                          <input
                            value={baseForm.slug}
                            onChange={(e) => {
                              setBaseForm((p) => ({ ...p, slug: e.target.value }));
                              setBaseDirty(true);
                            }}
                            className={`${inputBase} font-mono`}
                          />
                        </Field>
                      </div>

                      {/* Image Upload */}
                      <div className="border-y border-gray-100 py-6">
                        <Field label="Изображение (Cover)">
                          <div className="flex items-start gap-6">
                            <div className="group relative h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={
                                  toPublicUploadsUrl(selectedCat.image_url) ||
                                  "https://placehold.co/400x200?text=No+Image"
                                }
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </div>

                            <div className="flex-1">
                              <label className="inline-block">
                                <span className={`${btnSecondary} cursor-pointer text-xs`}>
                                  Загрузить файл...
                                </span>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*"
                                  onChange={async (e) => {
                                    if (e.target.files?.[0]) {
                                      try {
                                        await uploadCategoryImage(e.target.files[0]);
                                        alert("Фото обновлено!");
                                      } catch (err: any) {
                                        alert("Ошибка: " + err.message);
                                      }
                                    }
                                  }}
                                />
                              </label>

                              <div className="mt-2 text-xs text-gray-400">
                                Рекомендуется WebP, 1000px ширина.
                              </div>
                            </div>
                          </div>
                        </Field>
                      </div>

                      {/* SEO Base */}
                      <div className="space-y-4">
                        <Field label="H1 Заголовок" badge={<LenBadge v={baseForm.seo_h1} max={70} />}>
                          <input
                            value={baseForm.seo_h1}
                            onChange={(e) => {
                              setBaseForm((p) => ({ ...p, seo_h1: e.target.value }));
                              setBaseDirty(true);
                            }}
                            className={inputBase}
                            placeholder="Например: Купить септик в СПб"
                          />
                        </Field>

                        <Field label="SEO Title" badge={<LenBadge v={baseForm.seo_title} max={60} />}>
                          <input
                            value={baseForm.seo_title}
                            onChange={(e) => {
                              setBaseForm((p) => ({ ...p, seo_title: e.target.value }));
                              setBaseDirty(true);
                            }}
                            className={inputBase}
                          />
                        </Field>

                        <Field
                          label="Meta Description"
                          badge={<LenBadge v={baseForm.seo_description} max={160} />}
                        >
                          <textarea
                            value={baseForm.seo_description}
                            onChange={(e) => {
                              setBaseForm((p) => ({ ...p, seo_description: e.target.value }));
                              setBaseDirty(true);
                            }}
                            className={`${inputBase} h-24 resize-y`}
                          />
                        </Field>

                        <Field label="SEO Текст (HTML)">
                          <textarea
                            value={baseForm.seo_text}
                            onChange={(e) => {
                              setBaseForm((p) => ({ ...p, seo_text: e.target.value }));
                              setBaseDirty(true);
                            }}
                            className={`${inputBase} h-40 resize-y font-mono text-sm`}
                            placeholder="<p>Текст описания...</p>"
                          />
                        </Field>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 pt-4">
                        <button
                          onClick={saveBaseSeo}
                          disabled={!baseDirty}
                          className={btnPrimary}
                          type="button"
                        >
                          Сохранить изменения
                        </button>

                        {baseDirty && (
                          <button
                            onClick={() => {
                              setBaseForm({
                                name: selectedCat.name,
                                slug: selectedCat.slug,
                                seo_h1: selectedCat.seo_h1 || "",
                                seo_title: selectedCat.seo_title || "",
                                seo_description: selectedCat.seo_description || "",
                                seo_text: selectedCat.seo_text || "",
                              });
                              setBaseDirty(false);
                            }}
                            className={`${btnGhost} text-red-600`}
                            type="button"
                          >
                            Отмена
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* === REGION TAB === */}
                  {tab === "region" && (
                    <div className="max-w-3xl space-y-6">
                      <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
                        <Field label="Выберите регион для настройки">
                          <select
                            value={selectedRegionId}
                            onChange={(e) =>
                              setSelectedRegionId(e.target.value ? Number(e.target.value) : "")
                            }
                            className={`${inputBase} bg-white`}
                          >
                            <option value="">— Не выбрано —</option>
                            {regions.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>

                      {selectedRegionId !== "" && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-900">
                              Настройки для региона #{selectedRegionId}
                            </h3>
                            <span
                              className={[
                                "rounded border px-2 py-1 text-xs",
                                regionSeoExists
                                  ? "border-green-200 bg-green-50 text-green-700"
                                  : "border-gray-200 bg-gray-50 text-gray-500",
                              ].join(" ")}
                            >
                              {regionSeoExists ? "Активен (Override)" : "Наследует базовые"}
                            </span>
                          </div>

                          <Field label="Региональный H1">
                            <input
                              value={regionSeo.seo_h1}
                              onChange={(e) => {
                                setRegionSeo((p) => ({ ...p, seo_h1: e.target.value }));
                                setRegionDirty(true);
                              }}
                              className={inputBase}
                              placeholder="Оставьте пустым для использования базового"
                            />
                          </Field>

                          <Field label="Региональный Title">
                            <input
                              value={regionSeo.seo_title}
                              onChange={(e) => {
                                setRegionSeo((p) => ({ ...p, seo_title: e.target.value }));
                                setRegionDirty(true);
                              }}
                              className={inputBase}
                            />
                          </Field>

                          <Field label="Региональный Description">
                            <textarea
                              value={regionSeo.seo_description}
                              onChange={(e) => {
                                setRegionSeo((p) => ({ ...p, seo_description: e.target.value }));
                                setRegionDirty(true);
                              }}
                              className={`${inputBase} h-24`}
                            />
                          </Field>

                          <div className="flex items-center gap-3 pt-4">
                            <button
                              onClick={saveRegionSeo}
                              disabled={!regionDirty}
                              className={btnPrimary}
                              type="button"
                            >
                              Сохранить для региона
                            </button>

                            {regionSeoExists && (
                              <button
                                onClick={resetRegionOverride}
                                className={`${btnDanger} ml-auto`}
                                type="button"
                              >
                                Сбросить override
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  badge,
}: {
  label: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold tracking-wide text-gray-500 uppercase">
          {label}
        </span>
        {badge}
      </div>
      {children}
    </label>
  );
}
