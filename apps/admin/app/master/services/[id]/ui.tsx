// /opt/moydompro-repo/apps/admin/app/master/services/[id]/ui.tsx
"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

// ✅ Import Quill styles
import "react-quill/dist/quill.snow.css";

// ✅ Load ReactQuill dynamically (no SSR)
const ReactQuill = dynamic(() => import("react-quill"), {
  ssr: false,
  loading: () => <p className="p-4 text-gray-400 italic">Загрузка редактора...</p>,
});

type AnyObj = Record<string, any>;

type ServiceCategory = {
  id: number;
  slug: string;
  name: string;
  parent_id: number | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

// ✅ Domain for images
const IMG_BASE_URL = "https://moydompro.ru";

// --- Helpers ---

function asStr(v: any) {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  return s.trim();
}

function asArr(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => asStr(x)).filter(Boolean);
  if (!v) return [];
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map((x) => asStr(x)).filter(Boolean);
    } catch {}
  }
  return [];
}

function resolveImgSrc(src: string) {
  const s = asStr(src);
  if (!s) return "";
  if (s.includes("https://admin.moydompro.ru")) {
    return s.replace("https://admin.moydompro.ru", IMG_BASE_URL);
  }
  if (s.startsWith("/")) {
    return `${IMG_BASE_URL}${s}`;
  }
  return s;
}

function translitRuToLat(input: string) {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
    й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
    э: "e", ю: "yu", я: "ya",
  };
  return String(input || "").trim().toLowerCase().split("").map((ch) => map[ch] ?? ch).join("");
}

