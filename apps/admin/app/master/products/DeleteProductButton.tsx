"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  process.env.API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

export default function DeleteProductButton({ id, name }: { id: number; name: string }) {
  const r = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    if (loading) return;

    const ok = window.confirm(
      `Удалить товар #${id} “${name}”? \n\nВажно: если товар используется в прайсах компаний — удаление будет запрещено.`
    );
    if (!ok) return;

    setLoading(true);
    try {
      const res = await fetch(`${API}/master/products/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 409 && data?.error === "in_use") {
          alert(`Нельзя удалить: товар используется в прайсах компаний (${data.items_count} поз.).`);
          return;
        }
        alert(`Ошибка удаления: ${data?.error || res.status}`);
        return;
      }

      r.refresh(); // обновит server component список
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={loading}
      style={{
        border: "1px solid rgba(0,0,0,.18)",
        background: loading ? "rgba(0,0,0,.06)" : "white",
        borderRadius: 10,
        padding: "6px 10px",
        cursor: loading ? "default" : "pointer",
      }}
      title="Удалить товар"
    >
      {loading ? "Удаление…" : "Удалить"}
    </button>
  );
}
