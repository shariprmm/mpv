// apps/web/components/SiteHeader.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRegion } from "@/context/RegionContext"; // ✅ 1. Импорт контекста
import styles from "./SiteHeader.module.css";

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
        name_in: regionObj.name_in || `в ${regionObj.name}`, // Фоллбэк склонения
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
        name_in: regionObj.name_in || `в ${regionObj.name}`,
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
    <header className={styles.header}>
      {/* ... Весь ваш остальной JSX код (он без изменений) ... */}
      {/* Я оставлю эту часть как есть, чтобы не дублировать огромный блок, */}
      {/* главное, что логика goRegion и useEffect теперь обновляют контекст. */}
      {/* Скопируйте JSX из вашего старого файла, начиная с {showRegionConfirm ? ( ... */}
      {showRegionConfirm ? (
        <div className={styles.regionBanner}>
          <div
            className={`${styles.regionBannerInner} ${
              isMobile ? styles.regionBannerInnerMobile : ""
            }`}
          >
            <div className={styles.regionText}>
              Ваш регион: <span className={styles.regionLabel}>{currentRegionLabel}</span>?
            </div>

            <div className={styles.regionActions}>
              <button type="button" onClick={confirmRegionYes} className={styles.regionConfirmYes}>
                Да
              </button>

              <button type="button" onClick={confirmRegionNo} className={styles.regionConfirmNo}>
                Нет
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={`${styles.headerInner} ${isMobile ? styles.headerInnerMobile : ""}`}
      >
        <Link href={homeHref} className={styles.logoLink}>
          <Image
            src="/images/logo.png"
            alt="МойДомПро"
            width={isMobile ? 34 : 40}
            height={isMobile ? 34 : 40}
            priority
            className={styles.logoImage}
          />

          <span className={styles.logoText}>
            <span
              className={`${styles.logoTitle} ${isMobile ? styles.logoTitleMobile : ""}`}
            >
              МойДомПро
            </span>
            <span
              className={`${styles.logoSubtitle} ${
                isMobile ? styles.logoSubtitleHidden : ""
              }`}
            >
              маркетплейс услуг для дома
            </span>
          </span>
        </Link>

        {!isMobile ? (
          <form onSubmit={onSubmit} className={styles.searchForm}>
            {IconSearch}

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Найдите идеального мастера и услугу"
              className={styles.searchInput}
            />

            <button type="submit" className={styles.searchSubmit} title="Искать">
              Найти
            </button>
          </form>
        ) : (
          <div className={styles.mobileActions}>
            <button
              type="button"
              onClick={() => {
                setRegionOpen(false);
                setSearchOpen((v) => !v);
              }}
              aria-label="Открыть поиск"
              className={styles.iconButton}
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
              className={styles.iconButton}
              title={currentRegionLabel}
            >
              {IconPin}
            </button>

            <Link href="https://admin.moydompro.ru/login" className={styles.loginLink}>
              Войти
            </Link>
          </div>
        )}

        {!isMobile ? (
          <nav className={styles.nav}>
            <details ref={regionDetailsRef} className={styles.regionDetails}>
              <summary className={styles.regionSummary}>
                {currentRegionLabel}
                <span className={styles.regionCaret}>▾</span>
              </summary>

              <div className={styles.regionDropdown}>
                {regions.length === 0 ? (
                  <div className={styles.regionEmpty}>Нет списка регионов</div>
                ) : (
                  <>
                    <div className={styles.regionSearch}>
                      {IconSearch}
                      <input
                        value={regionQuery}
                        onChange={(e) => setRegionQuery(e.target.value)}
                        placeholder="Найти город"
                        className={styles.regionSearchInput}
                      />
                      {regionQuery ? (
                        <button
                          type="button"
                          onClick={() => setRegionQuery("")}
                          className={styles.regionClearBtn}
                          title="Очистить"
                        >
                          ✕
                        </button>
                      ) : null}
                    </div>

                    <div className={styles.regionList}>
                      {filteredRegions.length === 0 ? (
                        <div className={styles.regionEmpty}>Ничего не найдено</div>
                      ) : (
                        filteredRegions.map((r) => (
                          <button
                            key={r.slug}
                            type="button"
                            onClick={() => goRegion(r.slug)}
                            className={`${styles.regionOption} ${
                              r.slug === currentRegionSlug ? styles.regionOptionActive : ""
                            }`}
                          >
                            <div className={styles.regionOptionText}>{r.name}</div>
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
              className={`${styles.loginLink} ${styles.loginLinkDesktop}`}
            >
              Войти
            </Link>
          </nav>
        ) : null}
      </div>

      {isMobile && searchOpen ? (
        <div className={styles.mobileSearchWrap}>
          <div className={styles.mobileSearchInner}>
            <form onSubmit={onSubmit} className={styles.mobileSearchForm}>
              {IconSearch}
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Найдите идеального мастера и услугу"
                className={styles.searchInput}
                autoFocus
              />
              <button type="submit" className={styles.mobileSearchSubmit}>
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
          className={styles.regionModalOverlay}
          onClick={() => setRegionOpen(false)}
        >
          <div className={styles.regionModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.regionModalHeader}>
              <div className={styles.regionModalTitle}>Выберите город</div>
              <button
                type="button"
                onClick={() => setRegionOpen(false)}
                className={styles.regionModalClose}
              >
                ✕
              </button>
            </div>

            <div className={styles.regionModalSearch}>
              {IconSearch}
              <input
                value={regionQuery}
                onChange={(e) => setRegionQuery(e.target.value)}
                placeholder="Найти город"
                className={styles.regionSearchInput}
                autoFocus
              />
              {regionQuery && (
                <button
                  type="button"
                  onClick={() => setRegionQuery("")}
                  className={styles.regionClearBtn}
                >
                  ✕
                </button>
              )}
            </div>

            <div className={styles.regionModalList}>
              {filteredRegions.length === 0 ? (
                <div className={styles.regionEmpty}>Ничего не найдено</div>
              ) : (
                filteredRegions.map((r) => (
                  <button
                    key={r.slug}
                    type="button"
                    onClick={() => goRegion(r.slug)}
                    className={`${styles.regionModalOption} ${
                      r.slug === currentRegionSlug ? styles.regionModalOptionActive : ""
                    }`}
                  >
                    <div className={styles.regionModalOptionText}>{r.name}</div>
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
