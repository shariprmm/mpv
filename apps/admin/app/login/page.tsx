// app/login/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import styles from "./login.module.css"; // Импортируем стили

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
      try {
        data = JSON.parse(txt);
      } catch {
        data = { raw: txt };
      }

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
    <div className={styles.container}>
      <div className={styles.card}>
        
        {/* Логотип для брендинга */}
        <div className={styles.brand}>
          <div className={styles.brandLogo}>🏡</div>
          <div className={styles.brandTitle}>МойДомПро</div>
        </div>

        <h1 className={styles.title}>Вход в кабинет</h1>

        {err && (
          <div className={styles.error} role="alert">
            {err}
          </div>
        )}

        <form onSubmit={onSubmit} className={styles.form} autoComplete="off">
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              placeholder="name@company.com"
              type="email"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Пароль</label>
            <input
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="off"
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" disabled={loading} className={styles.btn}>
            {loading ? "Входим..." : "Войти"}
          </button>
        </form>

        <div className={styles.footer}>
          Нет аккаунта? 
          <Link href="/register" className={styles.link}>
            Зарегистрировать компанию
          </Link>
        </div>
      </div>
    </div>
  );
}
