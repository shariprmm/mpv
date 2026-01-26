// apps/web/app/[region]/products/[slug]/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Breadcrumbs from "@/components/Breadcrumbs";
import GalleryLightbox from "@/components/GalleryLightbox";
import CompanyCard from "@/components/CompanyCard/CompanyCard";
import { renderTemplate } from "@/lib/renderTemplate";
import ProductReviewsBlock from "./_components/ProductReviewsBlock";
import {
  SITE_URL,
  buildProductSeo,
  computeMinMaxFromCompanies,
  jsonLdBreadcrumb,
  jsonLdProduct,
  regionLoc,
} from "@/lib/seo";

import styles from "./page.module.css";

export const revalidate = 60;

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://api.moydompro.ru";

async function apiGetWithStatus(path: string) {
  const base = String(API_BASE || "").replace(/\/$/, "");
  const url = base + path;
  const r = await fetch(url, { next: { revalidate } });
  const status = r.status;
  if (!r.ok) return { status, data: null };
  return { status, data: await r.json().catch(() => null) };
}

async function resolveProductName(productSlug: string) {
  const slug = String(productSlug || "").trim();
  if (!slug) return null;
  try {
    // В реальном кейсе можно добавить отдельный запрос, если нужно
    return slug; 
  } catch {}
  return slug;
}

