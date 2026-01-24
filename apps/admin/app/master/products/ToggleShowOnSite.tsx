// apps/admin/app/master/products/ToggleShowOnSite.tsx
"use client";

import React from "react";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

export default function ToggleShowOnSite(props: { id: number; initial: boolean }) {
  const { id, initial } = props;

  const [checked, setChecked] = React.useState(initial);
  // ✅ ИСПРАВЛЕНИЕ: Используем useState вместо useTransition
  const [pending, setPending] = React.useState(false);

  async function save(next: boolean) {
    const r = await fetch(`${API}/master/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ show_on_site: next }),
      credentials: "include",
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(txt || `HTTP ${r.status}`);
    }
  }

  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={pending}
      // ✅ ИСПРАВЛЕНИЕ: async обработчик и ручное управление состоянием загрузки
      onChange={async (e) => {
        const next = e.target.checked;
        setChecked(next); // Оптимистичное обновление

        setPending(true);
        try {
          await save(next);
        } catch (err) {
          console.error(err);
          setChecked(!next); // Откат при ошибке
          alert("Не удалось сохранить. Проверь доступ/сессию.");
        } finally {
          setPending(false);
        }
      }}
    />
  );
}