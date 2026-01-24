"use client";

import React, { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.moydompro.ru";

type Lead = {
  id: number;
  company_id: number;
  kind: "service" | "product" | "custom";
  service_id: number | null;
  product_id: number | null;
  custom_title: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  status: "new" | "in_work" | "done" | "spam";
  source: string;
  created_at: string;
};

async function jget(url: string) {
  const r = await fetch(url, { credentials: "include" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
  return data;
}

async function jpatch(url: string, body: any) {
  const r = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
  return data;
}

export default function LeadsPage() {
  const [items, setItems] = useState<Lead[]>([]);
  const [err, setErr] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("");

  const load = async () => {
    setErr("");
    setLoading(true);
    try {
      const q = status ? `?status=${encodeURIComponent(status)}` : "";
      const r = await jget(`${API}/company-leads${q}`);
      setItems(r.items || []);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const setLeadStatus = async (id: number, st: Lead["status"]) => {
    setErr("");
    try {
      await jpatch(`${API}/company-leads/${id}`, { status: st });
      await load();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ margin: "0 0 12px" }}>Заявки</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: 8 }}>
          <option value="">Все</option>
          <option value="new">Новые</option>
          <option value="in_work">В работе</option>
          <option value="done">Закрытые</option>
          <option value="spam">Спам</option>
        </select>

        <button onClick={load} style={{ padding: "8px 12px" }}>
          Обновить
        </button>

        {loading ? <span>Загрузка…</span> : null}
        {err ? <span style={{ color: "crimson" }}>Ошибка: {err}</span> : null}
      </div>

      <div style={{ border: "1px solid #eee", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>ID</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>Дата</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>Тип</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>Контакт</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>Сообщение</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>Статус</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x) => {
              const title =
                x.kind === "service" ? `service_id=${x.service_id}` :
                x.kind === "product" ? `product_id=${x.product_id}` :
                (x.custom_title || "custom");

              const contact = [x.contact_name, x.phone, x.email].filter(Boolean).join(" · ");

              return (
                <tr key={x.id}>
                  <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>{x.id}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>{new Date(x.created_at).toLocaleString()}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>{x.kind} / {title}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>{contact || "-"}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>{x.message || "-"}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>{x.status}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => setLeadStatus(x.id, "new")}>new</button>
                      <button onClick={() => setLeadStatus(x.id, "in_work")}>in_work</button>
                      <button onClick={() => setLeadStatus(x.id, "done")}>done</button>
                      <button onClick={() => setLeadStatus(x.id, "spam")}>spam</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!items.length ? (
              <tr>
                <td colSpan={7} style={{ padding: 14, color: "#666" }}>
                  Пока заявок нет.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, color: "#666" }}>
        URL: <code>/leads</code> (админка)
      </div>
    </div>
  );
}
