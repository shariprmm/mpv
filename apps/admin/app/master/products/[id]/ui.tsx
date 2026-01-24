// /opt/moydompro-repo/apps/admin/app/master/products/[id]/ui.tsx
"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
// ✅ Импортируем dynamic для редактора
import dynamic from "next/dynamic";

// ✅ Подключаем стили редактора
import "react-quill/dist/quill.snow.css";

// ✅ Загружаем ReactQuill динамически (без SSR)
const ReactQuill = dynamic(() => import("react-quill"), {
  ssr: false,
  loading: () => <p>Загрузка редактора...</p>,
});

type AnyObj = Record<string, any>;
type Spec = { name: string; value: string };

// ✅ NEW: категории товаров (плоский список)
type ProductCategory = {
  id: number;
  slug: string;
  name: string;
  parent_id: number | null;
  depth?: number;
  path_name?: string;
};

// ✅ Публичный домен, с которого должны грузиться /uploads/*
const PUBLIC_SITE =
  (process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "").replace(/\/+$/, "") || "https://moydompro.ru";

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

// ✅ specs: [{name,value}] / json string -> Spec[]
function asSpecs(v: any): Spec[] {
  const norm = (arr: any[]): Spec[] =>
    arr
      .map((x) => ({
        name: asStr(x?.name),
        value: asStr(x?.value),
      }))
      .filter((x) => x.name && x.value)
      .slice(0, 10);

  if (Array.isArray(v)) return norm(v);
  if (!v) return [];
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return norm(parsed);
    } catch {}
  }
  return [];
}

// ✅ Делает ссылку на /uploads/* абсолютной на публичный домен
function toPublicUploadsUrl(u: string | null | undefined) {
  const s = asStr(u);
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s; // уже абсолютная
  if (s.startsWith("/uploads/")) return `${PUBLIC_SITE}${s}`;
  return s;
}

/** ru -> lat (минимально достаточный транслит для slug) */
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

