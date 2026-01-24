// /opt/moydompro-repo/apps/web/components/GalleryLightbox.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  images: string[];
  altBase?: string;
  className?: string;

  /** если передан — вместо grid превью рендерим триггер (кнопку) и открываем лайтбокс по клику */
  trigger?: React.ReactNode;
  startIndex?: number;
  triggerClassName?: string;
};

export default function GalleryLightbox(props: Props) {
  const {
    images,
    altBase = "Фото",
    className,
    trigger,
    startIndex = 0,
    triggerClassName,
  } = props;

  const list = useMemo(
    () => (Array.isArray(images) ? images.filter(Boolean) : []),
    [images]
  );

  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);
  const prev = useCallback(
    () => setIdx((p) => (p - 1 + list.length) % list.length),
    [list.length]
  );
  const next = useCallback(
    () => setIdx((p) => (p + 1) % list.length),
    [list.length]
  );

  const openAt = useCallback(
    (i: number) => {
      if (!list.length) return;
      setIdx(Math.max(0, Math.min(i, list.length - 1)));
      setOpen(true);
    },
    [list.length]
  );

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };

    document.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close, prev, next]);

  if (!list.length) return null;

  const overlay = open ? (
    <div
      className="mpvLbOverlay"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фото"
      data-mpv-lightbox="1"
    >
      <button
        className="mpvLbBackdrop"
        type="button"
        onClick={close}
        aria-label="Закрыть"
      />

      <div className="mpvLbBody" onMouseDown={(e) => e.stopPropagation()}>
        <button className="mpvLbClose" type="button" onClick={close} aria-label="Закрыть">
          ✕
        </button>

        {list.length > 1 ? (
          <>
            <button className="mpvLbNav mpvLbPrev" type="button" onClick={prev} aria-label="Предыдущее">
              ‹
            </button>
            <button className="mpvLbNav mpvLbNext" type="button" onClick={next} aria-label="Следующее">
              ›
            </button>
          </>
        ) : null}

        <div className="mpvLbFrame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mpvLbImg" src={list[idx]} alt={`${altBase} — ${idx + 1}`} />
        </div>

        <div className="mpvLbCounter">
          {idx + 1} / {list.length}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className={className}>
      {trigger ? (
        <button
          type="button"
          className={triggerClassName || "mpvGalleryTrigger"}
          onClick={() => openAt(startIndex)}
          aria-label="Открыть фото"
        >
          {trigger}
        </button>
      ) : (
        <div className="mpvGalleryGrid">
          {list.map((src, i) => (
            <button
              key={src + i}
              type="button"
              className="mpvGalleryItem"
              onClick={() => openAt(i)}
              aria-label={`Открыть фото ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="mpvGalleryImg"
                src={src}
                alt={`${altBase} — ${i + 1}`}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {/* ВАЖНО: рендерим оверлей в body, чтобы не зависеть от сетки/контейнеров */}
      {mounted && overlay ? createPortal(overlay, document.body) : null}
    </div>
  );
}
