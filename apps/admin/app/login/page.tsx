"use client";

import React, { useState } from "react";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const r = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // ВАЖНО: чтобы cookie записалась
        body: JSON.stringify({ email, password }),
      });
      const txt = await r.text();
      let data: any = null;
      try { data = JSON.parse(txt); } catch { data = { raw: txt }; }

      if (!r.ok) throw new Error(data?.error || data?.message || `HTTP ${r.status}`);
      // успех -> в прайс
      location.href = "/price";
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "48px auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Вход в админку</h1>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <div>Email</div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
            autoComplete="username"
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div>Пароль</div>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
            autoComplete="current-password"
          />
        </label>

        <button
          disabled={loading}
          style={{
            padding: 12,
            borderRadius: 10,
            border: "1px solid #222",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          {loading ? "Входим..." : "Войти"}
        </button>
		<a href="/register" style={{ fontSize: 14, color: "#333" }}>
  Нет аккаунта? Зарегистрировать компанию
</a>


        {err && (
          <div style={{ background: "#fee", border: "1px solid #f99", padding: 10, borderRadius: 10 }}>
            Ошибка: {err}
          </div>
        )}
      </form>
    </div>
  );
}
