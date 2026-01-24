"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "../page.module.css";

export default function Cut(props: {
  text: string;
  collapsedLines?: number;
  moreLabel?: string;
  lessLabel?: string;
}) {
  const { text, collapsedLines = 3, moreLabel = "Развернуть", lessLabel = "Свернуть" } = props;

  const clean = useMemo(() => String(text || "").replace(/\s+/g, " ").trim(), [text]);
  const [open, setOpen] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  const ref = useRef<HTMLDivElement | null>(null);

  // если текст изменился — закрываем, и заново считаем
  useEffect(() => {
    setOpen(false);
  }, [clean]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !clean) return;

    const measure = () => {
      // временно свернем, чтобы корректно замерить "обрезается или нет"
      const prevClamp = el.style.webkitLineClamp as any;
      const prevOverflow = el.style.overflow;
      const prevDisplay = el.style.display;
      const prevOrient = (el.style as any).webkitBoxOrient;

      el.style.display = "-webkit-box";
      (el.style as any).webkitBoxOrient = "vertical";
      el.style.overflow = "hidden";
      (el.style as any).webkitLineClamp = String(collapsedLines);

      // важно: дать браузеру применить стили
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      el.offsetHeight;

      // если scrollHeight больше clientHeight — значит реально обрезается
      const isCut = el.scrollHeight > el.clientHeight + 1;
      setCanExpand(isCut);

      // вернем как было (фактическое отображение контролируется open ниже)
      el.style.display = prevDisplay;
      (el.style as any).webkitBoxOrient = prevOrient;
      el.style.overflow = prevOverflow;
      (el.style as any).webkitLineClamp = prevClamp;
    };

    measure();

    // пересчет при изменении ширины/шрифтов/вёрстки
    const onResize = () => measure();
    window.addEventListener("resize", onResize);

    // более точный пересчет если контейнер меняет размер
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => measure());
      ro.observe(el);
    }

    return () => {
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, [clean, collapsedLines]);

  if (!clean) return null;

  return (
    <div>
      <div
        ref={ref}
        style={{
          display: "-webkit-box",
          WebkitLineClamp: open ? ("unset" as any) : String(collapsedLines),
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          lineHeight: "1.35",
          fontSize: "15px",
          color: "rgba(0,0,0,.75)",
        }}
      >
        {clean}
      </div>

      {canExpand ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={styles.MoreLink}
          style={{ marginTop: 8, background: "transparent", border: 0, padding: 0, cursor: "pointer" }}
          aria-expanded={open}
        >
          {open ? lessLabel : moreLabel}
        </button>
      ) : null}
    </div>
  );
}
