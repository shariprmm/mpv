"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

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
    <div style={{ position: "relative" }}>
      <div
        ref={ref}
        style={{
          overflowX: "auto",
          overflowY: "hidden",
          display: "flex",
          gap: itemGap,
          height,
          paddingBottom: 2,
          scrollBehavior: "smooth",
        }}
      >
        {children}
      </div>

      {canLeft ? (
        <button
          type="button"
          onClick={() => scrollBy(-step)}
          aria-label="Влево"
          style={arrowBtn("left")}
        >
          ‹
        </button>
      ) : null}

      {canRight ? (
        <button
          type="button"
          onClick={() => scrollBy(step)}
          aria-label="Вправо"
          style={arrowBtn("right")}
        >
          ›
        </button>
      ) : null}
    </div>
  );
}

function arrowBtn(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    [side]: 6,
    width: 34,
    height: 34,
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,.12)",
    background: "#fff",
    boxShadow: "0 2px 10px rgba(0,0,0,.08)",
    cursor: "pointer",
    fontSize: 22,
    lineHeight: "34px",
    textAlign: "center",
    userSelect: "none",
  } as React.CSSProperties;
}
