"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./Scroller.module.css";

export default function Scroller(props: {
  children: React.ReactNode;
  itemWidth: number;
  itemGap: number;
  height: number;
}) {
  const { children, itemWidth, itemGap, height } = props;
  const ref = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const step = useMemo(() => Math.max(240, itemWidth + itemGap), [itemWidth, itemGap]);

  function update() {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 2);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;

    const onScroll = () => update();
    el.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(() => update());
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  const scrollBy = (dx: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dx, behavior: "smooth" });
  };

  return (
    <div className={styles.wrapper}>
      <div
        ref={ref}
        className={styles.scroller}
        style={{ "--item-gap": `${itemGap}px`, "--height": `${height}px` } as React.CSSProperties}
      >
        {children}
      </div>

      {canLeft ? (
        <button
          type="button"
          onClick={() => scrollBy(-step)}
          aria-label="Влево"
          className={`${styles.arrowButton} ${styles.arrowLeft}`}
        >
          ‹
        </button>
      ) : null}

      {canRight ? (
        <button
          type="button"
          onClick={() => scrollBy(step)}
          aria-label="Вправо"
          className={`${styles.arrowButton} ${styles.arrowRight}`}
        >
          ›
        </button>
      ) : null}
    </div>
  );
}
