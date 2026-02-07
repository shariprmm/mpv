"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

type TgStatus = "pending" | "sent" | "error" | null;

type PostRow = {
  id: number;
  slug: string;
  title: string;
  is_published: boolean;
  tg_status: TgStatus;
  tg_publish_at: string | null;
  tg_posted_at: string | null;
  tg_error: string | null;
  tg_chat_id: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "—";
  return parsed.toLocaleString("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function statusLabel(status: TgStatus) {
  if (!status) return "—";
  if (status === "pending") return "Ожидает";
  if (status === "sent") return "Отправлено";
  return "Ошибка";
}

function statusStyle(status: TgStatus) {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-700";
    case "sent":
      return "bg-green-100 text-green-700";
    case "error":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-500";
  }
}

export default function MasterTelegramPage() {
  const [items, setItems] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [schedulePost, setSchedulePost] = useState<PostRow | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleChat, setScheduleChat] = useState("");
  const [scheduleForce, setScheduleForce] = useState(false);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (statusFilter) p.set("status", statusFilter);
    if (search.trim()) p.set("search", search.trim());
    if (fromDate) p.set("tg_publish_from", new Date(fromDate).toISOString());
    if (toDate) p.set("tg_publish_to", new Date(toDate).toISOString());
    return p.toString();
  }, [statusFilter, search, fromDate, toDate]);

  async function load() {
    try {
      setErr("");
      setLoading(true);
      const url = `${API}/master/blog-posts${params ? `?${params}` : ""}`;
      const r = await fetch(url, { credentials: "include" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) return setErr(j.error || "load_failed");
      setItems(j.items || []);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [params]);

  function openSchedule(post: PostRow) {
    setSchedulePost(post);
    setScheduleAt(toDateTimeLocal(post.tg_publish_at));
    setScheduleChat(post.tg_chat_id || "");
    setScheduleForce(false);
  }

  async function saveSchedule() {
    if (!schedulePost) return;
    try {
      const body: Record<string, any> = {
        tg_publish_at: scheduleAt ? new Date(scheduleAt).toISOString() : null,
      };
      if (scheduleChat) body.tg_chat_id = scheduleChat;
      if (scheduleForce) body.force_resend = true;

      const r = await fetch(`${API}/master/blog-posts/${schedulePost.id}/tg`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) return alert(j.error || "save_failed");
      setSchedulePost(null);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function cancelSchedule(post: PostRow) {
    if (!confirm("Отменить планирование для этой статьи?")) return;
    try {
      const r = await fetch(`${API}/master/blog-posts/${post.id}/tg`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tg_publish_at: null }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) return alert(j.error || "cancel_failed");
      load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function resetPending(post: PostRow) {
    if (!confirm("Сбросить статус в pending и отправить по расписанию?")) return;
    try {
      const r = await fetch(`${API}/master/blog-posts/${post.id}/tg`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force_resend: true }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) return alert(j.error || "reset_failed");
      load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function publishNow(post: PostRow) {
    const force = post.tg_status === "sent"
      ? confirm("Пост уже отправлен. Отправить повторно?")
      : true;
    if (!force) return;
    try {
      const r = await fetch(`${API}/master/blog-posts/${post.id}/tg/publish-now`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: post.tg_status === "sent" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) return alert(j.error || "publish_failed");
      load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Telegram · публикации</h1>
        <p className="text-sm text-gray-500">
          Управление отложенной отправкой статей блога в канал Telegram.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 grid gap-4 md:grid-cols-[180px_1fr_180px_180px_120px]">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Статус</label>
          <select
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Все</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="error">Error</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Поиск</label>
          <input
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Заголовок или slug"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">TG publish от</label>
          <input
            type="datetime-local"
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">TG publish до</label>
          <input
            type="datetime-local"
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <button
            className="w-full px-4 py-2 text-sm font-bold rounded-lg bg-gray-900 text-white"
            onClick={load}
          >
            Обновить
          </button>
        </div>
      </div>

      {err && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
          Ошибка: {err}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 animate-pulse font-medium">
            Загрузка списка...
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="hidden xl:grid grid-cols-[2fr_120px_140px_160px_160px_200px] gap-4 px-6 py-4 bg-gray-50/50 border-b border-gray-100 text-[11px] font-black text-gray-400 uppercase tracking-widest">
              <div>Заголовок</div>
              <div>Published</div>
              <div>TG Status</div>
              <div>TG Publish</div>
              <div>TG Posted</div>
              <div>TG Error</div>
            </div>

            <div className="divide-y divide-gray-100">
              {items.map((post) => (
                <div
                  key={post.id}
                  className="grid grid-cols-1 xl:grid-cols-[2fr_120px_140px_160px_160px_200px] gap-4 px-6 py-5 items-start xl:items-center hover:bg-blue-50/30 transition-colors"
                >
                  <div className="space-y-2">
                    <Link
                      href={`/master/blog-posts/${post.id}`}
                      className="block font-bold text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {post.title}
                    </Link>
                    <div className="text-[11px] text-gray-400 font-mono">/journal/{post.slug}</div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => openSchedule(post)}
                        className="px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg bg-blue-600 text-white"
                      >
                        Запланировать / Изменить
                      </button>
                      <button
                        onClick={() => publishNow(post)}
                        className="px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg bg-gray-900 text-white"
                      >
                        Опубликовать сейчас
                      </button>
                      <button
                        onClick={() => cancelSchedule(post)}
                        className="px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg bg-white border border-gray-200 text-gray-600"
                      >
                        Отменить планирование
                      </button>
                      <button
                        onClick={() => resetPending(post)}
                        className="px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg bg-amber-100 text-amber-700"
                      >
                        Сбросить в pending
                      </button>
                    </div>
                  </div>
                  <div>
                    {post.is_published ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-green-100 text-green-700">
                        Да
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-500">
                        Нет
                      </span>
                    )}
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusStyle(
                        post.tg_status
                      )}`}
                    >
                      {statusLabel(post.tg_status)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">{formatDate(post.tg_publish_at)}</div>
                  <div className="text-sm text-gray-600">{formatDate(post.tg_posted_at)}</div>
                  <div className="text-sm text-red-500" title={post.tg_error || ""}>
                    {post.tg_error ? post.tg_error.slice(0, 80) : "—"}
                  </div>
                </div>
              ))}
            </div>

            {items.length === 0 && (
              <div className="p-20 text-center text-gray-400 font-medium">
                Нет записей по выбранным фильтрам.
              </div>
            )}
          </div>
        )}
      </div>

      {schedulePost && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Планирование Telegram</h2>
              <p className="text-sm text-gray-500">{schedulePost.title}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Дата и время</label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Chat ID</label>
                <input
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="@moydompro"
                  value={scheduleChat}
                  onChange={(e) => setScheduleChat(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={scheduleForce}
                  onChange={(e) => setScheduleForce(e.target.checked)}
                />
                Force resend
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 text-sm font-bold rounded-lg border border-gray-200 text-gray-600"
                onClick={() => setSchedulePost(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm font-bold rounded-lg bg-blue-600 text-white"
                onClick={saveSchedule}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
