"use client";

import Link from "next/link";
import Image from "next/image";
import React, { useMemo, useState } from "react";
import styles from "./CompanyCard.module.css";

const PUBLIC_SITE =
  (process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "").replace(/\/+$/, "") ||
  "https://moydompro.ru";

function asStr(v: any) {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  return s.trim();
}

function normalizeDoubleSlashes(url: string) {
  // не трогаем https://
  return url.replace(/([^:]\/)\/+/g, "$1");
}

function toPublicUploadsUrl(u: string | null | undefined) {
  const s = asStr(u);
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return normalizeDoubleSlashes(s);

  if (s.startsWith("/uploads/")) return normalizeDoubleSlashes(`${PUBLIC_SITE}${s}`);
  if (s.startsWith("uploads/")) return normalizeDoubleSlashes(`${PUBLIC_SITE}/${s}`);

  if (s.startsWith("/")) return normalizeDoubleSlashes(`${PUBLIC_SITE}${s}`);

  return s;
}

export type CompanyCardData = {
  id: number;
  name: string;

  is_verified?: boolean;
  rating?: number | null;
  reviews_count?: number | null;

  logo_url?: string | null;
  address?: string | null;
  phone?: string | null;

  price_min?: number | null;
  currency?: string | null;

  photos?: any;

  description?: string | null;
  short_description?: string | null;

  items_count?: number | null;

  item_title?: string | null;
};

function formatInt(n: number) {
  try {
    return new Intl.NumberFormat("ru-RU").format(n);
  } catch {
    return String(n);
  }
}

function formatPrice(price: number | null | undefined, currency: string | null | undefined) {
  if (price == null || !Number.isFinite(Number(price))) return null;
  const cur = (currency || "RUB").toUpperCase();
  const value = Number(price);
  const num = formatInt(Math.round(value));
  if (cur === "RUB" || cur === "RUR") return `${num} ₽`;
  return `${num} ${cur}`;
}

function formatRating(r: any) {
  const n = Number(r);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(1);
}

function parsePhotos(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x || "")).filter(Boolean);

  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      if (Array.isArray(p)) return p.map((x) => String(x || "")).filter(Boolean);
    } catch {}
  }

  if (v && typeof v === "object" && Array.isArray((v as any).photos)) {
    return (v as any).photos.map((x: any) => String(x || "")).filter(Boolean);
  }

  return [];
}

function takePhotos(photosRaw: any, limit = 12) {
  return parsePhotos(photosRaw)
    .map((p) => toPublicUploadsUrl(p))
    .filter(Boolean)
    .slice(0, limit);
}

function looksLikeCodeOrMarkup(s: string) {
  const t = String(s || "").trim();
  if (!t) return false;
  const bad = ["import ", "export ", "function ", "const ", "=>", "```", "<div", "</", "{", "}", "/*", "//", ".tsx"];
  const lines = t.split("\n");
  return lines.length >= 3 || bad.some((x) => t.toLowerCase().includes(x));
}

function normalizeTelHref(phone: string) {
  const p = String(phone || "").replace(/[^\d+]/g, "");
  return p ? `tel:${p}` : "";
}

