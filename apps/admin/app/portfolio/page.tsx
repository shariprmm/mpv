"use client";

import React, { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.moydompro.ru";

type PortfolioItem = {
  id: number;
  title: string;
  description: string;
  photos: string[];
  service_id: number | null;
  product_id: number | null;
  service_name?: string | null;
  product_name?: string | null;
  created_at?: string;
};

async function jget(url: string) {
  const r = await fetch(url, { credentials: "include" });
  const text = await r.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!r.ok) throw new Error(data?.error || data?.message || `HTTP ${r.status}`);
  return data;
}

async function jreq(url: string, method: "POST" | "PATCH" | "DELETE", body?: any) {
  const r = await fetch(url, {
    method,
    credentials: "include",
    headers: method === "DELETE" ? {} : { "Content-Type": "application/json" },
    body: method === "DELETE" ? undefined : JSON.stringify(body ?? {}),
  });
  const text = await r.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!r.ok) throw new Error(data?.error || data?.message || `HTTP ${r.status}`);
  return data;
}

export default function PortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photosText, setPhotosText] = useState("");

  const photosPreview = useMemo(() => {
    return photosText
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 10);
  }, [photosText]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const me = await jget(`${API}/auth/me`);
      if (!me?.ok) throw new Error("auth_failed");
      const r = await jget(`${API}/company/portfolio`);
      setItems(r.items || []);
    } catch (e: any) {
      setErr(e?.message || "error");
      // если не авторизован — на логин
      if ((e?.message || "").toLowerCase().includes("unauthorized")) location.href = "/login";
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function add() {
    setErr(null);
    try {
      const photos = photosText.split("\n").map(s => s.trim()).filter(Boolean);
      await jreq(`${API}/company/portfolio`, "POST", { title, description, photos });
      setTitle("");
      setDescription("");
      setPhotosText("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "error");
    }
  }

  async function del(id: number) {
    if (!confirm("Удалить работу из портфолио?")) return;
    setErr(null);
    try {
      await jreq(`${API}/company/portfolio/${id}`, "DELETE");
      await load();
    } catch (e: any) {
      setErr(e?.message || "error");
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 6 }}>Портфолио</h1>
      <div style={{ opacity: 0.7, marginBottom: 18 }}>Добавляй выполненные работы (пока фото — ссылками).</div>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название работы (например: Дренаж участка 12 соток)"
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Описание (что делали, сроки, материалы)"
            rows={4}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />
          <textarea
            value={photosText}
            onChange={(e) => setPhotosText(e.target.value)}
            placeholder={"Ссылки на фото (каждая с новой строки)\nhttps://...\nhttps://..."}
            rows={5}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />

          {photosPreview.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {photosPreview.map((u) => (
                <a key={u} href={u} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                  {u}
                </a>
              ))}
            </div>
          )}

          <button
            onClick={add}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer", width: 220 }}
          >
            Добавить работу
          </button>

          {err && <div style={{ color: "crimson" }}>Ошибка: {err}</div>}
        </div>
      </div>

      <div style={{ marginBottom: 10, fontWeight: 600 }}>Список работ</div>
      {loading ? (
        <div>Загрузка…</div>
      ) : items.length === 0 ? (
        <div style={{ opacity: 0.7 }}>Пока пусто</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((it) => (
            <div key={it.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{it.title}</div>
                  {it.description && <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{it.description}</div>}
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                    {it.service_name ? `Услуга: ${it.service_name}` : ""}
                    {it.product_name ? ` | Товар: ${it.product_name}` : ""}
                    {it.created_at ? ` | ${new Date(it.created_at).toLocaleString()}` : ""}
                  </div>
                  {Array.isArray(it.photos) && it.photos.length > 0 && (
                    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                      {it.photos.slice(0, 10).map((u) => (
                        <a key={u} href={u} target="_blank" rel="noreferrer">{u}</a>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <button
                    onClick={() => del(it.id)}
                    style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
