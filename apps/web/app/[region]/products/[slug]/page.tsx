// apps/web/app/[region]/products/[slug]/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Breadcrumbs from "@/components/Breadcrumbs";
import GalleryLightbox from "@/components/GalleryLightbox";
import CompanyCard from "@/components/CompanyCard/CompanyCard";
import { renderTemplate } from "@/lib/renderTemplate";
import ProductReviewsBlock from "./_components/ProductReviewsBlock";
import QuizBanner from "./_components/QuizBanner";
import {
  SITE_URL,
  buildProductSeo,
  computeMinMaxFromCompanies,
  jsonLdBreadcrumb,
  jsonLdProduct,
  jsonLdWebPage,
  regionLoc,
} from "@/lib/seo";

import styles from "./page.module.css";

export const revalidate = 60;

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://api.moydompro.ru";

type ProductCategoryFlat = {
  id: number;
  slug: string;
  name: string;
  parent_id?: number | null;
  sort_order?: number | null;
};

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
    return slug; 
  } catch {}
  return slug;
}

// --- Хелперы ---
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
function normalizeCategoriesPayload(data: any): ProductCategoryFlat[] {
  const items = Array.isArray(data?.result)
    ? data.result
    : Array.isArray(data?.items)
      ? data.items
      : [];
  return items
    .map((x: any) => ({
      id: Number(x?.id ?? 0),
      slug: String(x?.slug || "").trim(),
      name: String(x?.name || "").trim(),
      parent_id: x?.parent_id ?? null,
      sort_order: x?.sort_order ?? null,
    }))
    .filter((x) => x.id > 0 && x.slug && x.name);
}
function resolveCategoryByProduct(categories: ProductCategoryFlat[], product: any) {
  const productCategoryId = Number(product?.category_id ?? product?.categoryId ?? product?.category?.id ?? 0);
  const productCategorySlug = String(
    product?.category_slug ?? product?.categorySlug ?? product?.category?.slug ?? ""
  ).trim();
  const productCategoryName = String(
    product?.category_name ?? product?.categoryName ?? product?.category?.name ?? ""
  ).trim();

  let current =
    (productCategoryId
      ? categories.find((c) => c.id === productCategoryId)
      : null) ||
    (productCategorySlug
      ? categories.find((c) => c.slug === productCategorySlug)
      : null) ||
    (productCategoryName
      ? categories.find((c) => c.name.toLowerCase() === productCategoryName.toLowerCase())
      : null);

  if (!current && productCategoryName) {
    current = categories.find((c) => c.name.toLowerCase().includes(productCategoryName.toLowerCase()));
  }

  const parent = current?.parent_id
    ? categories.find((c) => c.id === Number(current?.parent_id))
    : null;

  return { current, parent };
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

// --- Metadata ---
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
      CITY: regionName,
      CITY_IN: regionIn,
      REGION: regionName,
      REGION_IN: regionIn,
      region: { id: data?.region?.id ?? "", slug: regionSlug, name: regionName, in: regionIn },
      product: { id: data?.product?.id ?? "", slug: productSlug, name: productName },
      price: {
        from: pr.priceMin != null ? Math.round(Number(pr.priceMin)) : "",
        to: pr.priceMax != null ? Math.round(Number(pr.priceMax)) : "",
        currency: pr.currency || "RUB",
        from_fmt: pr.priceMin != null ? fmtRub(Math.round(Number(pr.priceMin))) : "",
        to_fmt: pr.priceMax != null ? fmtRub(Math.round(Number(pr.priceMax))) : "",
      },
      companies: { count: companies.length, label: companiesLabel(companies.length) },
    };

    const overrideTitleRaw = String(data?.product?.seo_title ?? "").trim();
    const overrideDescRaw = String(data?.product?.seo_description ?? "").trim();

    const title = (overrideTitleRaw ? renderTemplate(overrideTitleRaw, ctx) : "") || renderTemplate(seo.title, ctx);
    const description = (overrideDescRaw ? renderTemplate(overrideDescRaw, ctx) : "") || renderTemplate(seo.description, ctx);

    return { title, description, alternates: { canonical: seo.canonical } };
  } catch {
    return { title: "Товар не найден", description: "" };
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

  const [categoriesRes, reviewsRes] = await Promise.all([
    apiGetWithStatus(`/product-categories?flat=1`),
    apiGetWithStatus(`/public/products/${product.id}/reviews?limit=20`),
  ]);
  const reviews = Array.isArray(reviewsRes.data?.items) ? reviewsRes.data.items : [];
  const reviewsStats = reviewsRes.data?.stats || { reviews_count: 0, rating_avg: 0, total_count: 0 };

  // 2. Обработка данных
  const pr = computeMinMaxFromCompanies(companies);
  const canonicalImage = normalizePublicImageUrl(product.cover_image || product.image_url);
  const galleryRaw = asArr(product.gallery || product.photos || []).map(normalizePublicImageUrl).filter(Boolean);
  const allImages = uniq([canonicalImage, ...galleryRaw].filter(Boolean));

  // Характеристики
  const specsRaw = product.specs;
  let specs: {name: string, value: string}[] = [];
  if (Array.isArray(specsRaw)) {
      specs = specsRaw.map((x: any) => ({ name: x.name || x.key, value: x.value || x.val }));
  } else if (typeof specsRaw === 'object') {
      specs = Object.entries(specsRaw).map(([k, v]) => ({ name: k, value: String(v) }));
  }
  specs = specs.slice(0, 15);

  const findSpecValue = (keys: string[]) => {
    const lowered = keys.map((k) => k.toLowerCase());
    const match = specs.find((s) => {
      const name = String(s.name || "").toLowerCase();
      return lowered.some((key) => name.includes(key));
    });
    return match?.value ? String(match.value).trim() : null;
  };

  const brandName =
    findSpecValue(["бренд", "brand", "марка", "производитель"]) || "МойДомПро";
  const modelName = findSpecValue(["модель", "model"]) || productName;

  const ctx = {
    region: { id: region?.id ?? "", slug: regionSlug, name: regionName, in: regionIn },
    product: { id: product?.id ?? "", slug: productSlug, name: productName },
    price: {
      from: pr.priceMin != null ? Math.round(Number(pr.priceMin)) : "",
      to: pr.priceMax != null ? Math.round(Number(pr.priceMax)) : "",
      currency: pr.currency || "RUB",
      from_fmt: pr.priceMin != null ? fmtRub(Math.round(Number(pr.priceMin))) : "",
      to_fmt: pr.priceMax != null ? fmtRub(Math.round(Number(pr.priceMax))) : "",
    },
    companies: { count: companies.length, label: companiesLabel(companies.length) },
  };

  const descriptionHtml = renderTemplate(product.description || product.short_description || "", ctx);
  const descriptionPlain = String(product.short_description || product.description || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const categories = normalizeCategoriesPayload(categoriesRes.data);
  const { current: currentCategory, parent: parentCategory } = resolveCategoryByProduct(categories, product);
  const groupName = currentCategory?.name || parentCategory?.name || null;
  const quizConfigId = (() => {
    const hints = [
      productName,
      currentCategory?.name,
      parentCategory?.name,
      currentCategory?.slug,
      parentCategory?.slug,
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());
    const isSeptic = hints.some((value) => value.includes("септик") || value.includes("septic"));
    return isSeptic ? "septic" : "general";
  })();

  // Хлебные крошки
  const crumbs = [
    { label: "Главная", href: `/${regionSlug}` },
    { label: "Товары", href: `/${regionSlug}/products` },
    ...(parentCategory ? [{ label: parentCategory.name, href: `/${regionSlug}/products/c/${encodeURIComponent(parentCategory.slug)}` }] : []),
    ...(currentCategory ? [{ label: currentCategory.name, href: `/${regionSlug}/products/c/${encodeURIComponent(currentCategory.slug)}` }] : []),
    { label: productName },
  ];

  // JSON-LD
  const ldBreadcrumbs = jsonLdBreadcrumb(crumbs.map(c => ({ name: c.label, item: c.href ? `${SITE_URL}${c.href}` : undefined })));
  const ldProduct = {
    ...jsonLdProduct({
      url: `${SITE_URL}/${regionSlug}/products/${productSlug}`,
      name: productName,
      regionName,
      price: pr,
      companiesCount: companies.length,
      rating: Number(reviewsStats?.rating_avg) || null,
      reviewsCount: Number(reviewsStats?.total_count) || null,
      brandName,
      modelName,
      groupName,
      availability: companies.length > 0 ? "InStock" : "OutOfStock",
    }),
    ...(allImages.length ? { image: allImages } : {}),
    "@id": `${SITE_URL}/${regionSlug}/products/${productSlug}#product`,
  };
  const ldWebPage = jsonLdWebPage({
    url: `${SITE_URL}/${regionSlug}/products/${productSlug}`,
    name: `${productName} в ${regionIn}`,
    description: descriptionPlain || undefined,
    imageUrl: allImages[0] || null,
    mainEntityId: `${SITE_URL}/${regionSlug}/products/${productSlug}#product`,
  });

  return (
    <div className={styles.wrap}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldBreadcrumbs) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldWebPage) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldProduct) }} />
        
        <Breadcrumbs items={crumbs} />

        <div className={styles.h1Row}>
            <h1 className={styles.h1}>{productName} в {regionIn}</h1>
        </div>

        <div className={styles.productGrid}>
            
            {/* ЛЕВАЯ КОЛОНКА */}
            <div className={styles.mainColumn}>
                
                {/* 1. БЛОК ФОТОГРАФИЙ И ГАЛЕРЕИ */}
                <section className={styles.galleryBlock}>
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
                            
                            {/* Миниатюры теперь внутри этого же блока */}
                            {allImages.length > 1 && (
                                <div className={styles.thumbsContainer}>
                                    <GalleryLightbox images={allImages} altBase={productName} />
                                </div>
                            )}
                        </>
                    ) : (
                        <div className={styles.missingImage}>Изображение отсутствует</div>
                    )}
                </section>

                {/* 2. БЛОК ХАРАКТЕРИСТИКИ */}
                {specs.length > 0 && (
                    <section className={styles.specsBlock} id="specs">
                        <h2 className={styles.h2}>Характеристики</h2>
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
                        <h2 className={styles.h2}>Описание</h2>
                        <div 
                            className={styles.descText}
                            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                        />
                    </section>
                )}

                {/* 4. ОТЗЫВЫ */}
                <section className={styles.cardBlock} id="reviews">
                    <ProductReviewsBlock
                      productId={product.id}
                      initialItems={reviews}
                      initialStats={reviewsStats}
                    />
                </section>
            </div>

            {/* ПРАВАЯ КОЛОНКА (САЙДБАР С ЦЕНОЙ) */}
            <aside className={styles.sideColumn}>
                <div className={styles.stickySummary}>
                    <div className={styles.priceCard}>
                        <div className={styles.priceHeader}>
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
                            <div className={styles.companiesCount} style={{background: '#f3f4f6', color: '#666'}}>
                                Нет предложений
                            </div>
                        )}

                        <a href="#companies" className={styles.summaryBtn}>
                            Показать предложения ↓
                        </a>
                    </div>
                    <QuizBanner configId={quizConfigId} />
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