export default function CompanyCard(props: {
  company: CompanyCardData;
  regionSlug: string;
  companyHref?: string;
}) {
  const { company, regionSlug } = props;

  const rating = formatRating(company.rating);
  const reviews = company.reviews_count ? Number(company.reviews_count) : 0;

  const logo = toPublicUploadsUrl(company.logo_url);
  const photos = takePhotos(company.photos, 12);

  const price = formatPrice(company.price_min ?? null, company.currency ?? "RUB");

  const companyHref = props.companyHref || `/${regionSlug}/c/${company.id}`;
  const telHref = company.phone ? normalizeTelHref(company.phone) : "";

  const rawDesc = asStr(company.short_description ?? company.description);
  const cleanDesc =
    rawDesc && !looksLikeCodeOrMarkup(rawDesc) ? rawDesc.replace(/\s+/g, " ").trim() : "";

  const [expanded, setExpanded] = useState(false);
  const DESC_LIMIT = 150;
  const isLong = cleanDesc.length > DESC_LIMIT;

  const shownDesc = useMemo(() => {
    if (!cleanDesc) return "";
    if (expanded) return cleanDesc;
    return isLong ? cleanDesc.slice(0, DESC_LIMIT).trim() + "…" : cleanDesc;
  }, [cleanDesc, expanded, isLong]);

  // ✅ gallery: 4 превью + "+N"
  const thumbs = 4;
  const preview = photos.slice(0, thumbs);
  const more = Math.max(0, photos.length - thumbs);

  return (
    <article className={styles.card}>
      {/* ✅ HEADER: аватар + заголовок + цена */}
      <div className={styles.head}>
        <div className={styles.avatar}>
          {logo ? (
            <Image
              src={logo}
              alt={company.name}
              width={72}
              height={72}
              className={styles.avatarImg}
              unoptimized
              sizes="72px"
            />
          ) : (
            <div className={styles.avatarStub} aria-hidden="true">
              {asStr(company.name).slice(0, 1).toUpperCase() || "C"}
            </div>
          )}
        </div>

        <div className={styles.headMain}>
          <div className={styles.titleRow}>
            <Link href={companyHref} className={styles.titleLink}>
              {company.name}
            </Link>
            {company.is_verified ? <span className={styles.verified}>Проверен</span> : null}
          </div>

          <div className={styles.subRow}>
            {rating ? (
              <span className={styles.rating}>
                <span className={styles.star} aria-hidden="true">
                  ★
                </span>
                {rating}
              </span>
            ) : (
              <span className={styles.ratingMuted}>Нет рейтинга</span>
            )}

            <span className={styles.dot} aria-hidden="true">
              ·
            </span>

            <span className={styles.reviews}>{reviews ? `${reviews} отзывов` : "Без отзывов"}</span>
          </div>
        </div>

        <div className={styles.right}>
          {price ? (
            <div className={styles.priceValue}>{price}</div>
          ) : (
            <div className={styles.priceMuted}>по договорённости</div>
          )}
          {company.items_count ? (
            <div className={styles.itemsCount}>ещё {company.items_count}</div>
          ) : null}
        </div>
      </div>

      {/* ✅ BODY: всё на всю ширину */}
      <div className={styles.body}>
        {company.address ? (
          <div className={styles.addrRow} title={company.address}>
            {company.address}
          </div>
        ) : null}

        {shownDesc ? (
          <div className={styles.desc}>
            {shownDesc}{" "}
            {isLong ? (
              <button
                type="button"
                className={styles.readMore}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Свернуть" : "Развернуть"}
              </button>
            ) : null}
          </div>
        ) : null}

        {photos.length ? (
          <Link href={companyHref} className={styles.galleryLink} aria-label="Примеры работ">
            <div className={styles.gallery}>
              {preview.map((src, i) => (
                <div key={src + i} className={styles.thumb}>
                  <Image
                    src={src}
                    alt={`${company.name || "Компания"} — фото ${i + 1}`}
                    width={84}
                    height={84}
                    className={styles.thumbImg}
                    unoptimized
                  />
                </div>
              ))}

              {more > 0 ? (
                <div className={styles.moreThumb} aria-label={`Ещё ${more} фото`}>
                  {/* берём фон из последней превьюшки, чтобы было красиво */}
                  <div className={styles.moreOverlay}>+{more}</div>
                </div>
              ) : null}
            </div>
          </Link>
        ) : null}
      </div>

      <div className={styles.actions}>
        <Link href={companyHref} className={styles.btnSecondary}>
          Профиль
        </Link>

        {telHref ? (
          <a href={telHref} className={styles.btnSecondary}>
            Позвонить
          </a>
        ) : (
          <Link href={companyHref} className={styles.btnSecondary}>
            Позвонить
          </Link>
        )}

        <Link href={companyHref} className={styles.btnPrimary}>
          Чат
        </Link>
      </div>
    </article>
  );
}
