"use client";
import { useState } from "react";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.moydompro.ru").replace(/\/$/, "");

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function submit(e: any) {
    e.preventDefault();
    setMsg("Входим...");
    try {
      const r = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) throw new Error(data.error || "login_failed");
      location.href = "/price";
    } catch (err: any) {
      setMsg(`Ошибка: ${err?.message || err}`);
    }
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 520, margin: "0 auto" }}>
      <h1>Вход компании</h1>
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }} />
        <input placeholder="Пароль" type="password" value={password} onChange={e => setPassword(e.target.value)}
          style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }} />
        <button style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd", fontWeight: 800 }}>Войти</button>
        <div style={{ opacity: 0.75 }}>{msg}</div>
      </form>
    </main>
  );
}
