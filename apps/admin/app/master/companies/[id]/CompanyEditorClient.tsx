// /apps/admin/app/master/companies/[id]/CompanyEditorClient.tsx
"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";

type AnyObj = Record<string, any>;

const PUBLIC_SITE =
  (process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "").replace(/\/+$/, "") ||
  "https://moydompro.ru";

// --- Хелперы ---

function asStr(v: any) {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  return s.trim();
}

function toPublicUploadsUrl(u: string | null | undefined) {
  const s = asStr(u);
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/uploads/")) return `${PUBLIC_SITE}${s}`;
  if (s.startsWith("uploads/")) return `${PUBLIC_SITE}/${s}`;
  return s;
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function toIntOrNull(v: any): number | null {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function asStrArr(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => asStr(x)).filter(Boolean);
  if (!v) return [];
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return [];
    try {
      const p = JSON.parse(s);
      if (Array.isArray(p)) return p.map((x) => asStr(x)).filter(Boolean);
    } catch {}
    if (s.includes(",")) return s.split(",").map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

function uniq(arr: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of arr) {
    const s = asStr(x);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

// ✅ Tailwind-only classes (без <style jsx global> и без @apply)
const inputBase =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none transition " +
  "placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50";

const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 " +
  "font-bold text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-95";

const btnDanger =
  "inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-2 " +
  "font-bold text-red-600 shadow-sm transition-all hover:border-red-300 hover:bg-red-50 active:scale-95 disabled:opacity-50";

export default function CompanyEditorClient(props: { item: AnyObj; apiBase: string }) {
  const { item, apiBase } = props;

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const initial = useMemo(() => {
    return {
      id: Number(item.id),
      name: asStr(item.name),
      slug: asStr(item.slug),
      description: asStr(item.description ?? item.about),
      phone: asStr(item.phone ?? item.tel),
      email: asStr(item.email),
      website: asStr(item.website ?? item.site),
      address: asStr(item.address ?? item.addr),
      city: asStr(item.city ?? item.city_name),
      region_id: toIntOrNull(item.region_id),
      region_name: asStr(item.region_name),
      logo_url: asStr(item.logo_url ?? item.logo),
      cover_image: asStr(item.cover_image ?? item.coverImage),
      photos: asStrArr(item.photos),
      is_verified: !!item.is_verified,
    };
  }, [item]);

  const [f, setF] = useState(initial);

  async function uploadImage(file: File, prefix: string) {
    const dataUrl = await fileToDataUrl(file);
    const r = await fetch(`${apiBase}/master/upload-image`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, filename: file.name, prefix }),
    });

    const raw = await r.text();
    let j: any = null;
    try {
      j = JSON.parse(raw);
    } catch {
      j = null;
    }

    if (!r.ok || !j?.ok) {
      throw new Error(j?.error || "upload_failed");
    }
    return String(j.url || "");
  }

  async function addCompanyPhotos(files: File[]) {
    if (!files.length) return;
    setMsg("");
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const url = await uploadImage(file, `company-photo-${f.id}`);
        if (url) uploaded.push(url);
      }
      setF((p) => ({
        ...p,
        photos: uniq([...(p.photos || []), ...uploaded]).slice(0, 40),
      }));
      setMsg(`Фото добавлено ✅`);
    } catch (e: any) {
      setMsg(`Ошибка загрузки: ${e.message}`);
    }
  }

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const body = {
        ...f,
        region_id: f.region_id || null,
        photos: Array.isArray(f.photos) ? f.photos.filter(Boolean).slice(0, 40) : [],
      };

      const r = await fetch(`${apiBase}/master/companies/${f.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "save_failed");

      setMsg("Изменения сохранены ✅");
    } catch (e: any) {
      setMsg(`Ошибка: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  const logoPreview = toPublicUploadsUrl(f.logo_url);
  const coverPreview = toPublicUploadsUrl(f.cover_image);
  const photosPreview = (f.photos || []).map(toPublicUploadsUrl).filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-20">
      {/* HEADER */}
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-gray-900">Компания</h1>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
              ID #{f.id}
            </span>
          </div>
          {f.slug && <div className="mt-1 font-mono text-xs text-gray-400">/{f.slug}</div>}
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/master/companies"
            className="text-sm font-bold text-gray-400 transition-colors hover:text-gray-900"
          >
            ← Назад к списку
          </Link>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-gray-900 px-8 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-gray-800 active:scale-95 disabled:opacity-50"
          >
            {saving ? "Сохранение..." : "Сохранить всё"}
          </button>
        </div>
      </header>

      {msg && (
        <div
          className={`animate-in fade-in slide-in-from-top-2 rounded-xl border p-4 text-sm font-bold ${
            msg.startsWith("Ошибка")
              ? "border-red-100 bg-red-50 text-red-700"
              : "border-green-100 bg-green-50 text-green-700"
          }`}
        >
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="border-b border-gray-50 pb-3 text-xs font-black tracking-[0.2em] text-gray-400 uppercase">
              Основные данные
            </h2>

            <Field label="Название организации">
              <input
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
                className={`${inputBase} text-lg font-bold`}
              />
            </Field>

            <Field label="Описание (О компании)">
              <textarea
                className={`${inputBase} h-32 resize-none text-sm leading-relaxed`}
                value={f.description}
                onChange={(e) => setF({ ...f, description: e.target.value })}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Телефон">
                <input
                  value={f.phone}
                  onChange={(e) => setF({ ...f, phone: e.target.value })}
                  className={`${inputBase} font-mono`}
                />
              </Field>
              <Field label="Email">
                <input
                  value={f.email}
                  onChange={(e) => setF({ ...f, email: e.target.value })}
                  className={inputBase}
                />
              </Field>
            </div>

            <Field label="Веб-сайт">
              <input
                value={f.website}
                onChange={(e) => setF({ ...f, website: e.target.value })}
                className={`${inputBase} text-blue-600`}
              />
            </Field>
          </section>

          {/* GALLERY SECTION */}
          <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-50 pb-3">
              <h2 className="text-xs font-black tracking-[0.2em] text-gray-400 uppercase">
                Примеры работ (Фото)
              </h2>
              <span className="text-[10px] font-bold text-gray-300 uppercase">
                {photosPreview.length} / 40
              </span>
            </div>

            <div className="flex flex-wrap gap-3">
              <label className={`${btnSecondary} cursor-pointer text-xs`}>
                <span>➕ Добавить фото...</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => addCompanyPhotos(Array.from(e.target.files || []))}
                />
              </label>

              <button
                onClick={() => setF({ ...f, photos: [] })}
                disabled={!photosPreview.length}
                className={`${btnDanger} px-4 text-xs`}
              >
                Очистить
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {photosPreview.map((src, idx) => (
                <div
                  key={src + idx}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-gray-100 shadow-sm transition-all hover:shadow-md"
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() =>
                      setF((p) => ({
                        ...p,
                        photos: (p.photos || []).filter((_, i) => i !== idx),
                      }))
                    }
                    className="absolute right-1.5 top-1.5 rounded-lg bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Удалить фото"
                    type="button"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="border-b border-gray-50 pb-3 text-xs font-black tracking-[0.2em] text-gray-400 uppercase">
              Локация и статус
            </h2>

            <Field label="Фактический адрес">
              <input
                value={f.address}
                onChange={(e) => setF({ ...f, address: e.target.value })}
                className={inputBase}
              />
            </Field>

            <Field label="Населенный пункт">
              <input
                value={f.city}
                onChange={(e) => setF({ ...f, city: e.target.value })}
                className={inputBase}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Регион (ID)">
                <input
                  type="number"
                  value={f.region_id ?? ""}
                  onChange={(e) => setF({ ...f, region_id: toIntOrNull(e.target.value) })}
                  className={`${inputBase} font-mono`}
                />
              </Field>
              <Field label="Регион (Текст)">
                <input
                  value={f.region_name}
                  readOnly
                  className={`${inputBase} cursor-not-allowed bg-gray-50 text-gray-400`}
                />
              </Field>
            </div>

            <div className="pt-2">
              <label className="group flex cursor-pointer items-center gap-3 rounded-xl border border-green-100 bg-green-50/50 p-4 transition-colors hover:bg-green-50">
                <input
                  type="checkbox"
                  checked={f.is_verified}
                  onChange={(e) => setF({ ...f, is_verified: e.target.checked })}
                  className="h-5 w-5 rounded border-green-300 text-green-600 focus:ring-green-500"
                />
                <div>
                  <div className="text-sm font-bold text-green-800">Верифицированная компания</div>
                  <div className="mt-0.5 text-[10px] font-bold tracking-wider text-green-600/70 uppercase">
                    Приоритет в поиске
                  </div>
                </div>
              </label>
            </div>
          </section>

          {/* VISUAL ASSETS */}
          <section className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="mb-4 text-xs font-black tracking-[0.2em] text-gray-400 uppercase">
                Логотип
              </h2>
              <div className="flex items-center gap-6">
                <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 shadow-inner">
                  {logoPreview ? (
                    <img src={logoPreview} className="h-full w-full object-cover" alt="" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-gray-300 uppercase">
                      Нет
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <label className={`${btnSecondary} inline-block cursor-pointer text-[10px]`}>
                    Загрузить файл
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const url = await uploadImage(file, `company-logo-${f.id}`);
                          setF((p) => ({ ...p, logo_url: url }));
                          setMsg("Лого обновлено ✅");
                        } catch (err: any) {
                          setMsg(`Ошибка: ${err.message}`);
                        }
                      }}
                    />
                  </label>

                  <input
                    value={f.logo_url}
                    onChange={(e) => setF({ ...f, logo_url: e.target.value })}
                    className={`${inputBase} h-8 font-mono text-[10px]`}
                    placeholder="URL логотипа"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-50 pt-6">
              <h2 className="mb-4 text-xs font-black tracking-[0.2em] text-gray-400 uppercase">
                Обложка профиля
              </h2>

              <div className="space-y-4">
                <div className="group relative h-32 w-full overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 shadow-inner">
                  {coverPreview ? (
                    <img src={coverPreview} className="h-full w-full object-cover" alt="" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-gray-300 uppercase">
                      Нет обложки
                    </div>
                  )}

                  <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="text-xs font-bold text-white">Загрузить новую</span>
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const url = await uploadImage(file, `company-cover-${f.id}`);
                          setF((p) => ({ ...p, cover_image: url }));
                          setMsg("Обложка обновлена ✅");
                        } catch (err: any) {
                          setMsg(`Ошибка: ${err.message}`);
                        }
                      }}
                    />
                  </label>
                </div>

                <input
                  value={f.cover_image}
                  onChange={(e) => setF({ ...f, cover_image: e.target.value })}
                  className={`${inputBase} h-8 font-mono text-[10px]`}
                  placeholder="URL обложки"
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="ml-1 text-[10px] font-black tracking-widest text-gray-400 uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}