function normalizeSlug(input: string) {
  return String(input || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function slugFromName(name: string) {
  return normalizeSlug(translitRuToLat(name));
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// --- Styles Constants ---
const cardClass = "bg-white border border-gray-200 rounded-2xl p-6 shadow-sm";
const labelClass = "block text-sm font-bold text-gray-700 mb-1.5 ml-1";
const inputClass = "w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all text-sm";
const btnPrimary = "px-6 py-2.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-all active:scale-95 shadow-md shadow-gray-200 text-sm";
const btnSecondary = "px-4 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all active:scale-95 shadow-sm text-xs";
const btnDanger = "px-2 py-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-all uppercase";

// --- Main Component ---

export default function ServiceEditorClient(props: { item: AnyObj; apiBase: string }) {
  const { item, apiBase } = props;

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const [cats, setCats] = useState<ServiceCategory[]>([]);
  const [catsLoading, setCatsLoading] = useState(false);

  const [slugGenBusy, setSlugGenBusy] = useState(false);
  const slugGenTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (slugGenTimerRef.current) clearTimeout(slugGenTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setCatsLoading(true);
      try {
        const r = await fetch(`${apiBase}/admin/service-categories?flat=1`, {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        const j = await r.json().catch(() => null);
        const raw = (j?.result || j?.items || j?.categories || []) as any[];
        const mapped: ServiceCategory[] = Array.isArray(raw)
          ? raw
              .map((c: any) => ({
                id: Number(c?.id || 0),
                slug: String(c?.slug || ""),
                name: String(c?.name || ""),
                parent_id: c?.parent_id == null ? null : Number(c.parent_id),
                sort_order: c?.sort_order == null ? null : Number(c.sort_order),
                is_active: c?.is_active ?? true,
              }))
              .filter((c: ServiceCategory) => c.id > 0 && !!c.name)
          : [];
        if (alive) setCats(mapped);
      } catch {
        if (alive) setCats([]);
      } finally {
        if (alive) setCatsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [apiBase]);

  const initial = useMemo(() => {
    return {
      id: Number(item.id),
      name: asStr(item.name),
      slug: asStr(item.slug),
      category_id: item.category_id ?? null,
      show_on_site: !!item.show_on_site,
      description: asStr(item.description),
      cover_image: asStr(item.cover_image),
      gallery: asArr(item.gallery),
      seo_h1: asStr(item.seo_h1),
      seo_title: asStr(item.seo_title),
      seo_description: asStr(item.seo_description),
      seo_text: asStr(item.seo_text),
    };
  }, [item]);

  const [f, setF] = useState(initial);
  const [newGalleryUrl, setNewGalleryUrl] = useState("");

  async function uploadImage(file: File, prefix: string) {
    const dataUrl = await fileToDataUrl(file);
    const r = await fetch(`${apiBase}/master/upload-image`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, filename: file.name, prefix }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) throw new Error(j?.error || "upload_failed");
    return String(j.url || "");
  }

  function handleGenerateSlug() {
    const nm = asStr(f.name);
    if (!nm) {
      setMsg("Ошибка: заполните название, чтобы сгенерировать slug");
      return;
    }
    const gen = slugFromName(nm);
    if (!gen) {
      setMsg("Ошибка: не удалось сгенерировать slug из названия");
      return;
    }
    setSlugGenBusy(true);
    if (slugGenTimerRef.current) clearTimeout(slugGenTimerRef.current);
    slugGenTimerRef.current = setTimeout(() => setSlugGenBusy(false), 700);
    setF((p) => ({ ...p, slug: gen }));
    setMsg("Slug сгенерирован ✅ (не забудьте нажать «Сохранить»)");
  }

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const body = {
        ...f,
        slug: f.slug ? normalizeSlug(translitRuToLat(f.slug)) : null,
        category_id: f.category_id ? Number(f.category_id) : null,
      };

      const r = await fetch(`${apiBase}/master/services/${f.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error || "save_failed");

      setF((p) => ({
        ...p,
        slug: asStr(j?.item?.slug) || p.slug,
        category_id: j?.item?.category_id ?? undefined,
        show_on_site: j?.item?.show_on_site ?? undefined,
      }));

      setMsg("Сохранено ✅");
    } catch (e: any) {
      setMsg(`Ошибка: ${String(e?.message || e)}`);
    } finally {
      setSaving(false);
    }
  }

  const canGenSlug = !!asStr(f.name) && !slugGenBusy;

  const modules = {
    toolbar: [
      [{ header: [2, 3, false] }],
      ["bold", "italic", "underline"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["clean"],
    ],
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 p-4">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Услуга (каноника)</h1>
            <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-0.5 rounded-full">ID #{f.id}</span>
          </div>
          <p className="text-xs text-gray-400 font-mono mt-1">/{f.slug}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/master/services" className="text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors">← К списку</Link>
          <button onClick={save} disabled={saving} className={btnPrimary}>
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </header>

      {msg && (
        <div className={`p-4 rounded-xl text-sm font-bold border animate-in fade-in slide-in-from-top-2 ${msg.includes('Ошибка') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
          {msg}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8">
        
        {/* Left Column */}
        <div className="space-y-8">
          <section className={cardClass}>
            <h2 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-rose-500 rounded-full"></span>
              Основное
            </h2>

            <div className="space-y-6">
              <div>
                <label className={labelClass}>Название</label>
                <input className={inputClass} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              </div>

              <div>
                <label className={labelClass}>Slug</label>
                <div className="flex gap-2">
                  <input
                    className={`${inputClass} font-mono text-blue-600`}
                    value={f.slug}
                    onChange={(e) => setF({ ...f, slug: e.target.value })}
                    onBlur={() => setF((p) => ({ ...p, slug: normalizeSlug(translitRuToLat(p.slug)) }))}
                    placeholder="example-slug"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateSlug}
                    disabled={!canGenSlug}
                    className="px-4 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-200 transition-colors disabled:opacity-50"
                    title="Сгенерировать из названия"
                  >
                    Auto
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-400 italic">Транслитерация автоматическая при выходе из поля</p>
              </div>

              <div>
                <label className={labelClass}>Категория</label>
                <select
                  className={inputClass}
                  value={f.category_id ?? ""}
                  onChange={(e) => {
                    const v = String(e.target.value || "").trim();
                    setF((p) => ({ ...p, category_id: v ? Number(v) : null }));
                  }}
                  disabled={catsLoading}
                >
                  <option value="">{catsLoading ? "Загрузка..." : "— не выбрана —"}</option>
                  {cats
                    .filter((c) => c.is_active !== false)
                    .sort((a, b) => String(a.name).localeCompare(String(b.name), "ru"))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <label className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={!!f.show_on_site}
                  onChange={(e) => setF((p) => ({ ...p, show_on_site: e.target.checked }))}
                  className="w-5 h-5 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="font-bold text-gray-700 text-sm">Отображать на сайте (даже если нет исполнителей)</span>
              </label>

              <div className="space-y-2">
                <label className={labelClass}>Каноничное описание</label>
                <div className="bg-white border border-gray-300 rounded-xl overflow-hidden shadow-inner">
                  <ReactQuill
                    theme="snow"
                    value={f.description}
                    onChange={(val: string) => setF({ ...f, description: val })}
                    modules={modules}
                    className="min-h-[200px]"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Cover Image */}
          <section className={cardClass}>
            <h2 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
              Обложка
            </h2>
            <div className="w-full aspect-video rounded-xl border border-gray-100 bg-gray-50 overflow-hidden shadow-inner relative group mb-4">
              {f.cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveImgSrc(f.cover_image)} alt="Cover" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-sm uppercase">Нет обложки</div>
              )}
            </div>
            <div className="space-y-3">
              <input className={`${inputClass} text-xs font-mono`} placeholder="URL изображения" value={f.cover_image} onChange={(e) => setF({ ...f, cover_image: e.target.value })} />
              <label className="block w-full text-center py-2.5 px-4 bg-rose-50 text-rose-700 text-xs font-black uppercase tracking-widest rounded-xl cursor-pointer hover:bg-rose-100 transition-colors border border-rose-200 border-dashed">
                Загрузить файл
                <input type="file" accept="image/*" hidden onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  try {
                    const url = await uploadImage(file, `service-cover-${f.id}`);
                    setF(p => ({ ...p, cover_image: url }));
                    setMsg("Cover загружен ✅");
                  } catch (err: any) { setMsg(`Ошибка: ${err.message}`); }
                }} />
              </label>
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          
          {/* SEO */}
          <section className={cardClass}>
            <h2 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-green-500 rounded-full"></span>
              SEO
            </h2>
            <div className="space-y-5">
              <div><label className={labelClass}>SEO H1</label><input className={inputClass} value={f.seo_h1} onChange={(e) => setF({ ...f, seo_h1: e.target.value })} /></div>
              <div><label className={labelClass}>SEO Title</label><input className={inputClass} value={f.seo_title} onChange={(e) => setF({ ...f, seo_title: e.target.value })} /></div>
              <div><label className={labelClass}>Description</label><textarea className={`${inputClass} min-h-[80px] resize-none`} value={f.seo_description} onChange={(e) => setF({ ...f, seo_description: e.target.value })} /></div>
              <div><label className={labelClass}>SEO Text</label><textarea className={`${inputClass} min-h-[140px] font-mono text-xs`} value={f.seo_text} onChange={(e) => setF({ ...f, seo_text: e.target.value })} /></div>
            </div>
          </section>

          {/* Gallery */}
          <section className={cardClass}>
            <h2 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
              Галерея
            </h2>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {f.gallery.map((u, idx) => (
                <div key={idx} className="aspect-square rounded-lg border border-gray-100 overflow-hidden relative group shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resolveImgSrc(u)} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setF(p => ({...p, gallery: p.gallery.filter((_, i) => i !== idx)}))} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="space-y-2 pt-2 border-t border-gray-50">
              <input className={`${inputClass} text-[10px]`} placeholder="URL картинки..." value={newGalleryUrl} onChange={(e) => setNewGalleryUrl(e.target.value)} />
              <div className="flex gap-2">
                <button onClick={() => { if(!newGalleryUrl) return; setF(p => ({...p, gallery: [...p.gallery, newGalleryUrl]})); setNewGalleryUrl(""); }} className={`${btnSecondary} flex-1`}>Добавить URL</button>
                <label className={`${btnSecondary} flex-1 cursor-pointer text-center flex items-center justify-center`}>
                  <span>Загрузить</span>
                  <input type="file" accept="image/*" hidden onChange={async e => {
                    const file = e.target.files?.[0]; if(!file) return;
                    try {
                      const url = await uploadImage(file, `service-gallery-${f.id}`);
                      setF(p => ({...p, gallery: [...p.gallery, url]}));
                      setMsg("Добавлено в галерею ✅");
                    } catch(err: any) { setMsg(`Ошибка: ${err.message}`); }
                  }} />
                </label>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="flex items-center justify-between pt-6 border-t border-gray-200">
        <div className="flex items-center gap-4">
          <button onClick={save} disabled={saving} className={btnPrimary}>
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
        <Link href="/master/services" className="text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors">← Назад к списку</Link>
      </div>
    </div>
  );
}