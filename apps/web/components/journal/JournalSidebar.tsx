"use client";

import React, { useState } from "react";
import styles from "./JournalSidebar.module.css";

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
        <div className={styles.title}>Получить консультацию</div>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+7 (___) ___-__-__"
          className={styles.input}
        />
        <button type="submit" className={styles.button}>
          Отправить
        </button>
      </form>
    </aside>
  );
}
