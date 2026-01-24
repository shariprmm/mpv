"use client";

import React from "react";

export default function CreateServiceButton({ apiBase }: { apiBase: string }) {
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  async function create() {
    setLoading(true);
    setMsg("");
    try {
      const r = await fetch(`${apiBase}/master/services`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Новая услуга",
        }),
      });

      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error || "create_failed");

      const id = Number(j?.id || j?.item?.id || 0);
      if (!id) throw new Error("create_no_id");

      window.location.href = `/master/services/${id}`;
    } catch (e: any) {
      setMsg(`Ошибка: ${String(e?.message || e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button
        onClick={create}
        disabled={loading}
        style={{
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,.18)",
          background: "rgba(0,0,0,.04)",
          cursor: loading ? "default" : "pointer",
          fontSize: 14,
          userSelect: "none",
        }}
      >
        {loading ? "Создаю..." : "+ Добавить услугу"}
      </button>

      {msg ? (
        <div style={{ fontSize: 13, color: msg.startsWith("Ошибка") ? "crimson" : "inherit", opacity: 0.9 }}>
          {msg}
        </div>
      ) : null}
    </div>
  );
}
