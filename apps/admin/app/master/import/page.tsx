// /apps/admin/app/master/import/page.tsx
"use client";

import React, { useState } from "react";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

type ImportResult = {
  ok: boolean;
  created?: number;
  skipped?: number;
  error?: string;
  errors?: string[];
  items?: { id: number; slug: string; name: string }[];
};

export default function MasterGoogleImportPage() {
  const [sheetUrl, setSheetUrl] = useState("");
  const [kind, setKind] = useState<"product" | "service" | "both">("product");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!sheetUrl.trim()) {
      setError("Укажите ссылку на Google таблицу.");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`${API}/master/import/google-sheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sheet_url: sheetUrl.trim(), kind }),
      });
      const data = (await r.json()) as ImportResult;
      if (!r.ok || !data.ok) {
        const errorMessage = data?.error || data?.errors?.join(", ") || "Ошибка импорта";
        setError(String(errorMessage));
        return;
      }
      setResult(data);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
          Импорт из Google Sheets
        </h1>
        <p className="text-sm text-gray-500">
          Таблица должна быть доступна по ссылке (публичная или доступная всем по ссылке).
          Импорт создаёт новые позиции в канонике.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4"
      >
        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Ссылка на Google таблицу
          </span>
          <input
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Тип импорта
          </span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "product" | "service" | "both")}
            className="max-w-xs rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="product">Товары</option>
            <option value="service">Услуги</option>
            <option value="both">Товары + услуги (по колонке kind)</option>
          </select>
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="inline-flex items-center px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl transition-all active:scale-95 shadow-md text-sm"
            disabled={loading}
          >
            {loading ? "Импортируем..." : "Запустить импорт"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSheetUrl("");
              setResult(null);
              setError(null);
            }}
            className="inline-flex items-center px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-all"
          >
            Сбросить
          </button>
        </div>

        {error ? (
          <div className="text-sm text-red-600 font-semibold bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            Ошибка: {error}
          </div>
        ) : null}

        {result ? (
          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex flex-wrap gap-4">
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                Создано: {result.created ?? 0}
              </span>
              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 font-semibold">
                Пропущено: {result.skipped ?? 0}
              </span>
            </div>
            {result.errors && result.errors.length ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <div className="font-semibold text-amber-700 mb-2">Ошибки импорта:</div>
                <ul className="list-disc list-inside space-y-1 text-amber-700">
                  {result.errors.map((item, idx) => (
                    <li key={`${item}-${idx}`}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.items && result.items.length ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <div className="font-semibold text-gray-700 mb-2">Последние созданные:</div>
                <ul className="space-y-1 text-gray-600">
                  {result.items.map((item) => (
                    <li key={item.id}>
                      #{item.id} · {item.name} ({item.slug})
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </form>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-3 text-sm text-gray-600">
        <h2 className="text-base font-bold text-gray-800">Формат таблицы</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Обязательные колонки: <b>name</b> (название), <b>category_id</b> или{" "}
            <b>category_slug</b>/<b>category_name</b>.
          </li>
          <li>
            Необязательные: <b>slug</b>, <b>description</b>, <b>specs</b> (JSON или
            строка вида &quot;Параметр: значение; ...&quot;).
          </li>
          <li>
            Для смешанного режима укажите колонку <b>kind</b> (product/service).
          </li>
          <li>Таблица должна быть опубликована или доступна по ссылке.</li>
        </ul>
      </div>
    </div>
  );
}
