"use client";

import React from "react";
import { useRouter } from "next/navigation";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

export default function CopyProductButton({ id }: { id: number }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function copy() {
    const r = await fetch(`${API}/master/products/${id}/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const text = await r.text().catch(() => "");
    if (!r.ok) throw new Error(text || `HTTP ${r.status}`);

    let data: any = null;
    try {
      data = JSON.parse(text || "{}");
    } catch {
      // если вдруг API вернул не JSON
      data = null;
    }

    const newId = Number(data?.id || data?.item?.id || data?.product?.id || 0);
    if (!newId) throw new Error("copy_ok_but_no_id");

    return newId;
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (pending) return;
        setPending(true);
        try {
          const newId = await copy();
          router.push(`/master/products/${newId}`);
          router.refresh();
        } catch (err) {
          console.error(err);
          alert("Не удалось скопировать товар. Проверь доступ/сессию.");
        } finally {
          setPending(false);
        }
      }}
      style={{
        border: "1px solid rgba(0,0,0,.18)",
        background: "white",
        borderRadius: 10,
        padding: "6px 10px",
        cursor: pending ? "default" : "pointer",
      }}
      title="Создать новый товар на основе этого"
    >
      {pending ? "Копирую..." : "Копировать"}
    </button>
  );
}
