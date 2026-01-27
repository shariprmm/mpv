// apps/admin/app/master/blog-posts/[id]/page.tsx
"use client";

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type ReactQuillType, { ReactQuillProps } from "react-quill";

import "react-quill/dist/quill.snow.css";

// ✅ Загружаем редактор без SSR
const ReactQuill = dynamic(() => import("react-quill"), {
  ssr: false,
  loading: () => (
    <p className="p-4 text-gray-400 italic">Загрузка редактора...</p>
  ),
}) as unknown as React.ForwardRefExoticComponent<
  ReactQuillProps & React.RefAttributes<ReactQuillType>
>;

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

const PUBLIC_SITE =
  (process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "").replace(/\/+$/, "") ||
  "https://moydompro.ru";

type Cat = { id: number; slug: string; name: string; sort_order: number };
type Post = Record<string, any>;

function asStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function translitRuToLat(input: string) {
  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };

  return String(input || "")
    .trim()
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("");
}

function normalizeSlug(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function isoToDatetimeLocal(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(v: string) {
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

function mdToVeryBasicHtml(md: string) {
  const s = String(md || "").trim();
  if (!s) return "<p></p>";
  const esc = (x: string) =>
    x
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const lines = s.split(/\r?\n/);
  const html = lines
    .map((ln) => {
      const t = ln.trim();
      if (!t) return "";
      const m = t.match(/^(#{1,6})\s+(.*)$/);
      if (m) {
        const lvl = Math.min(6, m[1].length);
        return `<h${lvl}>${esc(m[2])}</h${lvl}>`;
      }
      return `<p>${esc(t)}</p>`;
    })
    .filter(Boolean)
    .join("");

  return html || "<p></p>";
}

// ✅ Tailwind-only классы (без styled-jsx, без @apply)
const inputBase =
  "w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none transition " +
  "placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50";

const btnPrimary =
  "inline-flex items-center justify-center rounded-xl bg-gray-900 px-6 py-2 text-xs font-extrabold text-white shadow-sm " +
  "transition hover:bg-gray-800 active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none";

const btnSecondary =
  "inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-extrabold text-gray-800 shadow-sm " +
  "transition hover:bg-gray-50 active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none";

const btnDanger =
  "inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-extrabold text-red-600 " +
  "transition hover:bg-red-50 hover:border-red-300 active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none";

export default function MasterBlogPostEdit() {
  const router = useRouter();
  const params = useParams();
  const id = Number((params as any)?.id);

  const [cats, setCats] = useState<Cat[]>([]);
  const [item, setItem] = useState<Post | null>(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [contentUploading, setContentUploading] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string>("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const editorRef = useRef<ReactQuillType | null>(null);

  const [form, setForm] = useState({
    slug: "",
    title: "",
    excerpt: "",
    category_id: "",
    cover_image: "",
    seo_title: "",
    seo_description: "",
    is_published: false,
    published_at: "",
    content: "",
  });

  const publicUrl = useMemo(() => {
    const s = form.slug?.trim() || item?.slug || "";
    return s ? `${PUBLIC_SITE}/journal/${s}` : "";
  }, [form.slug, item?.slug]);

  const handleImageUpload = useCallback(async () => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const defaultAlt = file.name.replace(/\.[^/.]+$/, "") || "image";
      const altPrompt = window.prompt("Alt для изображения", defaultAlt);
      const altText = (altPrompt ?? defaultAlt).trim() || defaultAlt;

      setContentUploading(true);
      try {
        const dataUrl = await fileToDataUrl(file);
        const resp = await fetch(`${API}/master/upload-image`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataUrl,
            filename: file.name,
            prefix: "blog-content",
          }),
        });

        const j = await resp.json().catch(() => ({}));
        if (!resp.ok || !j.ok) {
          alert(j.error || "upload_failed");
          return;
        }

        const url = String(j.url || "");
        const editor = editorRef.current?.getEditor();
        if (!editor || !url) return;

        const range = editor.getSelection(true);
        const insertAt = range ? range.index : editor.getLength();
        editor.insertEmbed(insertAt, "image", url, "user");
        editor.setSelection(insertAt + 1, 0, "silent");

        requestAnimationFrame(() => {
          const images = editor.root.querySelectorAll(`img[src="${url}"]`);
          const img = images[images.length - 1] as HTMLImageElement | undefined;
          if (img) img.setAttribute("alt", altText);
        });
      } finally {
        setContentUploading(false);
      }
    };
  }, []);

  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [2, 3, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["link", "image", "clean"],
        ],
        handlers: {
          image: handleImageUpload,
        },
      },
    }),
    [handleImageUpload]
  );

  const loadAll = useCallback(async () => {
    if (!id) return;

    setErr("");
    setIsLoading(true);

    try {
      // categories
      try {
        const r = await fetch(`${API}/master/blog-categories?t=${Date.now()}`, {
          credentials: "include",
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.ok) setCats(j.items || []);
      } catch {}

      // post
      const url = `${API}/master/blog-posts/${id}?t=${Date.now()}`;
      const r = await fetch(url, { credentials: "include" });
      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j.ok) {
        setErr(j.error || "load_failed");
        setItem(null);
        return;
      }

      const p = j.item || {};
      setItem(p);

      const html =
        (p.content_html && String(p.content_html).trim()) ||
        mdToVeryBasicHtml(p.content_md || "");

      let catId = "";
      if (p.category_id && typeof p.category_id === "object" && "id" in p.category_id) {
        catId = String(p.category_id.id);
      } else if (p.category_id) {
        catId = String(p.category_id);
      }

      setForm({
        slug: asStr(p.slug),
        title: asStr(p.title || p.name || p.header),
        excerpt: asStr(p.excerpt || p.description_short),
        category_id: catId,
        cover_image: asStr(p.cover_image || p.image || p.coverImage),
        seo_title: asStr(p.seo_title || p.meta_title),
        seo_description: asStr(p.seo_description || p.meta_description),
        is_published: !!(p.is_published || p.isPublished),
        published_at: p.published_at ? isoToDatetimeLocal(p.published_at) : "",
        content: html,
      });

      setSlugTouched(false);
    } catch (e: any) {
      setErr(`Error loading post: ${e?.message || "unknown_error"}`);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    loadAll();
  }, [id, loadAll]);

  useEffect(() => {
    if (!slugTouched && form.title && !form.slug) {
      setForm((prev) => ({
        ...prev,
        slug: normalizeSlug(translitRuToLat(form.title)),
      }));
    }
  }, [form.title, form.slug, slugTouched]);

  const save = useCallback(
    async (patch?: Partial<typeof form>) => {
      const next = { ...form, ...(patch || {}) };
      const pubIso = next.published_at ? datetimeLocalToIso(next.published_at) : null;

      setSaving(true);
      try {
        const body = {
          slug: normalizeSlug(next.slug),
          title: next.title,
          name: next.title,
          excerpt: next.excerpt,
          cover_image: next.cover_image || null,
          category_id: next.category_id ? Number(next.category_id) : null,
          seo_title: next.seo_title || null,
          seo_description: next.seo_description || null,
          is_published: Boolean(next.is_published),
          content_html: next.content || "",
          content_md: next.content || "",
          published_at: next.is_published ? pubIso : null,
        };

        const r = await fetch(`${API}/master/blog-posts/${id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) {
          alert(j.error || "save_failed");
          return;
        }

        await loadAll();
      } finally {
        setSaving(false);
      }
    },
    [form, id, loadAll]
  );

  const uploadCoverFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setCoverPreview(dataUrl);

      const resp = await fetch(`${API}/master/upload-image`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, filename: file.name, prefix: "blog-cover" }),
      });

      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j.ok) {
        alert(j.error || "upload_failed");
        return;
      }

      setForm((p) => ({ ...p, cover_image: String(j.url || "") }));
    } finally {
      setUploading(false);
    }
  }, []);

  const del = useCallback(async () => {
    if (!confirm("Удалить статью?")) return;

    const r = await fetch(`${API}/master/blog-posts/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) return alert(j.error || "delete_failed");

    router.push("/master/blog-posts");
  }, [id, router]);

  const statusText = useMemo(() => {
    if (!form.is_published) return "Черновик";
    if (form.published_at) {
      const d = new Date(datetimeLocalToIso(form.published_at) || "");
      if (Number.isFinite(d.getTime()) && d.getTime() > Date.now()) {
        return `Запланировано: ${form.published_at.replace("T", " ")}`;
      }
      return "Опубликовано";
    }
    return "Опубликовать сейчас";
  }, [form.is_published, form.published_at]);

  if (!id) return <div className="p-8 text-gray-500">Загрузка ID...</div>;

  if (isLoading) {
    return (
      <main className="p-20 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <h2 className="mt-4 text-xs font-semibold tracking-widest text-gray-400 uppercase">
          Загрузка данных статьи...
        </h2>
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-20">
      {/* HEADER */}
      <header className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight text-gray-900">
            Редактирование статьи
          </h1>

          {publicUrl && (
            <div className="max-w-md truncate text-xs font-medium text-blue-600">
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                {publicUrl}
              </a>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-[10px] font-black tracking-widest text-gray-400 uppercase">
            <span>
              Статус:{" "}
              <span className={form.is_published ? "text-green-600" : "text-gray-500"}>
                {statusText}
              </span>
            </span>

            {item?.updated_at && (
              <span>
                • Изменено: {new Date(item.updated_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={loadAll} className={btnSecondary}>
            🔄 Обновить
          </button>

          <Link href="/master/blog-posts" className={btnSecondary}>
            ← К списку
          </Link>

          <button onClick={() => save()} disabled={saving} className={btnPrimary}>
            {saving ? "Сохранение..." : "Сохранить"}
          </button>

          <button
            onClick={() => save({ is_published: !form.is_published })}
            disabled={saving}
            className={btnSecondary}
          >
            {form.is_published ? "Снять с публикации" : "Опубликовать"}
          </button>

          <button onClick={del} disabled={saving} className={btnDanger}>
            Удалить
          </button>
        </div>
      </header>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {err}
        </div>
      )}

      <div className="space-y-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field label="Заголовок (Title)">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={`${inputBase} font-bold`}
            />
          </Field>

          <Field label="URL Путь (Slug)" hint="Измените вручную, если нужно">
            <input
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setForm({ ...form, slug: e.target.value });
              }}
              onBlur={() => setForm((p) => ({ ...p, slug: normalizeSlug(p.slug) }))}
              className={`${inputBase} font-mono text-sm text-blue-700`}
            />
          </Field>

          <Field label="Краткое описание (Excerpt)">
            <textarea
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              className={`${inputBase} h-24 resize-none`}
            />
          </Field>

          <div className="space-y-6">
            <Field label="Категория">
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className={inputBase}
              >
                <option value="">Без категории</option>
                {cats.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Дата публикации">
              <input
                type="datetime-local"
                value={form.published_at}
                onChange={(e) => setForm({ ...form, published_at: e.target.value })}
                className={inputBase}
              />
              <p className="text-[11px] text-gray-400">
                Если статья опубликована и дата в будущем — будет запланирована.
              </p>
            </Field>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-8">
          <Field label="Обложка статьи">
            <div className="mt-2 flex flex-col gap-6 md:flex-row">
              <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 md:w-64">
                <img
                  src={
                    form.cover_image ||
                    coverPreview ||
                    "https://placehold.co/600x400?text=No+Image"
                  }
                  alt=""
                  className="h-full w-full object-cover"
                />
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs font-black text-gray-700">
                    Загрузка...
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-4">
                <input
                  value={form.cover_image}
                  onChange={(e) => setForm({ ...form, cover_image: e.target.value })}
                  placeholder="URL изображения"
                  className={`${inputBase} font-mono text-xs`}
                />

                <label className="inline-flex items-center gap-2">
                  <span className={`${btnSecondary} cursor-pointer`}>
                    Выбрать файл...
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => e.target.files?.[0] && uploadCoverFile(e.target.files[0])}
                  />
                </label>

                <p className="text-[11px] text-gray-400">
                  Можно указать URL вручную или загрузить файл (будет сохранён через /master/upload-image).
                </p>
              </div>
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-6 border-t border-gray-100 pt-8 md:grid-cols-2">
          <Field label="SEO Title">
            <input
              value={form.seo_title}
              onChange={(e) => setForm({ ...form, seo_title: e.target.value })}
              className={inputBase}
            />
          </Field>
          <Field label="SEO Description">
            <input
              value={form.seo_description}
              onChange={(e) => setForm({ ...form, seo_description: e.target.value })}
              className={inputBase}
            />
          </Field>
        </div>

        <div className="space-y-3 border-t border-gray-100 pt-8">
          <label className="text-xs font-black tracking-widest text-gray-400 uppercase">
            Контент статьи
          </label>

          {/* Quill: оставляем его CSS, а контейнер/рамки делаем Tailwind */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <ReactQuill
              theme="snow"
              value={form.content}
              onChange={(val: string) => setForm({ ...form, content: val })}
              modules={modules}
              ref={editorRef}
              className="h-[400px] mb-12"
            />
            {contentUploading && (
              <div className="mt-2 text-xs font-semibold text-blue-600">
                Загрузка изображения...
              </div>
            )}
          </div>

          <p className="text-[11px] text-gray-400">
            Подсказка: если нужно подстроить внешний вид Quill под Tailwind — лучше
            добавить глобальные CSS-переопределения в общий файл (globals.css), а не через
            &lt;style jsx&gt;.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-black tracking-widest text-gray-400 uppercase">
          {label}
        </label>
        {hint && (
          <span className="text-[10px] font-semibold italic text-gray-400">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
