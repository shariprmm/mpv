// apps/web/components/SiteHeader.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRegion } from "@/context/RegionContext"; // ✅ 1. Импорт контекста

// Расширяем тип, чтобы он совпадал с тем, что ждет контекст
type RegionItem = { slug: string; name: string; name_in?: string; id?: number };

function useIsMobile(breakpointPx = 920) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, [breakpointPx]);

  return isMobile;
}

// ✅ cookie helpers
function getCookie(name: string) {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(
    new RegExp(
      "(^|; )" +
        name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") +
        "=([^;]*)"
    )
  );
  return m ? decodeURIComponent(m[2]) : "";
}
function setCookie(name: string, value: string, maxAgeSec = 31536000) {
  if (typeof document === "undefined") return;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
    value
  )}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax`;
}

function isValidRegionSlug(slug: string, regions: RegionItem[]) {
  const s = String(slug || "").trim();
  return !!s && regions.some((r) => r.slug === s);
}

function firstPathSeg(pathname: string | null) {
  const p = (pathname || "/").split("?")[0];
  return p.split("/").filter(Boolean)[0] || "";
}

export default function SiteHeader(props: { regions?: RegionItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile(920);

  // ✅ 2. Достаем функцию обновления из контекста
  const { setCurrentRegion } = useRegion();

  const regions = props.regions || [];

  const regionDetailsRef = useRef<HTMLDetailsElement | null>(null);

  const closeRegionDetails = () => {
    const el = regionDetailsRef.current;
    if (el?.open) el.open = false;
  };
  const openRegionDetails = () => {
    const el = regionDetailsRef.current;
    if (el && !el.open) el.open = true;
  };

  const [currentRegionSlug, setCurrentRegionSlug] = useState("moskva");

  const isRegionalPath = useMemo(() => {
    const seg = firstPathSeg(pathname);
    return !!seg && regions.some((r) => r.slug === seg);
  }, [pathname, regions]);

  useEffect(() => {
    if (!regions.length) return;

    const seg = firstPathSeg(pathname);
    let targetSlug = "moskva";

    // 1) регион в URL
    if (seg && regions.some((r) => r.slug === seg)) {
      targetSlug = seg;
    } 
    // 2) регион из cookie
    else {
      const fromCookie = getCookie("region");
      if (isValidRegionSlug(fromCookie, regions)) {
        targetSlug = fromCookie;
      }
    }

    // Устанавливаем локальный стейт
    setCurrentRegionSlug(targetSlug);

    // ✅ 3. ВАЖНО: Обновляем глобальный контекст, чтобы футер увидел изменение
    const regionObj = regions.find((r) => r.slug === targetSlug);
    if (regionObj) {
      // Приводим типы, если API не возвращает id/name_in, можно добавить заглушки
      setCurrentRegion({
        id: regionObj.id || 0,
        name: regionObj.name,
        slug: regionObj.slug,
        name_in: regionObj.name_in || `в ${regionObj.name}` // Фоллбэк склонения
      });
    }

  }, [pathname, regions, setCurrentRegion]); // Добавили setCurrentRegion в зависимости

  const currentRegionLabel = useMemo(() => {
    const r = regions.find((x) => x.slug === currentRegionSlug);
    return r?.name || currentRegionSlug;
  }, [regions, currentRegionSlug]);

  const homeHref = `/${currentRegionSlug}`;

  const [q, setQ] = useState("");
  const [regionQuery, setRegionQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);

  const [showRegionConfirm, setShowRegionConfirm] = useState(false);

  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      setQ(u.searchParams.get("q") || "");
    } catch {
      setQ("");
    }
  }, [pathname]);

  useEffect(() => {
    setSearchOpen(false);
    setRegionOpen(false);
    closeRegionDetails();
  }, [pathname]);

  useEffect(() => {
    if (!regions.length) return;
    const confirmed = getCookie("region_confirmed") === "1";
    setShowRegionConfirm(!confirmed);
  }, [regions.length, currentRegionSlug]);

  const filteredRegions = useMemo(() => {
    const s = regionQuery.trim().toLowerCase();
    if (!s) return regions;
    return regions.filter((r) => {
      const n = String(r.name || "").toLowerCase();
      const sl = String(r.slug || "").toLowerCase();
      return n.includes(s) || sl.includes(s);
    });
  }, [regions, regionQuery]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = (q || "").trim();

    if (!query) {
      setSearchOpen(false);
      return;
    }

    router.push(`/${currentRegionSlug}/search?q=${encodeURIComponent(query)}`);
  }

  function confirmRegionYes() {
    setCookie("region", currentRegionSlug);
    setCookie("region_confirmed", "1");
    setShowRegionConfirm(false);
  }

  function confirmRegionNo() {
    if (isMobile) {
      setRegionOpen(true);
    } else {
      openRegionDetails();
    }
  }

  function goRegion(slug: string) {
    setRegionOpen(false);
    setRegionQuery("");
    closeRegionDetails();

    setCookie("region", slug);
    setCookie("region_confirmed", "1");
    setShowRegionConfirm(false);

    setCurrentRegionSlug(slug);

    // ✅ 4. Обновляем контекст сразу при клике
    const regionObj = regions.find((r) => r.slug === slug);
    if (regionObj) {
      setCurrentRegion({
        id: regionObj.id || 0,
        name: regionObj.name,
        slug: regionObj.slug,
        name_in: regionObj.name_in || `в ${regionObj.name}`
      });
    }

    const qs = typeof window !== "undefined" ? window.location.search : "";
    const pathNoQs = (pathname || "/").split("?")[0];

    if (isRegionalPath) {
      const parts = pathNoQs.split("/").filter(Boolean);
      const rest = parts.slice(1).join("/");
      const next = rest ? `/${slug}/${rest}${qs}` : `/${slug}${qs}`;
      router.push(next);
      return;
    }

    router.refresh();
  }

  const IconSearch = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M16.5 16.5 21 21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );

  const IconPin = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#fff",
        borderBottom: "1px solid rgba(0,0,0,.08)",
      }}
    >
      {/* ... Весь ваш остальной JSX код (он без изменений) ... */}
      {/* Я оставлю эту часть как есть, чтобы не дублировать огромный блок, */}
      {/* главное, что логика goRegion и useEffect теперь обновляют контекст. */}
      {/* Скопируйте JSX из вашего старого файла, начиная с {showRegionConfirm ? ( ... */}
      {showRegionConfirm ? (
        <div
          style={{
            borderBottom: "1px solid rgba(0,0,0,.06)",
            background: "#F9FAFB",
          }}
        >
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              padding: isMobile ? "8px 12px" : "10px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 400, color: "#111827" }}>
              Ваш регион:{" "}
              <span style={{ fontWeight: 400 }}>{currentRegionLabel}</span>?
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={confirmRegionYes}
                style={{
                  border: 0,
                  background: "#111827",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 400,
                  fontSize: 13,
                  padding: "8px 12px",
                  borderRadius: 12,
                  whiteSpace: "nowrap",
                }}
              >
                Да
              </button>

              <button
                type="button"
                onClick={confirmRegionNo}
                style={{
                  border: "1px solid rgba(0,0,0,.10)",
                  background: "#fff",
                  color: "#111",
                  cursor: "pointer",
                  fontWeight: 400,
                  fontSize: 13,
                  padding: "8px 12px",
                  borderRadius: 12,
                  whiteSpace: "nowrap",
                }}
              >
                Нет
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: isMobile ? "10px 12px" : "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 10 : 16,
        }}
      >
        <Link
          href={homeHref}
          style={{
            textDecoration: "none",
            color: "#111",
            display: "flex",
            alignItems: "center",
            gap: 10,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <Image
            src="/images/logo.png"
            alt="МойДомПро"
            width={isMobile ? 34 : 40}
            height={isMobile ? 34 : 40}
            priority
            style={{ display: "block" }}
          />

          <span style={{ display: "grid", lineHeight: 1.05 }}>
            <span style={{ fontWeight: 400, fontSize: isMobile ? 16 : 22 }}>
              МойДомПро
            </span>
            <span
              style={{
                fontSize: isMobile ? 10 : 12,
                opacity: 0.7,
                fontWeight: 300,
                display: isMobile ? "none" : "block",
              }}
            >
              маркетплейс услуг для дома
            </span>
          </span>
        </Link>

        {!isMobile ? (
          <form
            onSubmit={onSubmit}
            style={{
              width: "min(520px, 45vw)",
              display: "flex",
              alignItems: "center",
              background: "#F3F4F6",
              borderRadius: 999,
              padding: "10px 14px",
              gap: 10,
              flexShrink: 0,
            }}
          >
            {IconSearch}

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Найдите идеального мастера и услугу"
              style={{
                flex: 1,
                border: 0,
                outline: "none",
                background: "transparent",
                fontSize: 14,
              }}
            />

            <button
              type="submit"
              style={{
                border: 0,
                background: "transparent",
                cursor: "pointer",
                fontWeight: 400,
                fontSize: 13,
                padding: "6px 10px",
                borderRadius: 999,
              }}
              title="Искать"
            >
              Найти
            </button>
          </form>
        ) : (
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setRegionOpen(false);
                setSearchOpen((v) => !v);
              }}
              aria-label="Открыть поиск"
              style={{
                border: "1px solid rgba(0,0,0,.10)",
                background: "#fff",
                width: 40,
                height: 40,
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
              title="Поиск"
            >
              {IconSearch}
            </button>

            <button
              type="button"
              onClick={() => {
                setSearchOpen(false);
                setRegionOpen((v) => !v);
              }}
              aria-label="Выбрать регион"
              style={{
                border: "1px solid rgba(0,0,0,.10)",
                background: "#fff",
                width: 40,
                height: 40,
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
              title={currentRegionLabel}
            >
              {IconPin}
            </button>

            <Link
              href="https://admin.moydompro.ru/login"
              style={{
                textDecoration: "none",
                color: "#fff",
                background: "#111827",
                padding: "10px 14px",
                borderRadius: 12,
                fontWeight: 400,
                whiteSpace: "nowrap",
                fontSize: 13,
              }}
            >
              Войти
            </Link>
          </div>
        )}

        {!isMobile ? (
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginLeft: "auto",
            }}
          >
            <details ref={regionDetailsRef} style={{ position: "relative" }}>
              <summary
                style={{
                  listStyle: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontWeight: 300,
                  userSelect: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {currentRegionLabel}
                <span style={{ opacity: 0.6 }}>▾</span>
              </summary>

              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 10px)",
                  width: 360,
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,.08)",
                  borderRadius: 14,
                  boxShadow: "0 12px 30px rgba(0,0,0,.10)",
                  padding: 10,
                }}
              >
                {regions.length === 0 ? (
                  <div style={{ padding: 10, opacity: 0.7 }}>
                    Нет списка регионов
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        background: "#F3F4F6",
                        borderRadius: 12,
                        padding: "10px 12px",
                        marginBottom: 10,
                      }}
                    >
                      {IconSearch}
                      <input
                        value={regionQuery}
                        onChange={(e) => setRegionQuery(e.target.value)}
                        placeholder="Найти город"
                        style={{
                          flex: 1,
                          border: 0,
                          outline: "none",
                          background: "transparent",
                          fontSize: 14,
                        }}
                      />
                      {regionQuery ? (
                        <button
                          type="button"
                          onClick={() => setRegionQuery("")}
                          style={{
                            border: 0,
                            background: "transparent",
                            cursor: "pointer",
                            fontWeight: 400,
                            opacity: 0.7,
                          }}
                          title="Очистить"
                        >
                          ✕
                        </button>
                      ) : null}
                    </div>

                    <div
                      style={{
                        maxHeight: 360,
                        overflow: "auto",
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      {filteredRegions.length === 0 ? (
                        <div style={{ padding: 10, opacity: 0.7 }}>
                          Ничего не найдено
                        </div>
                      ) : (
                        filteredRegions.map((r) => (
                          <button
                            key={r.slug}
                            type="button"
                            onClick={() => goRegion(r.slug)}
                            style={{
                              textAlign: "left",
                              width: "100%",
                              border: 0,
                              background:
                                r.slug === currentRegionSlug
                                  ? "rgba(109,40,217,.08)"
                                  : "transparent",
                              padding: "10px 10px",
                              borderRadius: 10,
                              cursor: "pointer",
                              color: "#111",
                            }}
                          >
                            <div style={{ fontWeight: 300 }}>{r.name}</div>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </details>

            <Link
              href="https://admin.moydompro.ru/login"
              style={{
                textDecoration: "none",
                color: "#fff",
                background: "#111827",
                padding: "12px 22px",
                borderRadius: 14,
                fontWeight: 400,
                whiteSpace: "nowrap",
              }}
            >
              Войти
            </Link>
          </nav>
        ) : null}
      </div>

      {isMobile && searchOpen ? (
        <div style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}>
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              padding: "10px 12px",
            }}
          >
            <form
              onSubmit={onSubmit}
              style={{
                display: "flex",
                alignItems: "center",
                background: "#F3F4F6",
                borderRadius: 14,
                padding: "10px 12px",
                gap: 10,
              }}
            >
              {IconSearch}
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Найдите идеального мастера и услугу"
                style={{
                  flex: 1,
                  border: 0,
                  outline: "none",
                  background: "transparent",
                  fontSize: 14,
                }}
                autoFocus
              />
              <button
                type="submit"
                style={{
                  border: 0,
                  background: "#111827",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 400,
                  fontSize: 13,
                  padding: "10px 12px",
                  borderRadius: 12,
                }}
              >
                Найти
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {isMobile && regionOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.35)",
            zIndex: 60,
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: "76px 12px 12px",
          }}
          onClick={() => setRegionOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: "#fff",
              borderRadius: 16,
              border: "1px solid rgba(0,0,0,.08)",
              boxShadow: "0 12px 30px rgba(0,0,0,.18)",
              padding: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 16 }}>
                Выберите город
              </div>
              <button
                type="button"
                onClick={() => setRegionOpen(false)}
                style={{
                  border: "1px solid rgba(0,0,0,.10)",
                  background: "#fff",
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  cursor: "pointer",
                  fontWeight: 400,
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#F3F4F6",
                borderRadius: 12,
                padding: "10px 12px",
                marginTop: 10,
              }}
            >
              {IconSearch}
              <input
                value={regionQuery}
                onChange={(e) => setRegionQuery(e.target.value)}
                placeholder="Найти город"
                style={{
                  flex: 1,
                  border: 0,
                  outline: "none",
                  background: "transparent",
                  fontSize: 14,
                }}
                autoFocus
              />
              {regionQuery && (
                <button
                  type="button"
                  onClick={() => setRegionQuery("")}
                  style={{
                    border: 0,
                    background: "transparent",
                    cursor: "pointer",
                    fontWeight: 400,
                    opacity: 0.7,
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            <div
              style={{
                marginTop: 10,
                maxHeight: "60vh",
                overflow: "auto",
                display: "grid",
                gap: 6,
              }}
            >
              {filteredRegions.length === 0 ? (
                <div style={{ padding: 10, opacity: 0.7 }}>
                  Ничего не найдено
                </div>
              ) : (
                filteredRegions.map((r) => (
                  <button
                    key={r.slug}
                    type="button"
                    onClick={() => goRegion(r.slug)}
                    style={{
                      textAlign: "left",
                      border: "1px solid rgba(0,0,0,.08)",
                      background:
                        r.slug === currentRegionSlug
                          ? "rgba(109,40,217,.08)"
                          : "#fff",
                      padding: "10px 10px",
                      borderRadius: 12,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 400 }}>{r.name}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}