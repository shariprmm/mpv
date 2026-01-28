"use client";

import React, { useEffect, useState } from "react";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

export default function RegisterPage() {
  const [companyName, setCompanyName] = useState("");
  const [regionSlug, setRegionSlug] = useState("moskva");
  const [regions, setRegions] = useState<{ id: number; name: string; slug: string }[]>([]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/public/regions`, { credentials: "include" });
        const j = await r.json();
        const items = j?.items || [];
        setRegions(items);
        if (items[0]?.slug) setRegionSlug(items[0].slug);
      } catch {}
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSuccess(null);
    setLoading(true);
    try {
      const r = await fetch(`${API}/auth/register-company`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyName, email, password, region_slug: regionSlug }),
      });

      const txt = await r.text();
      let data: any = null;
      try { data = JSON.parse(txt); } catch { data = { raw: txt }; }

      if (!r.ok) throw new Error(data?.error || data?.message || `HTTP ${r.status}`);

      if (data?.email_sent === false) {
        setSuccess("Компания создана, но письмо подтвердить не удалось. Напишите в поддержку.");
      } else {
        setSuccess("Письмо для подтверждения регистрации отправлено. Проверьте почту.");
      }
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 460, margin: "48px auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Регистрация компании</h1>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <div>Название компании</div>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
            placeholder="ООО Ромашка"
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div>Регион</div>
          <select
            value={regionSlug}
            onChange={(e) => setRegionSlug(e.target.value)}
            style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          >
            {regions.map((r) => (
              <option key={r.id} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div>Email владельца</div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
            autoComplete="username"
            placeholder="owner@company.ru"
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div>Пароль</div>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
            autoComplete="new-password"
            placeholder="Минимум 8 символов"
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
          {loading ? "Создаём..." : "Создать компанию"}
        </button>

        <a href="/login" style={{ fontSize: 14, color: "#333" }}>
          Уже есть аккаунт? Войти
        </a>

        {success && (
          <div style={{ background: "#eef7ff", border: "1px solid #8cc4ff", padding: 10, borderRadius: 10 }}>
            {success}
          </div>
        )}

        {err && (
          <div style={{ background: "#fee", border: "1px solid #f99", padding: 10, borderRadius: 10 }}>
            Ошибка: {err}
          </div>
        )}
      </form>
    </div>
  );
}
