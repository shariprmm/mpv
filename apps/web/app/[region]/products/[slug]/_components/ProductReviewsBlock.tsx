"use client";

import { useMemo, useState } from "react";
import styles from "../page.module.css";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.moydompro.ru";

function hasLinks(text: string) {
  const t = String(text || "");
  if (!t.trim()) return false;

  if (/(https?:\/\/|www\.)/i.test(t)) return true;
  if (/\b(t\.me\/|telegram\.me\/|vk\.com\/|wa\.me\/)\S+/i.test(t)) return true;
  if (/\b[a-z0-9-]{2,}\.(ru|com|net|org|info|io|biz|me|site|online|store|pro|app|dev)\b/i.test(t))
    return true;

  return false;
}

function formatDate(d: string) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    }).format(new Date(d));
  } catch {
    return String(d || "");
  }
}

type ReviewItem = {
  id: number;
  rating: number;
  text: string | null;
  created_at: string;
};

type Stats = {
  reviews_count: number;
  rating_avg: number | string;
};

export default function ProductReviewsBlock({
  productId,
  initialItems,
  initialStats,
}: {
  productId: number;
  initialItems: ReviewItem[];
  initialStats: Stats;
}) {
  const [items, setItems] = useState<ReviewItem[]>(initialItems || []);
  const [stats, setStats] = useState<Stats>(initialStats || { reviews_count: 0, rating_avg: 0 });

  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);

  const [text, setText] = useState<string>("");
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const [error, setError] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);

  const title = useMemo(() => {
    const cnt = Number(stats?.reviews_count || 0);
    return cnt ? `Отзывы (${cnt})` : "Отзывов пока нет";
  }, [stats]);

  const avg = useMemo(() => {
    const n = Number(stats?.rating_avg);
    return Number.isFinite(n) && n > 0 ? n.toFixed(1) : null;
  }, [stats]);

  async function submit() {
    setError("");

    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      setError("Поставьте оценку от 1 до 5.");
      return;
    }

    const t = text.trim().replace(/\s+/g, " ");
    if (t && hasLinks(t)) {
      setError("Ссылки в отзыве запрещены.");
      return;
    }

    setSending(true);
    try {
      const base = String(API_BASE || "").replace(/\/$/, "");
      const res = await fetch(`${base}/public/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: r, text: t || null }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        const code = data?.error || "unknown";
        if (code === "links_not_allowed") setError("Ссылки в отзыве запрещены.");
        else if (code === "too_many_reviews") setError("Вы уже оставляли отзыв за последние 24 часа.");
        else setError("Не удалось отправить отзыв. Попробуйте позже.");
        return;
      }

      if (data?.item) {
        setItems((prev) => [data.item, ...prev]);
      }

      if (data?.stats) {
        setStats(data.stats);
      } else {
        setStats((s) => ({ ...s, reviews_count: Number(s.reviews_count || 0) + 1 }));
      }

      setRating(0);
      setHover(0);
      setText("");
      setIsOpen(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className={styles.ReviewsHeaderRow}>
        <div className={styles.ReviewsTitle}>{title}</div>
        {avg ? (
          <div className={styles.ReviewsAvg}>
            <span className={styles.GreyText}>Средняя оценка:</span>&nbsp;
            <b>{avg}</b>
          </div>
        ) : null}
      </div>

      <div className={styles.UgcCard}>
        <div className={styles.UgcTitle}>Вы покупали этот товар?</div>
        <div className={styles.UgcDesc}>Поставьте оценку или оставьте отзыв</div>

        <div className={styles.StarsRow} role="radiogroup" aria-label="Оценка от 1 до 5">
          {[1, 2, 3, 4, 5].map((v) => {
            const active = (hover || rating) >= v;
            return (
              <button
                key={v}
                type="button"
                className={`${styles.StarBtn} ${active ? styles.StarActive : ""}`}
                onMouseEnter={() => setHover(v)}
                onMouseLeave={() => setHover(0)}
                onClick={() => {
                  setRating(v);
                  setIsOpen(true);
                  setError("");
                }}
                aria-label={`${v} из 5`}
              >
                ★
              </button>
            );
          })}
        </div>

        {isOpen ? (
          <div className={styles.ReviewForm}>
            {rating === 0 ? (
              <div className={styles.ReviewHint}>
                Сначала выберите оценку (1–5 ★), затем можно написать отзыв.
              </div>
            ) : null}

            <textarea
              className={styles.ReviewTextarea}
              placeholder={
                rating === 0
                  ? "Сначала выберите оценку (звёзды сверху)…"
                  : "Напишите пару слов (необязательно). Ссылки запрещены."
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              disabled={rating === 0 || sending}
            />

            {error ? <div className={styles.ReviewError}>{error}</div> : null}

            <div className={styles.ReviewActions}>
              <button
                type="button"
                className={`${styles.Btn} ${styles.BtnAction}`}
                onClick={() => {
                  if (rating === 0) {
                    setError("Поставьте оценку от 1 до 5.");
                    return;
                  }
                  submit();
                }}
                disabled={sending}
              >
                {sending ? "Отправляем…" : "Отправить"}
              </button>

              <button
                type="button"
                className={`${styles.Btn} ${styles.BtnNormal}`}
                onClick={() => {
                  setIsOpen(false);
                  setError("");
                }}
                disabled={sending}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={`${styles.Btn} ${styles.BtnNormal}`}
            onClick={() => setIsOpen(true)}
          >
            Оценить
          </button>
        )}
      </div>

      {items?.length ? (
        <div className={styles.ReviewsList}>
          {items.map((it) => (
            <article key={it.id} className={styles.ReviewItem}>
              <div className={styles.ReviewMetaRow}>
                <div className={styles.ReviewStars} aria-label={`Оценка ${it.rating} из 5`}>
                  {"★★★★★".slice(0, it.rating)}
                  <span className={styles.ReviewStarsMuted}>
                    {"★★★★★".slice(0, 5 - it.rating)}
                  </span>
                </div>
                <div className={styles.ReviewDate}>{formatDate(it.created_at)}</div>
              </div>

              {it.text ? <div className={styles.ReviewText}>{it.text}</div> : null}
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
