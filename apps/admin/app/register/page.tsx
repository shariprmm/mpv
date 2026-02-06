// apps/admin/app/register/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  const [regionSlug, setRegionSlug] = useState("");
  const [regions, setRegions] = useState<{ id: number; name: string; slug: string }[]>([]);
  const [regionsError, setRegionsError] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const [emailSent, setEmailSent] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    async function loadRegions() {
      try {
        const r = await fetch(`${API}/public/regions`);
        const data = await r.json();
        if (!r.ok || !data?.items) {
          throw new Error(data?.error || "regions_load_failed");
        }
        if (active) {
          setRegions(data.items);
          if (!regionSlug && data.items.length > 0) {
            setRegionSlug(data.items[0].slug);
          }
        }
      } catch (e: any) {
        if (active) {
          setRegionsError(e?.message || "regions_load_failed");
        }
      }
    }

    loadRegions();
    return () => {
      active = false;
    };
  }, []);

  const errorMessage = useMemo(() => {
    if (!err) return null;
    const known: Record<string, string> = {
      invalid_region: "Выберите регион из списка.",
      region_not_found: "Регион не найден. Выберите из списка.",
      invalid_email: "Проверьте корректность email.",
      password_min_8: "Пароль должен быть не короче 8 символов.",
      invalid_company_name: "Введите корректное название компании.",
      email_exists: "Этот email уже зарегистрирован.",
      server_error: "Не удалось зарегистрироваться. Попробуйте позже.",
    };
    return known[err] || err;
  }, [err]);

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
          region_slug: regionSlug,
          phone 
        }),
      });

      const txt = await r.text();
      let data: any = null;
      try { data = JSON.parse(txt); } catch { data = { raw: txt }; }

      if (!r.ok) {
        throw new Error(data?.error || data?.message || "Ошибка регистрации");
      }

      setRegistered(true);
      setEmailSent(Boolean(data?.email_sent));
      setPassword("");
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

        {errorMessage && (
          <div className={styles.error} role="alert">
            {errorMessage}
          </div>
        )}

        {registered && (
          <div className={styles.success} role="status">
            {emailSent
              ? "Проверьте почту и подтвердите email, чтобы войти в аккаунт."
              : "Аккаунт создан, но письмо не отправилось. Проверьте корректность email и попробуйте войти позже."}
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

          {/* Поле Регион */}
          <div className={styles.field}>
            <label className={styles.label}>Регион</label>
            <select
              className={styles.input}
              value={regionSlug}
              onChange={(e) => setRegionSlug(e.target.value)}
              required
              aria-invalid={!regionSlug}
            >
              {regions.length === 0 && (
                <option value="" disabled>
                  Загрузка регионов...
                </option>
              )}
              {regions.map((region) => (
                <option key={region.id} value={region.slug}>
                  {region.name}
                </option>
              ))}
            </select>
            <div className={styles.hint}>
              {regionsError
                ? "Не удалось загрузить список регионов. Обновите страницу."
                : "Выберите регион, в котором работает компания."}
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
              minLength={8}
            />
            <div className={styles.hint}>
              Минимум 8 символов.
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
