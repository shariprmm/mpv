// apps/admin/app/master/blog-posts/new/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

import "react-quill/dist/quill.snow.css";

// ✅ Dynamic import of ReactQuill without SSR
const ReactQuill = dynamic(() => import("react-quill"), {
  ssr: false,
  loading: () => <p className="p-4 text-gray-400 italic">Загрузка редактора...</p>,
});

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

type Cat = { id: number; name: string; slug: string };

// --- Helpers ---

function datetimeLocalToIso(v: string) {
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function slugifyRu(input: string) {
  const s = String(input || "").trim().toLowerCase();

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

  const tr = s
    .split("")
    .map((ch) => (map[ch] !== undefined ? map[ch] : ch))
    .join("");

  return tr
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ✅ Tailwind-only classes (без styled-jsx / без @apply внутри <style>)
const inputBase =
  "w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none transition " +
  "placeholder:text-gray-400 placeholder:font-normal focus:border-blue-500 focus:ring-4 focus:ring-blue-50";

export default function MasterBlogPostNew() {
  const router = useRouter();
  const [cats, setCats] = useState<Cat[]>([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [contentUploading, setContentUploading] = useState(false);
  const editorRef = useRef<any>(null);

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

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/master/blog-categories`, {
          credentials: "include",
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.ok) setCats(j.items || []);
      } catch (e) {
        console.error("Failed to load categories", e);
      }
    })();
  }, []);

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

  function onTitleChange(v: string) {
    setForm((p) => {
      const next = { ...p, title: v };
      if (!slugTouched) next.slug = slugifyRu(v);
      return next;
    });
  }

  async function save() {
    if (!form.title) return alert("Введите заголовок");

    setIsSaving(true);
    try {
      const pubIso = form.published_at ? datetimeLocalToIso(form.published_at) : null;

      const body = {
        slug: form.slug.trim(),
        title: form.title,
        excerpt: form.excerpt,
        category_id: form.category_id ? Number(form.category_id) : null,
        cover_image: form.cover_image || null,
        seo_title: form.seo_title || null,
        seo_description: form.seo_description || null,
        is_published: Boolean(form.is_published),
        content_html: form.content || "",
        content_md: form.content || "",
        published_at: form.is_published ? pubIso : null,
      };

      const r = await fetch(`${API}/master/blog-posts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) return alert(j.error || "save_failed");

      router.push(`/master/blog-posts/${j.item.id}`);
    } catch (e) {
      alert("Ошибка при сохранении");
    } finally {
      setIsSaving(false);
    }
  }

  const statusHint = useMemo(() => {
    if (!form.is_published) return "Черновик";
    if (form.published_at) return `Запланировано: ${form.published_at.replace("T", " ")}`;
    return "Опубликовать сейчас";
  }, [form.is_published, form.published_at]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-20">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-black tracking-tight text-gray-900">Новая статья</h1>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => router.back()}
            className="text-sm font-bold text-gray-500 transition-colors hover:text-gray-800"
          >
            Отмена
          </button>

          <button
            onClick={save}
            disabled={isSaving}
            className="rounded-xl bg-gray-900 px-8 py-2 font-bold text-white shadow-md transition-all hover:bg-gray-800 active:scale-95 disabled:opacity-50"
          >
            {isSaving ? "Создание..." : "Создать статью"}
          </button>
        </div>
      </div>

      {/* FORM CONTENT */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-8">
          {/* Main Info Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Field label="Заголовок (Title)">
              <input
                placeholder="Как выбрать септик..."
                value={form.title}
                onChange={(e) => onTitleChange(e.target.value)}
                className={`${inputBase} text-lg font-bold`}
              />
            </Field>

            <Field label="URL Путь (Slug)" hint="Автогенерируется из заголовка">
              <input
                placeholder="kak-vybrat-septik"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm({ ...form, slug: e.target.value });
                }}
                className={`${inputBase} font-mono text-sm text-blue-700`}
              />
            </Field>

            <Field label="Краткое описание (Excerpt)">
              <textarea
                placeholder="Пара предложений для превью в списке..."
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
                  {cats.map((c: any) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Обложка (URL картинки)">
                <input
                  placeholder="https://... или /uploads/..."
                  value={form.cover_image}
                  onChange={(e) => setForm({ ...form, cover_image: e.target.value })}
                  className={`${inputBase} font-mono text-xs`}
                />
              </Field>
            </div>
          </div>

          {/* Publication Block */}
          <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-gray-100 bg-gray-50 p-5">
            <label className="group flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setForm((p) => ({
                    ...p,
                    is_published: checked,
                    published_at: checked ? p.published_at : "",
                  }));
                }}
                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="font-bold text-gray-700 transition-colors group-hover:text-gray-900">
                Опубликовать статью
              </span>
            </label>

            {form.is_published && (
              <div className="flex items-center gap-4">
                <span className="text-gray-400">📅</span>
                <input
                  type="datetime-local"
                  value={form.published_at}
                  onChange={(e) => setForm({ ...form, published_at: e.target.value })}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] font-black tracking-widest text-gray-400 uppercase">
                Статус:
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  form.is_published
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {statusHint}
              </span>
            </div>
          </div>

          {/* SEO Grid */}
          <div className="grid grid-cols-1 gap-6 border-t border-gray-100 pt-8 md:grid-cols-2">
            <Field label="SEO Title">
              <input
                placeholder="Заголовок для поисковиков"
                value={form.seo_title}
                onChange={(e) => setForm({ ...form, seo_title: e.target.value })}
                className={inputBase}
              />
            </Field>

            <Field label="SEO Description">
              <input
                placeholder="Описание для поисковиков"
                value={form.seo_description}
                onChange={(e) => setForm({ ...form, seo_description: e.target.value })}
                className={inputBase}
              />
            </Field>
          </div>

          {/* Editor */}
          <div className="space-y-3 pt-4">
            <label className="text-xs font-bold tracking-widest text-gray-500 uppercase">
              Контент статьи
            </label>
            <div className="min-h-[400px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-inner">
              <ReactQuill
                theme="snow"
                value={form.content}
                onChange={(val: string) => setForm({ ...form, content: val })}
                modules={modules}
                ref={editorRef}
                className="h-[340px]"
              />
            </div>
            {contentUploading && (
              <div className="text-xs font-semibold text-blue-600">
                Загрузка изображения...
              </div>
            )}
          </div>
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
        <label className="text-xs font-bold tracking-widest text-gray-400 uppercase">
          {label}
        </label>
        {hint && (
          <span className="text-[10px] italic text-gray-400">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
