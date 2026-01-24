//opt/moydompro-repo/apps/admin/app/master/products/ProductCategorySelect.tsx
"use client";

import React from "react";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

type Cat = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  depth?: number;
  path_name?: string;
};

export default function ProductCategorySelect(props: {
  productId: number;
  initialCategoryId: number | null;
}) {
  const { productId, initialCategoryId } = props;

  const [value, setValue] = React.useState<number | "">(initialCategoryId ?? "");
  const [cats, setCats] = React.useState<Cat[]>([]);
  
  // ✅ ИСПРАВЛЕНИЕ: Используем useState вместо useTransition для отслеживания сети
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const r = await fetch(`${API}/product-categories?flat=1`, {
        credentials: "include",
      });
      const j = await r.json().catch(() => null);
      if (!alive) return;
      if (r.ok && j?.ok && Array.isArray(j.result)) {
        setCats(j.result);
      } else {
        console.error("categories load failed", r.status, j);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function save(nextCategoryId: number | null) {
    const r = await fetch(`${API}/master/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: nextCategoryId }),
      credentials: "include",
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(txt || `HTTP ${r.status}`);
    }
  }

  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 14, opacity: 0.75 }}>Категория</span>

      <select
        value={value}
        disabled={pending}
        // ✅ ИСПРАВЛЕНИЕ: Делаем обработчик async и управляем состоянием вручную
        onChange={async (e) => {
          const raw = e.target.value;
          const next = raw ? Number(raw) : null;

          // оптимистично меняем UI
          setValue(raw ? Number(raw) : "");

          // Блокируем селект
          setPending(true);
          try {
            await save(next);
          } catch (err) {
            console.error(err);
            // откат значения при ошибке
            setValue(initialCategoryId ?? "");
            alert("Не удалось сохранить. Проверь доступ/сессию.");
          } finally {
            // Разблокируем селект
            setPending(false);
          }
        }}
      >
        <option value="">— Не выбрано —</option>
        {cats.map((c) => {
          const label =
            c.path_name ||
            `${"—".repeat(Math.min(10, c.depth ?? 0))} ${c.name}`.trim();
          return (
            <option key={c.id} value={c.id}>
              {label}
            </option>
          );
        })}
      </select>
    </label>
  );
}