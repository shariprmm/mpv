"use client";

import Link from "next/link";
import Image from "next/image";
import React, { useState } from "react";
import { useRegion } from "@/context/RegionContext";
import styles from "./SiteFooter.module.css";

// Типы данных
type CategoryItem = {
  id: number;
  name: string;
  slug: string;
};

interface SiteFooterProps {
  productCats?: CategoryItem[];
  serviceCats?: CategoryItem[];
}

export function SiteFooter({ productCats = [], serviceCats = [] }: SiteFooterProps) {
  const { currentRegion } = useRegion();
  const regionSlug = currentRegion?.slug || "moskva";
  const regionNameIn = currentRegion?.name_in || "Санкт-Петербурге";
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={`footer-grid ${styles.grid}`}>
          {/* 1. О компании */}
          <div className={styles.column}>
            {/* Логотип */}
            <Link href={`/${regionSlug}`} className={styles.logoLink}>
              <Image
                src="/images/logo.png"
                alt="МойДомПро"
                width={40}
                height={40}
                className={styles.logoImage}
              />
              <span className={styles.logoText}>
                <span className={styles.logoTitle}>МойДомПро</span>
                <span className={styles.logoSubtitle}>маркетплейс услуг для дома</span>
              </span>
            </Link>

            <p className={styles.description}>
              Агрегатор инженерных решений и услуг для загородного строительства в {regionNameIn}.
            </p>
            <Link href="/about" className={styles.link}>
              О проекте
            </Link>
            <Link href="/journal" className={styles.link}>
              Журнал
            </Link>
            <Link href="/master/login" className={`${styles.link} ${styles.masterLink}`}>
              Вход для мастеров
            </Link>
          </div>

          {/* 2. Каталог товаров */}
          <div className={styles.column}>
            <h3 className={styles.heading}>Каталог товаров</h3>
            <CategoryList
              items={productCats}
              baseUrl={`/${regionSlug}/products/c`}
              rootUrl={`/${regionSlug}/products`}
              rootLabel="Все товары"
            />
          </div>

          {/* 3. Услуги */}
          <div className={styles.column}>
            <h3 className={styles.heading}>Услуги мастеров</h3>
            <CategoryList
              items={serviceCats}
              baseUrl={`/${regionSlug}/services/c`}
              rootUrl={`/${regionSlug}/services`}
              rootLabel="Все услуги"
            />
          </div>

          {/* 4. Связь */}
          <div className={styles.column}>
            <h3 className={styles.heading}>Связь</h3>
            <div className={styles.nav}>
              {/* ✅ ТЕМНАЯ КНОПКА */}
              <button className={`btn ${styles.contactButton}`}>
                Связаться с нами
              </button>

              <a href="mailto:info@moydompro.ru" className={styles.contactLink}>
                info@moydompro.ru
              </a>
              <div className={styles.socialLinks}>
                <span className={styles.socialHeading}>Мы в соцсетях</span>
                <a
                  href="https://t.me/moydompro"
                  className={styles.link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Telegram
                </a>
                <a
                  href="https://dzen.ru/moydompro"
                  className={styles.link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Dzen
                </a>
              </div>
              <Link href="/sitemap" className={`${styles.link} ${styles.sitemapLink}`}>
                Карта сайта (HTML)
              </Link>
            </div>
          </div>
        </div>

        {/* Нижняя плашка */}
        <div className={styles.bottomBar}>
          <div className={styles.bottomInfo}>© {currentYear} МойДомПро.</div>
          <div className={styles.bottomLinks}>
            <Link href="/policy" className={styles.bottomLink}>
              Конфиденциальность
            </Link>
            <Link href="/terms" className={styles.bottomLink}>
              Оферта
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ... (компонент CategoryList без изменений)
function CategoryList({
  items,
  baseUrl,
  rootUrl,
  rootLabel,
}: {
  items: CategoryItem[];
  baseUrl: string;
  rootUrl: string;
  rootLabel: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const LIMIT = 6;

  if (!items || items.length === 0) {
    return (
      <nav className={styles.nav}>
        <span className={`${styles.link} ${styles.linkMuted}`}>Нет категорий</span>
      </nav>
    );
  }

  const visibleItems = isExpanded ? items : items.slice(0, LIMIT);
  const hasMore = items.length > LIMIT;

  return (
    <nav className={styles.nav}>
      {visibleItems.map((cat) => (
        <Link key={cat.id || cat.slug} href={`${baseUrl}/${cat.slug}`} className={styles.link}>
          {cat.name}
        </Link>
      ))}

      {hasMore && !isExpanded && (
        <button onClick={() => setIsExpanded(true)} className={styles.showMoreButton}>
          Показать еще ({items.length - LIMIT}) ↓
        </button>
      )}

      {hasMore && isExpanded && (
        <button onClick={() => setIsExpanded(false)} className={styles.showMoreButton}>
          Свернуть ↑
        </button>
      )}

      <Link href={rootUrl} className={`${styles.link} ${styles.rootLink}`}>
        {rootLabel} →
      </Link>
    </nav>
  );
}
