"use client";

import Link from "next/link";
import Image from "next/image";
import React, { useState } from "react";
import { useRegion } from "@/context/RegionContext";

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
    <footer style={footerStyle}>
      <div className="container">
        <div className="footer-grid" style={gridStyle}>
          
          {/* 1. О компании */}
          <div style={colStyle}>
            {/* Логотип */}
            <Link
              href={`/${regionSlug}`}
              style={{
                textDecoration: "none",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                whiteSpace: "nowrap",
                flexShrink: 0,
                marginBottom: "12px",
              }}
            >
              <Image
                src="/images/logo.png"
                alt="МойДомПро"
                width={40}
                height={40}
                style={{ display: "block" }}
              />
              <span style={{ display: "grid", lineHeight: 1.05 }}>
                <span style={{ fontWeight: 400, fontSize: "22px" }}>
                  МойДомПро
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    opacity: 0.7,
                    fontWeight: 300,
                    display: "block",
                  }}
                >
                  маркетплейс услуг для дома
                </span>
              </span>
            </Link>

            <p style={descStyle}>
              Агрегатор инженерных решений и услуг для загородного строительства в {regionNameIn}.
            </p>
            <Link href="/about" style={linkStyle}>О проекте</Link>
            <Link href="/journal" style={linkStyle}>Журнал</Link>
            <Link href="/master/login" style={{...linkStyle, color: "#93c5fd", marginTop: "10px"}}>
              Вход для мастеров
            </Link>
          </div>

          {/* 2. Каталог товаров */}
          <div style={colStyle}>
            <h3 style={headingStyle}>Каталог товаров</h3>
            <CategoryList 
              items={productCats} 
              baseUrl={`/${regionSlug}/products/c`} 
              rootUrl={`/${regionSlug}/products`}
              rootLabel="Все товары"
            />
          </div>

          {/* 3. Услуги */}
          <div style={colStyle}>
            <h3 style={headingStyle}>Услуги мастеров</h3>
            <CategoryList 
              items={serviceCats} 
              baseUrl={`/${regionSlug}/services/c`} 
              rootUrl={`/${regionSlug}/services`}
              rootLabel="Все услуги"
            />
          </div>

          {/* 4. Связь */}
          <div style={colStyle}>
            <h3 style={headingStyle}>Связь</h3>
            <div style={navStyle}>
              {/* ✅ ТЕМНАЯ КНОПКА */}
              <button className="btn" style={btnStyle}>
                Связаться с нами
              </button>
              
              <a href="mailto:info@moydompro.ru" style={contactLinkStyle}>
                info@moydompro.ru
              </a>
              <Link href="/sitemap" style={{...linkStyle, marginTop: "15px", textDecoration: "underline", opacity: 0.6}}>
                Карта сайта (HTML)
              </Link>
            </div>
          </div>

        </div>

        {/* Нижняя плашка */}
        <div style={bottomBarStyle}>
          <div style={{ opacity: 0.5 }}>© {currentYear} МойДомПро.</div>
          <div style={{ display: "flex", gap: "20px" }}>
            <Link href="/policy" style={bottomLinkStyle}>Конфиденциальность</Link>
            <Link href="/terms" style={bottomLinkStyle}>Оферта</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ... (компонент CategoryList без изменений)
function CategoryList({ items, baseUrl, rootUrl, rootLabel }: { items: CategoryItem[], baseUrl: string, rootUrl: string, rootLabel: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const LIMIT = 6;

  if (!items || items.length === 0) {
    return (
      <nav style={navStyle}>
        <span style={{...linkStyle, opacity: 0.5}}>Нет категорий</span>
      </nav>
    );
  }

  const visibleItems = isExpanded ? items : items.slice(0, LIMIT);
  const hasMore = items.length > LIMIT;

  return (
    <nav style={navStyle}>
      {visibleItems.map((cat) => (
        <Link 
          key={cat.id || cat.slug} 
          href={`${baseUrl}/${cat.slug}`} 
          style={linkStyle}
        >
          {cat.name}
        </Link>
      ))}

      {hasMore && !isExpanded && (
        <button onClick={() => setIsExpanded(true)} style={showMoreBtnStyle}>
          Показать еще ({items.length - LIMIT}) ↓
        </button>
      )}

      {hasMore && isExpanded && (
        <button onClick={() => setIsExpanded(false)} style={showMoreBtnStyle}>
          Свернуть ↑
        </button>
      )}

      <Link href={rootUrl} style={{...linkStyle, opacity: 0.5, marginTop: 5, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 8}}>
        {rootLabel} →
      </Link>
    </nav>
  );
}


// --- Стили ---

const footerStyle: React.CSSProperties = {
  backgroundColor: "#111",
  color: "#fff",
  padding: "60px 0 30px 0",
  marginTop: "auto",
  borderTop: "1px solid rgba(255,255,255,0.1)",
  fontSize: "14px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "40px",
  alignItems: "start",
};

const colStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const descStyle: React.CSSProperties = {
  lineHeight: "1.5",
  color: "rgba(255,255,255,0.5)",
  margin: "0 0 10px 0",
  maxWidth: "260px",
};

const headingStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "8px",
  color: "rgba(255,255,255,0.4)",
};

const navStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const linkStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.8)",
  textDecoration: "none",
  transition: "color 0.2s",
  display: "block",
};

const showMoreBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#3b82f6",
  cursor: "pointer",
  textAlign: "left",
  padding: 0,
  fontSize: "13px",
  fontWeight: 500,
  marginTop: "5px",
};

const contactLinkStyle: React.CSSProperties = {
  color: "#fff",
  textDecoration: "none",
  fontSize: "15px",
  fontWeight: 500,
};

// ✅ ОБНОВЛЕННЫЙ СТИЛЬ КНОПКИ
const btnStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  textAlign: "center",
  cursor: "pointer",
  backgroundColor: "#222", // Темный фон
  color: "#fff",           // Белый текст
  border: "1px solid rgba(255,255,255,0.15)", // Легкая обводка
  borderRadius: "8px",
  fontWeight: 600,
  fontSize: "14px",
  marginBottom: "10px",
  transition: "background 0.2s",
};

const bottomBarStyle: React.CSSProperties = {
  marginTop: "60px",
  paddingTop: "20px",
  borderTop: "1px solid rgba(255,255,255,0.05)",
  display: "flex",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "15px",
  fontSize: "12px",
};

const bottomLinkStyle: React.CSSProperties = {
  color: "inherit",
  textDecoration: "none",
  opacity: 0.5,
};