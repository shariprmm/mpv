// apps/admin/app/register/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import styles from "./register.module.css";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const r = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Чтобы сразу авторизовать пользователя
        body: JSON.stringify({ 
          email, 
          password, 
          company_name: companyName,
          phone 
        }),
      });

      const txt = await r.text();
      let data: any = null;
      try { data = JSON.parse(txt); } catch { data = { raw: txt }; }

      if (!r.ok) {
        throw new Error(data?.error || data?.message || "Ошибка регистрации");
      }

      // Успех -> редирект в админку (прайс)
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
        
        {/* Логотип */}
        <Link href="/" className={styles.brand}>
          <div className={styles.brandLogo}>🏡</div>
          <div className={styles.brandTitle}>МойДомПро</div>
        </Link>

        <h1 className={styles.title}>Регистрация компании</h1>
        <p className={styles.subtitle}>
          Создайте профиль, чтобы размещать услуги и получать заявки бесплатно.
        </p>

        {err && (
          <div className={styles.error} role="alert">
            {err}
          </div>
        )}

        <form onSubmit={onSubmit} className={styles.form}>
          
          {/* Поле Название */}
          <div className={styles.field}>
            <label className={styles.label}>Название компании</label>
            <input
              className={styles.input}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Например: ООО СтройСервис"
              required
            />
            <div className={styles.hint}>
              Так вас будут видеть клиенты в каталоге.
            </div>
          </div>

          {/* Поле Email */}
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="mail@company.ru"
              type="email"
              autoComplete="username"
              required
            />
            <div className={styles.hint}>
              Используется для входа и уведомлений о заявках.
            </div>
          </div>

          {/* Поле Телефон */}
          <div className={styles.field}>
            <label className={styles.label}>Телефон</label>
            <input
              className={styles.input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 (999) 000-00-00"
              type="tel"
              autoComplete="tel"
            />
            <div className={styles.hint}>
              Для связи с менеджером (не публикуется).
            </div>
          </div>

          {/* Поле Пароль */}
          <div className={styles.field}>
            <label className={styles.label}>Пароль</label>
            <input
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Придумайте пароль"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
            />
            <div className={styles.hint}>
              Минимум 6 символов.
            </div>
          </div>

          <button type="submit" disabled={loading} className={styles.btn}>
            {loading ? "Создаем аккаунт..." : "Зарегистрироваться"}
          </button>
        </form>

        <div className={styles.footer}>
          Уже есть аккаунт? 
          <Link href="/login" className={styles.link}>
            Войти
          </Link>
        </div>
      </div>
    </div>
  );
}
