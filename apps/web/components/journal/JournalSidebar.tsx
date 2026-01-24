"use client";

import React, { useState } from "react";

export default function JournalSidebar() {
  const [phone, setPhone] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // тут позже подключишь отправку
    alert("Отправим заявку: " + phone);
  }

  return (
    <aside>
      <form onSubmit={onSubmit}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Получить консультацию</div>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+7 (___) ___-__-__"
          style={{
            width: "100%",
            height: 44,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,.15)",
            padding: "0 12px",
          }}
        />
        <button
          type="submit"
          style={{
            width: "100%",
            height: 44,
            marginTop: 10,
            borderRadius: 12,
            border: 0,
            cursor: "pointer",
          }}
        >
          Отправить
        </button>
      </form>
    </aside>
  );
}