/** нормализуем slug: латиница/цифры/дефисы */
function normalizeSlug(input: string) {
  return (
    String(input || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || ""
  );
}

/** slug из названия (кириллица -> транслит -> normalize) */
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

export default function ProductEditorClient(props: { item: AnyObj; apiBase: string }) {
  const { item, apiBase } = props;

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const initial = useMemo(() => {
    return {
      id: Number(item.id),
      name: asStr(item.name),
      slug: asStr(item.slug),
      category_id: item.category_id ?? null,

      description: asStr(item.description),
      cover_image: asStr(item.cover_image),
      gallery: asArr(item.gallery),

      // ✅ NEW: specs
      specs: asSpecs(item.specs),

      seo_h1: asStr(item.seo_h1),
      seo_title: asStr(item.seo_title),
      seo_description: asStr(item.seo_description),
      seo_text: asStr(item.seo_text),
    };
  }, [item]);

  const [f, setF] = useState(initial);

  // ✅ AUTO-SLUG logic vars
  const [slugTouched, setSlugTouched] = useState<boolean>(Boolean(asStr(item.slug)));
  const lastAutoSlugRef = useRef<string>("");

  // ✅ IMPORTANT: если item подгружается/обновляется после первого рендера,
  // то useState(initial) не обновит f само — синхронизируем при смене item.id
  useEffect(() => {
    setF(initial);

    // также синхронизируем автослаг-логику
    const existing = asStr(initial.slug);
    setSlugTouched(Boolean(existing));
    lastAutoSlugRef.current = existing ? normalizeSlug(translitRuToLat(existing)) : "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id]);

  const [newGalleryUrl, setNewGalleryUrl] = useState("");

  // ✅ NEW: add spec inputs
  const [newSpecName, setNewSpecName] = useState("");
  const [newSpecValue, setNewSpecValue] = useState("");

  // ✅ NEW: categories state
  const [cats, setCats] = useState<ProductCategory[]>([]);
  const [catsErr, setCatsErr] = useState<string>("");

  useEffect(() => {
    const name = asStr(f.name);
    if (!name) return;

    const auto = slugFromName(name);

    // 1) если slug пустой → всегда ставим авто и включаем авто-режим
    if (!asStr(f.slug)) {
      if (auto) {
        lastAutoSlugRef.current = auto;
        setSlugTouched(false);
        setF((p) => ({ ...p, slug: auto }));
      }
      return;
    }

    // 2) если slug НЕ трогали руками → поддерживаем авто-слуг
    if (!slugTouched) {
      if (auto && f.slug !== auto) {
        lastAutoSlugRef.current = auto;
        setF((p) => ({ ...p, slug: auto }));
      }
      return;
    }

    // 3) если slug трогали, но текущее значение равно прошлому авто-слугу —
    //    значит пользователь не делал "кастом", можно продолжать авто-обновление
    if (lastAutoSlugRef.current && f.slug === lastAutoSlugRef.current) {
      if (auto && f.slug !== auto) {
        lastAutoSlugRef.current = auto;
        setF((p) => ({ ...p, slug: auto }));
      }
    }
  }, [f.name]); // намеренно только name

  // ✅ NEW: load categories once
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setCatsErr("");
        const r = await fetch(`${apiBase}/product-categories?flat=1`, {
          credentials: "include",
        });
        const j = await r.json().catch(() => null);
        if (!alive) return;

        if (!r.ok || !j?.ok || !Array.isArray(j.result)) {
          setCatsErr(j?.error || `categories_failed_${r.status}`);
          return;
        }

        setCats(j.result as ProductCategory[]);
      } catch (e: any) {
        if (!alive) return;
        setCatsErr(String(e?.message || e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [apiBase]);

  async function uploadImage(file: File, prefix: string) {
    const dataUrl = await fileToDataUrl(file);
    const r = await fetch(`${apiBase}/master/upload-image`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataUrl,
        filename: file.name,
        prefix,
      }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) throw new Error(j?.error || "upload_failed");
    return String(j.url || "");
  }

  function normalizeSpecsForSave(specs: Spec[]): Spec[] {
    return (Array.isArray(specs) ? specs : [])
      .map((x) => ({ name: asStr(x?.name), value: asStr(x?.value) }))
      .filter((x) => x.name && x.value)
      .slice(0, 10);
  }

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const body = {
        name: f.name,

        // ✅ NEW: slug editable + нормализация/транслит
        slug: f.slug ? normalizeSlug(translitRuToLat(f.slug)) : null,

        // ✅ NEW: category
        category_id: f.category_id ?? null,

        description: f.description || null,
        cover_image: f.cover_image || null,
        gallery: f.gallery,

        // ✅ NEW: specs
        specs: normalizeSpecsForSave(f.specs),

        seo_h1: f.seo_h1 || null,
        seo_title: f.seo_title || null,
        seo_description: f.seo_description || null,
        seo_text: f.seo_text || null,
      };

      const r = await fetch(`${apiBase}/master/products/${f.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error || "save_failed");

      // если сервер вернул обновлённый slug/category_id — синхронизируем
      const nextSlug = asStr(j?.item?.slug);
      const nextCategoryId = j?.item?.category_id ?? undefined;

      setF((p) => ({
        ...p,
        slug: nextSlug || p.slug,
        category_id: nextCategoryId === undefined ? p.category_id : nextCategoryId,
      }));

      if (nextSlug) setSlugTouched(true);

      setMsg("Сохранено ✅");
    } catch (e: any) {
      setMsg(`Ошибка: ${String(e?.message || e)}`);
    } finally {
      setSaving(false);
    }
  }

  const coverPreview = toPublicUploadsUrl(f.cover_image);

  const canAddSpec = useMemo(() => {
    const n = asStr(newSpecName);
    const v = asStr(newSpecValue);
    if (!n || !v) return false;
    if ((f.specs?.length || 0) >= 10) return false;
    return true;
  }, [newSpecName, newSpecValue, f.specs]);

  // ✅ Настройки тулбара редактора
  const modules = {
    toolbar: [
      [{ header: [2, 3, false] }],
      ["bold", "italic", "underline"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["clean"],
    ],
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <h1 style={{ margin: "0 0 10px" }}>Товар (каноника)</h1>
        <div style={{ opacity: 0.7 }}>
          #{f.id} · {f.slug}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
        <section style={card}>
          <h2 style={h2}>Основное</h2>

          <label style={lbl}>Название</label>
          <input style={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />

          {/* ✅ NEW: slug editable + auto generate */}
          <label style={lbl}>Slug</label>
          <input
            style={inp}
            value={f.slug}
            onChange={(e) => {
              const next = e.target.value;

              // если поле очистили — возвращаем авто-режим
              if (!asStr(next)) {
                setSlugTouched(false);
                setF((p) => ({ ...p, slug: "" }));
                return;
              }

              // иначе — это ручное редактирование
              setSlugTouched(true);
              setF((p) => ({ ...p, slug: next }));
            }}
            onBlur={() => {
              setF((p) => ({ ...p, slug: normalizeSlug(translitRuToLat(p.slug)) }));
            }}
            placeholder="naprimer-septik-topas"
          />
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
            Если slug не трогать — он автосгенерируется из названия. Можно вводить кириллицу: будет транслит и
            нормализация при выходе из поля.
          </div>

          {/* ✅ NEW: category select */}
          <label style={lbl}>Категория товара</label>
          <select
            style={inp}
            value={f.category_id ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setF((p) => ({ ...p, category_id: v ? Number(v) : null }));
            }}
          >
            <option value="">— Не выбрано —</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.path_name ? c.path_name : `${"—".repeat(Math.min(10, c.depth ?? 0))} ${c.name}`}
              </option>
            ))}
          </select>
          {catsErr ? (
            <div style={{ marginTop: 6, fontSize: 13, color: "crimson" }}>
              Ошибка загрузки категорий: {catsErr}
            </div>
          ) : null}

          <label style={lbl}>Каноничное описание</label>
          {/* ✅ ЗАМЕНИЛИ TEXTAREA НА REACT-QUILL */}
          <div style={{ background: "white", borderRadius: 12, overflow: "hidden" }}>
            {/* ✅ ИСПРАВЛЕНИЕ: добавлен тип (val: string) */}
            <ReactQuill
              theme="snow"
              value={f.description}
              onChange={(val: string) => setF({ ...f, description: val })}
              modules={modules}
              style={{ height: 200, marginBottom: 50 }}
            />
          </div>

          {/* ✅ NEW: SPECS */}
          <h3 style={h3}>Характеристики (до 10)</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr auto",
              gap: 10,
              alignItems: "end",
              marginBottom: 10,
            }}
          >
            <div>
              <label style={lbl}>Название</label>
              <input
                style={inp}
                placeholder="Напр. Количество пользователей"
                value={newSpecName}
                onChange={(e) => setNewSpecName(e.target.value)}
              />
            </div>

            <div>
              <label style={lbl}>Значение</label>
              <input
                style={inp}
                placeholder="Напр. 3"
                value={newSpecValue}
                onChange={(e) => setNewSpecValue(e.target.value)}
              />
            </div>

            <button
              style={{ ...btn, height: 42 }}
              disabled={!canAddSpec}
              onClick={() => {
                const name = asStr(newSpecName);
                const value = asStr(newSpecValue);
                if (!name || !value) return;
                if ((f.specs?.length || 0) >= 10) return;

                setF((p) => ({
                  ...p,
                  specs: [...(p.specs || []), { name, value }].slice(0, 10),
                }));
                setNewSpecName("");
                setNewSpecValue("");
              }}
            >
              Добавить
            </button>
          </div>

          {f.specs?.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {f.specs.map((sp, idx) => (
                <div
                  key={`${sp.name}-${idx}`}
                  style={{
                    border: "1px solid rgba(0,0,0,.12)",
                    borderRadius: 12,
                    padding: 10,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr auto",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <input
                    style={inp}
                    value={sp.name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setF((p) => {
                        const copy = [...(p.specs || [])];
                        copy[idx] = { ...copy[idx], name: v };
                        return { ...p, specs: copy };
                      });
                    }}
                  />

                  <input
                    style={inp}
                    value={sp.value}
                    onChange={(e) => {
                      const v = e.target.value;
                      setF((p) => {
                        const copy = [...(p.specs || [])];
                        copy[idx] = { ...copy[idx], value: v };
                        return { ...p, specs: copy };
                      });
                    }}
                  />

                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button
                      style={btn2}
                      onClick={() => {
                        setF((p) => ({ ...p, specs: (p.specs || []).filter((_, i) => i !== idx) }));
                      }}
                    >
                      удалить
                    </button>
                    <button
                      style={btn2}
                      onClick={() => {
                        if (idx <= 0) return;
                        setF((p) => {
                          const copy = [...(p.specs || [])];
                          [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
                          return { ...p, specs: copy };
                        });
                      }}
                    >
                      ↑
                    </button>
                    <button
                      style={btn2}
                      onClick={() => {
                        setF((p) => {
                          const copy = [...(p.specs || [])];
                          if (idx >= copy.length - 1) return p;
                          [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
                          return { ...p, specs: copy };
                        });
                      }}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
              <div style={{ opacity: 0.7, fontSize: 13 }}>Заполнено: {f.specs.length}/10</div>
            </div>
          ) : (
            <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 8 }}>Характеристики не заданы</div>
          )}

          <h3 style={h3}>Cover</h3>
          {coverPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverPreview}
              alt=""
              style={{ width: "100%", maxHeight: 240, objectFit: "cover", borderRadius: 12 }}
            />
          ) : (
            <div style={{ opacity: 0.7 }}>Нет cover</div>
          )}

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
            <input
              style={{ ...inp, flex: "1 1 360px" }}
              placeholder="URL cover_image (или загрузить файлом ниже)"
              value={f.cover_image}
              onChange={(e) => setF({ ...f, cover_image: e.target.value })}
            />
            <label style={btn}>
              Загрузить cover
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setMsg("");
                  try {
                    const url = await uploadImage(file, `product-cover-${f.id}`);
                    setF((p) => ({ ...p, cover_image: url }));
                    setMsg("Cover загружен ✅");
                  } catch (err: any) {
                    setMsg(`Ошибка загрузки: ${String(err?.message || err)}`);
                  }
                }}
              />
            </label>
          </div>
        </section>

        <aside style={card}>
          <h2 style={h2}>SEO</h2>

          <label style={lbl}>SEO H1</label>
          <input style={inp} value={f.seo_h1} onChange={(e) => setF({ ...f, seo_h1: e.target.value })} />

          <label style={lbl}>SEO Title</label>
          <input style={inp} value={f.seo_title} onChange={(e) => setF({ ...f, seo_title: e.target.value })} />

          <label style={lbl}>SEO Description</label>
          <textarea
            style={{ ...inp, minHeight: 90 }}
            value={f.seo_description}
            onChange={(e) => setF({ ...f, seo_description: e.target.value })}
          />

          <label style={lbl}>SEO Text (HTML/текст)</label>
          <textarea
            style={{ ...inp, minHeight: 160 }}
            value={f.seo_text}
            onChange={(e) => setF({ ...f, seo_text: e.target.value })}
          />
        </aside>
      </div>

      <section style={{ ...card, marginTop: 16 }}>
        <h2 style={h2}>Галерея</h2>

        {f.gallery.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
            {f.gallery.map((u, idx) => {
              const preview = toPublicUploadsUrl(u);

              return (
                <div key={u + idx} style={{ border: "1px solid rgba(0,0,0,.12)", borderRadius: 12, padding: 8 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview || u}
                    alt=""
                    style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 10 }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      style={btn2}
                      onClick={() => setF((p) => ({ ...p, gallery: p.gallery.filter((_, i) => i !== idx) }))}
                    >
                      удалить
                    </button>
                    <button
                      style={btn2}
                      onClick={() => {
                        const copy = [...f.gallery];
                        if (idx > 0) [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
                        setF((p) => ({ ...p, gallery: copy }));
                      }}
                    >
                      ↑
                    </button>
                    <button
                      style={btn2}
                      onClick={() => {
                        const copy = [...f.gallery];
                        if (idx < copy.length - 1) [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
                        setF((p) => ({ ...p, gallery: copy }));
                      }}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ opacity: 0.7 }}>Галерея пустая</div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
          <input
            style={{ ...inp, flex: "1 1 420px" }}
            placeholder="Добавить URL в галерею"
            value={newGalleryUrl}
            onChange={(e) => setNewGalleryUrl(e.target.value)}
          />
          <button
            style={btn}
            onClick={() => {
              const u = asStr(newGalleryUrl);
              if (!u) return;
              setF((p) => ({ ...p, gallery: [...p.gallery, u] }));
              setNewGalleryUrl("");
            }}
          >
            Добавить URL
          </button>

          <label style={btn}>
            Загрузить в галерею
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setMsg("");
                try {
                  const url = await uploadImage(file, `product-gallery-${f.id}`);
                  setF((p) => ({ ...p, gallery: [...p.gallery, url] }));
                  setMsg("Добавлено в галерею ✅");
                } catch (err: any) {
                  setMsg(`Ошибка загрузки: ${String(err?.message || err)}`);
                }
              }}
            />
          </label>
        </div>
      </section>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
        <button style={btn} disabled={saving} onClick={save}>
          {saving ? "Сохранение..." : "Сохранить"}
        </button>

        <div
          style={{
            opacity: msg.startsWith("Ошибка") ? 1 : 0.85,
            color: msg.startsWith("Ошибка") ? "crimson" : "",
          }}
        >
          {msg || ""}
        </div>

        <div style={{ marginLeft: "auto" }}>
          <Link href="/master/products">← к списку</Link>
        </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,.12)",
  borderRadius: 16,
  padding: 16,
  background: "white",
};

const h2: React.CSSProperties = { margin: "0 0 10px", fontSize: 16 };
const h3: React.CSSProperties = { margin: "14px 0 8px", fontSize: 14, opacity: 0.85 };

const lbl: React.CSSProperties = {
  display: "block",
  marginTop: 10,
  marginBottom: 6,
  fontSize: 13,
  opacity: 0.8,
};

const inp: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid rgba(0,0,0,.18)",
  borderRadius: 12,
  outline: "none",
};

const btn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,.18)",
  background: "rgba(0,0,0,.04)",
  cursor: "pointer",
  fontSize: 14,
  userSelect: "none",
};

const btn2: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,.18)",
  background: "rgba(0,0,0,.03)",
  cursor: "pointer",
  fontSize: 13,
};