// --- Хелперы (оставляем без изменений) ---
function toNum(v: any): number | null {
  if (v == null) return null;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function fmtRub(n: number | null | undefined) {
  if (n == null) return null;
  return new Intl.NumberFormat("ru-RU").format(n);
}
function normalizeImageUrl(u: any): string | null {
  const s = String(u ?? "").trim();
  if (!s) return null;
  if (s.startsWith("http")) return s;
  return s.startsWith("/") ? s : "/" + s;
}
function normalizePublicImageUrl(u: any) {
  return normalizeImageUrl(u)?.replace(/^https?:\/\/admin\.moydompro\.ru\/?/i, "https://moydompro.ru/");
}
function asArr(v: any) {
  if (Array.isArray(v)) return v;
  return []; 
}
function uniq(arr: any[]) { return Array.from(new Set(arr)); }
function companiesLabel(count: number) {
  const n = Math.abs(Number(count) || 0);
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "компания";
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "компании";
  return "компаний";
}
function pickCompanyPriceFrom(co: any, slug: string) { 
    const p = toNum(co.price_min ?? co.min_price ?? co.price);
    return { priceMin: p, currency: "RUB" };
}
// --- Конец хелперов ---

export async function generateMetadata({ params }: { params: { region: string; slug: string } }): Promise<Metadata> {
  const regionSlug = String(params?.region || "").trim() || "moskva";
  const productSlug = String(params?.slug || "").trim();
  
  try {
    const { status, data } = await apiGetWithStatus(
      `/public/region/${encodeURIComponent(regionSlug)}/products/${encodeURIComponent(productSlug)}`
    );

    if (status === 404 || !data?.ok) notFound();

    const productName = String(data?.product?.name || "").trim() || (await resolveProductName(productSlug)) || productSlug;
    const regionName = String(data?.region?.name || "").trim() || regionSlug;
    const companies = Array.isArray(data?.companies) ? data.companies : [];
    const pr = computeMinMaxFromCompanies(companies);

    const seo = buildProductSeo({
      regionSlug,
      regionName,
      productName,
      productSlug,
      price: pr,
      companiesCount: companies.length,
    });

    const regionIn = regionLoc({ slug: regionSlug, name: regionName });

    const ctx = {
      region: {
        id: data?.region?.id ?? "",
        slug: regionSlug,
        name: regionName,
        in: regionIn,
      },
      product: {
        id: data?.product?.id ?? "",
        slug: productSlug,
        name: productName,
      },
      price: {
        from: pr.priceMin != null ? Math.round(Number(pr.priceMin)) : "",
        to: pr.priceMax != null ? Math.round(Number(pr.priceMax)) : "",
        currency: pr.currency || "RUB",
        from_fmt: pr.priceMin != null ? fmtRub(Math.round(Number(pr.priceMin))) : "",
        to_fmt: pr.priceMax != null ? fmtRub(Math.round(Number(pr.priceMax))) : "",
      },
      companies: {
        count: companies.length,
        label: companiesLabel(companies.length),
      },
    };

    const overrideTitleRaw = String(data?.product?.seo_title ?? "").trim();
    const overrideDescRaw = String(data?.product?.seo_description ?? "").trim();

    const title =
      (overrideTitleRaw ? renderTemplate(overrideTitleRaw, ctx) : "") || renderTemplate(seo.title, ctx);

    const description =
      (overrideDescRaw ? renderTemplate(overrideDescRaw, ctx) : "") || renderTemplate(seo.description, ctx);

    return {
      title,
      description,
      alternates: { canonical: seo.canonical },
    };
  } catch {
    const productName = (await resolveProductName(productSlug)) || productSlug;
    const regionName = regionSlug;
    const seo = buildProductSeo({
      regionSlug,
      regionName,
      productName,
      productSlug,
      price: { priceMin: null, priceMax: null, currency: "RUB" },
      companiesCount: 0,
    });

    const regionIn = regionLoc({ slug: regionSlug, name: regionName });
    const ctx = {
      region: { id: "", slug: regionSlug, name: regionName, in: regionIn },
      product: { id: "", slug: productSlug, name: productName },
      price: { from: "", to: "", currency: "RUB", from_fmt: "", to_fmt: "" },
      companies: { count: 0, label: companiesLabel(0) },
    };

    return {
      title: renderTemplate(seo.title, ctx),
      description: renderTemplate(seo.description, ctx),
      alternates: { canonical: seo.canonical },
    };
  }
}

/* =========================
   ОСНОВНОЙ КОМПОНЕНТ
========================= */
export default async function ProductPage({
  params,
}: {
  params: { region: string; slug: string };
}) {
  const regionSlug = String(params?.region || "").trim();
  const productSlug = String(params?.slug || "").trim();

  if (!regionSlug || !productSlug) notFound();

  // 1. Запрос данных
  const { status, data } = await apiGetWithStatus(
    `/public/region/${encodeURIComponent(regionSlug)}/products/${encodeURIComponent(productSlug)}`
  );

  if (status === 404 || !data?.ok) notFound();

  const product = data.product;
  const region = data.region;
  const companies = Array.isArray(data.companies) ? data.companies : [];
  
  const productName = String(product.name || "").trim();
  const regionName = String(region.name || "").trim();
  const regionIn = regionLoc({ slug: regionSlug, name: regionName });

  const reviewsRes = await apiGetWithStatus(`/public/products/${product.id}/reviews?limit=20`);
  const reviews = Array.isArray(reviewsRes.data?.items) ? reviewsRes.data.items : [];
  const reviewsStats = reviewsRes.data?.stats || { reviews_count: 0, rating_avg: 0, total_count: 0 };

  const ratingAvgNum = Number(reviewsStats?.rating_avg);
  const ratingAvg = Number.isFinite(ratingAvgNum) && ratingAvgNum > 0 ? ratingAvgNum : 0;
  const ratingsCount = Number(reviewsStats?.total_count || 0);

  // 2. Обработка данных
  const pr = computeMinMaxFromCompanies(companies);
  
  // Картинки
  const canonicalImage = normalizePublicImageUrl(product.cover_image || product.image_url);
  const galleryRaw = asArr(product.gallery || product.photos || []).map(normalizePublicImageUrl).filter(Boolean);
  // Собираем все картинки, начиная с главной
  const allImages = uniq([canonicalImage, ...galleryRaw].filter(Boolean));

  // Характеристики
  const specsRaw = product.specs;
  let specs: {name: string, value: string}[] = [];
  if (Array.isArray(specsRaw)) {
      specs = specsRaw.map((x: any) => ({ name: x.name || x.key, value: x.value || x.val }));
  } else if (typeof specsRaw === 'object') {
      specs = Object.entries(specsRaw).map(([k, v]) => ({ name: k, value: String(v) }));
  }
  // Берем только первые 15, чтобы не перегружать
  specs = specs.slice(0, 15);

  const ctx = {
    region: {
      id: region?.id ?? "",
      slug: regionSlug,
      name: regionName,
      in: regionIn,
    },
    product: {
      id: product?.id ?? "",
      slug: productSlug,
      name: productName,
    },
    price: {
      from: pr.priceMin != null ? Math.round(Number(pr.priceMin)) : "",
      to: pr.priceMax != null ? Math.round(Number(pr.priceMax)) : "",
      currency: pr.currency || "RUB",
      from_fmt: pr.priceMin != null ? fmtRub(Math.round(Number(pr.priceMin))) : "",
      to_fmt: pr.priceMax != null ? fmtRub(Math.round(Number(pr.priceMax))) : "",
    },
    companies: {
      count: companies.length,
      label: companiesLabel(companies.length),
    },
  };

  // Описание
  const descriptionHtmlRaw = product.description || product.short_description || "";
  const descriptionHtml = renderTemplate(descriptionHtmlRaw, ctx);

  // Хлебные крошки
  const crumbs = [
    { label: "Главная", href: `/${regionSlug}` },
    { label: "Товары", href: `/${regionSlug}/products` },
    { label: productName },
  ];

  // JSON-LD (микроразметка)
  const ldBreadcrumbs = jsonLdBreadcrumb(crumbs.map(c => ({ 
    name: c.label, 
    item: c.href ? `${SITE_URL}${c.href}` : undefined 
  })));
  const ldProduct = {
    ...jsonLdProduct({
      url: `${SITE_URL}/${regionSlug}/products/${productSlug}`,
      name: productName,
      regionName,
      price: pr,
      companiesCount: companies.length,
      rating: ratingAvg || null,
      reviewsCount: ratingsCount || null,
    }),
    ...(allImages.length ? { image: allImages } : {}),
  };

  return (
    <div className={styles.wrap}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldBreadcrumbs) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldProduct) }} />
        
        {/* Навигация */}
        <Breadcrumbs items={crumbs} />

        {/* Заголовок H1 */}
        <div className={styles.h1Row}>
            <h1 className={styles.h1}>{productName} в {regionIn}</h1>
        </div>

        {/* --- ОСНОВНАЯ СЕТКА (GRID) --- */}
        <div className={styles.productGrid}>
            
            {/* ЛЕВАЯ КОЛОНКА */}
            <div className={styles.mainColumn}>
                
                {/* 1. БЛОК ФОТОГРАФИЙ */}
                <section className={styles.galleryBlock}>
                    <h2 className={styles.h2}>Фотографии {productName}</h2>
                    
                    {allImages.length > 0 ? (
                        <>
                            <div className={styles.heroImgWrap}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img 
                                    src={allImages[0]} 
                                    alt={productName} 
                                    className={styles.heroImg} 
                                    loading="eager"
                                />
                            </div>
                            
                            {allImages.length > 1 && (
                                <div className={styles.thumbsWrap}>
                                    <GalleryLightbox images={allImages} altBase={productName} />
                                </div>
                            )}
                        </>
                    ) : (
                        <div className={styles.missingImage}>
                            Изображение отсутствует
                        </div>
                    )}
                </section>

                {/* 2. БЛОК ХАРАКТЕРИСТИКИ */}
                {specs.length > 0 && (
                    <section className={styles.specsBlock} id="specs">
                        <h2 className={styles.h2}>Характеристики {productName}</h2>
                        <div className={styles.specTable}>
                            {specs.map((s, idx) => (
                                <div key={idx} className={styles.specRow}>
                                    <div className={styles.specName}>{s.name}</div>
                                    <div className={styles.specVal}>{s.value}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* 3. БЛОК ОПИСАНИЕ */}
                {descriptionHtml && (
                    <section className={styles.descBlock} id="desc">
                        <h2 className={styles.h2}>Описание {productName}</h2>
                        <div 
                            className={styles.descText}
                            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                        />
                    </section>
                )}

                <section className={styles.cardBlock} id="reviews">
                    <ProductReviewsBlock
                      productId={product.id}
                      initialItems={reviews}
                      initialStats={reviewsStats}
                    />
                </section>

            </div>

            {/* ПРАВАЯ КОЛОНКА (САЙДБАР) */}
            <aside className={styles.sideColumn}>
                <div className={styles.stickySummary}>
                    
                    <div className={styles.priceCard}>
                        <div className={styles.priceRow}>
                            <div className={styles.priceLabel}>Цена в {regionIn}</div>
                            <div className={styles.priceMain}>
                                {pr.priceMin ? `от ${fmtRub(pr.priceMin)} ₽` : "По запросу"}
                            </div>
                        </div>

                        {companies.length > 0 ? (
                            <div className={styles.companiesCount}>
                                ✓ {companies.length} {companiesLabel(companies.length)}
                            </div>
                        ) : (
                            <div className={styles.noOffers}>
                                Нет предложений
                            </div>
                        )}

                        <a href="#companies" className={styles.summaryBtn}>
                            Показать предложения ↓
                        </a>
                    </div>

                </div>
            </aside>

        </div>

        {/* --- НИЖНЯЯ СЕКЦИЯ: СПИСОК КОМПАНИЙ --- */}
        <section className={styles.companiesSection} id="companies">
            <h2 className={styles.h2}>Предложения компаний ({companies.length})</h2>
            
            {companies.length === 0 ? (
                <p className={styles.emptyCompanies}>К сожалению, пока нет активных предложений по этому товару в выбранном регионе.</p>
            ) : (
                <div className={styles.companiesListWrapper}>
                    <div className={styles.companiesList}>
                        {companies.map((co: any) => {
                            const p = pickCompanyPriceFrom(co, productSlug);
                            
                            // Подготовка данных для карточки
                            const cardData = {
                                id: co.id,
                                name: co.name,
                                logo_url: normalizePublicImageUrl(co.logo_url),
                                address: co.address || regionName,
                                rating: co.rating,
                                reviews_count: co.reviews_count,
                                is_verified: co.is_verified,
                                price_min: p.priceMin,
                                currency: "RUB",
                                photos: asArr(co.photos).map(normalizePublicImageUrl),
                                description: co.description,
                                items_count: co.items_count
                            };

                            return (
                                <CompanyCard
                                    key={co.id}
                                    regionSlug={regionSlug}
                                    company={cardData as any}
                                    companyHref={`/${regionSlug}/c/${co.id}`}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
        </section>

        <div className={styles.backRow}>
            <Link href={`/${regionSlug}/products`} className={styles.backLink}>← Все товары</Link>
        </div>
    </div>
  );
}
