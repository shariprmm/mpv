// apps/web/app/[region]/products/c/[category]/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import { renderTemplate } from "@/lib/renderTemplate";
import styles from "./page.module.css";

export const revalidate = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://moydompro.ru";

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://api.moydompro.ru";

/** ✅ abs URL (canonical / JSON-LD) */
function absUrl(path: string) {
  const base = String(SITE_URL).replace(/\/+$/, "");
  const p = String(path || "");
  const norm = p.startsWith("/") ? p : `/${p}`;
  return base + norm;
}

/** ✅ JSON-LD helpers */
function jsonLdBreadcrumb(items: Array<{ name: string; item: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((x, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: x.name,
      item: x.item,
    })),
  };
}

function jsonLdCollectionPage(opts: { url: string; name: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    url: opts.url,
    inLanguage: "ru-RU",
    isPartOf: {
      "@type": "WebSite",
      name: "МойДомПро",
      url: absUrl("/"),
    },
  };
}

function jsonLdItemList(opts: {
  url: string;
  name: string;
  items: Array<{ url: string; name: string }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: opts.name,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: opts.items.length,
    itemListElement: opts.items.map((it, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: it.url,
      name: it.name,
    })),
  };
}

async function apiGetSafe(path: string) {
  const base = String(API_BASE || "").replace(/\/$/, "");
  const url = base + path;
  const r = await fetch(url, { next: { revalidate } });
  if (!r.ok) return null;
  return r.json();
}

/** ✅ жесткая валидация slug категории товара: латиница/цифры/дефис/подчёркивание */
function isInvalidProductCategorySlug(v: any) {
  const s = String(v ?? "").trim();
  if (!s) return true;
  return !/^[a-z0-9_-]+$/i.test(s);
}

type ProductItem = {
  id: number;
  name: string;
  slug: string;
  category?: string | null;
  companies_count?: number | null;
  price_min?: number | string | null;
  currency?: string | null;
  image_url?: string | null;
};

type ProductCategorySeo = {
  id: number;
  slug: string;
  name: string;
  parent_id?: number | null;
  seo_h1?: string | null;
  seo_text?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
};

type ProductCategoryFlat = {
  id: number;
  slug: string;
  name: string;
  parent_id?: number | null;
  sort_order?: number | null;
};

function toNum(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function fmtRub(n: number | null | undefined) {
  if (n === null || n === undefined) return null;
  return new Intl.NumberFormat("ru-RU").format(n);
}

/** Заглушка (положи файл в apps/web/public/images/product-placeholder.png) */
const FALLBACK_IMG = "/images/product-placeholder.png";

/**
 * ✅ Нормализация URL картинки:
 * - если прилетело уже url-encoded (https%3A%2F%2F...) → decode
 * - если прилетело //uploads/... или //moydompro.ru/... → делаем https:
 * - если прилетело uploads/... или /uploads/... → добавляем домен
 * - убираем двойные // в path (но не трогаем https://)
 */
const IMG_ORIGIN = "https://moydompro.ru";

function safeDecodeMaybe(s: string) {
  if (!/%2F|%3A/i.test(s)) return s;
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function normalizeSlashes(url: string) {
  return url.replace(/([^:]\/)\/+/g, "$1");
}

function absImg(input: string | null | undefined) {
  let s = String(input ?? "").trim();
  if (!s) return null;

  s = safeDecodeMaybe(s).trim();

  // protocol-relative
  if (s.startsWith("//")) s = "https:" + s;

  // относительный путь без слеша
  if (s.startsWith("uploads/")) s = "/" + s;

  // абсолютный URL
  if (s.startsWith("http://") || s.startsWith("https://")) {
    return normalizeSlashes(s);
  }

  // относительный URL
  if (!s.startsWith("/")) s = "/" + s;
  return normalizeSlashes(IMG_ORIGIN + s);
}

/** простое "в Балашихе" / "в Москве" и т.п. */
function toPrepositional(city: string) {
  const s = String(city || "").trim();
  if (!s) return s;

  const lower = s.toLowerCase();
  const exceptions: Record<string, string> = {
    москва: "Москве",
    "санкт-петербург": "Санкт-Петербурге",
    петербург: "Петербурге",
    "нижний новгород": "Нижнем Новгороде",
  };
  if (exceptions[lower]) return exceptions[lower];

  const parts = s.split(/(\s+|-)/);
  let lastWordIdx = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (!/^\s+$/.test(parts[i]) && parts[i] !== "-") {
      lastWordIdx = i;
      break;
    }
  }
  if (lastWordIdx === -1) return s;

  const w = parts[lastWordIdx];
  const wl = w.toLowerCase();

  let inflected = w;
  if (/[аеёиоуыэюя]$/.test(wl)) {
    inflected = w;
    if (/[ая]$/.test(wl)) inflected = w.slice(0, -1) + "е";
  } else if (/ь$/.test(wl)) {
    inflected = w.slice(0, -1) + "и";
  } else if (/й$/.test(wl)) {
    inflected = w.slice(0, -1) + "е";
  } else {
    inflected = w + "е";
  }

  parts[lastWordIdx] = inflected;
  return parts.join("");
}

/* ====== Категории плитками ====== */

function pickCategoryImage(kind: "product" | "service", slug: string, label: string) {
  const s = `${slug} ${label}`.toLowerCase();

  const product: Array<[RegExp, string]> = [
    [/septic|септик|станц/i, "/images/cat/product-septic.png"],
    [/water|вода|насос/i, "/images/cat/product-water.png"],
    [/heating|отопл|котел|радиат/i, "/images/cat/product-heating.png"],
    [/electric|электр|кабел|щит/i, "/images/cat/product-electric.png"],
    [/drain|дренаж/i, "/images/cat/product-drainage.png"],
    [/fence|забор|ворот/i, "/images/cat/product-fence.png"],
    [/material|материал|достав/i, "/images/cat/product-materials.png"],
  ];

  const list = kind === "product" ? product : [];
  for (const [re, img] of list) if (re.test(s)) return img;

  return kind === "product"
    ? "/images/cat/product-default.png"
    : "/images/cat/service-default.png";
}

function CategoriesTileRow({
  title,
  items,
  kind,
}: {
  title: string;
  kind: "product" | "service";
  items: Array<{ label: string; href: string; slug?: string }>;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.h2}>{title}</h2>
      </div>

      <div className={styles.rubricatorGrid}>
        {items.map((it) => {
          const slug = String(it.slug || "").trim();
          const img = pickCategoryImage(kind, slug, it.label);

          return (
            <Link key={it.href} href={it.href} className={styles.rubricatorTile}>
              <div className={styles.rubricatorTitle}>{it.label}</div>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.rubricatorImg} src={img} alt={it.label} loading="lazy" />
            </Link>
          );
        })}
      </div>

      <div className={styles.divider} />
    </section>
  );
}

/* ====== Карточка товара ====== */

function MediaCard(props: {
  href: string;
  title: string;
  meta?: string;
  imageUrl?: string | null;
}) {
  const { href, title, meta, imageUrl } = props;
  const src = absImg(imageUrl) || FALLBACK_IMG;

  return (
    <Link href={href} className={styles.simpleCard}>
      <div className={styles.mediaRow}>
        <div className={styles.cardThumb} aria-hidden={!src}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={title}
              loading="lazy"
              className={`${styles.thumbImage} ${styles.thumbImageCover}`}
            />
          ) : (
            <span className={styles.thumbPlaceholder}>•</span>
          )}
        </div>

        <div className={styles.mediaContent}>
          <div className={styles.simpleCardTitle} title={title}>
            {title}
          </div>
          {meta ? <div className={styles.simpleCardMeta}>{meta}</div> : null}
        </div>
      </div>
    </Link>
  );
}

/**
 * ✅ SEO category+region:
 * тянем из /public/region/:region/product-category/:slug
 * + 404 если slug мусорный или категории нет
 */
export async function generateMetadata({
  params,
}: {
  params: { region: string; category: string };
}): Promise<Metadata> {
  const region = String(params?.region || "").trim() || "moskva";
  const categorySlug = decodeURIComponent(String(params?.category || "").trim());

  if (isInvalidProductCategorySlug(categorySlug)) notFound();

  const [home, catResp] = await Promise.all([
    apiGetSafe(`/home?region_slug=${encodeURIComponent(region)}`),
    apiGetSafe(
      `/public/region/${encodeURIComponent(region)}/product-category/${encodeURIComponent(
        categorySlug
      )}`
    ),
  ]);

  const categorySeo: ProductCategorySeo | null = catResp?.category || null;
  if (!categorySeo) notFound();

  const regionTitle = home?.region?.name || home?.region?.title || home?.region_name || region;
  const regionIn = toPrepositional(regionTitle);

  const categoryName = categorySeo?.name || categorySlug;

  // ✅ ctx для шаблонов ({{region.in}}, {{CITY_IN}} и т.п.)
  const ctx = {
    region: { slug: region, name: regionTitle, in: regionIn },
    category: { slug: categorySlug, name: categoryName },

    // ✅ совместимость со старыми переменными из админки
    CITY: regionTitle,
    CITY_IN: regionIn,
  };

  const titleRaw =
    (categorySeo?.seo_title && String(categorySeo.seo_title).trim()) ||
    `${categoryName} — товары в ${regionIn} | МойДомПро`;

  const descriptionRaw =
    (categorySeo?.seo_description && String(categorySeo.seo_description).trim()) ||
    `Категория "${categoryName}" — предложения товаров в ${regionIn}: цены, компании и варианты.`;

  const title = renderTemplate(titleRaw, ctx);
  const description = renderTemplate(descriptionRaw, ctx);

  const canonicalAbs = absUrl(`/${region}/products/c/${encodeURIComponent(categorySlug)}`);

  return {
    title,
    description,
    alternates: { canonical: canonicalAbs },
    openGraph: { title, description, url: canonicalAbs, type: "website" },
  };
}

export default async function ProductsCategoryPage({
  params,
}: {
  params: { region: string; category: string };
}) {
  const region = String(params?.region || "").trim() || "moskva";
  const categorySlug = decodeURIComponent(String(params?.category || "").trim());

  if (isInvalidProductCategorySlug(categorySlug)) notFound();

  const [home, catSeoResp, catsResp] = await Promise.all([
    apiGetSafe(`/home?region_slug=${encodeURIComponent(region)}`),
    apiGetSafe(
      `/public/region/${encodeURIComponent(region)}/product-category/${encodeURIComponent(
        categorySlug
      )}`
    ),
    apiGetSafe(`/product-categories?flat=1`),
  ]);

  const categorySeo: ProductCategorySeo | null = catSeoResp?.category || null;
  if (!categorySeo) notFound();

  const catsFlat: ProductCategoryFlat[] = Array.isArray(catsResp?.result)
    ? catsResp.result
    : Array.isArray(catsResp?.items)
      ? catsResp.items
      : [];
  const categories = catsFlat
    .map((x) => ({
      id: Number(x?.id ?? 0),
      slug: String(x?.slug || "").trim(),
      name: String(x?.name || "").trim(),
      parent_id: x?.parent_id ?? null,
      sort_order: x?.sort_order ?? null,
    }))
    .filter((x) => x.slug && x.name && x.id > 0);

  const parents = categories
    .filter((c) => c.parent_id == null)
    .sort((a, b) => {
      const ao = Number(a.sort_order ?? 100);
      const bo = Number(b.sort_order ?? 100);
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name, "ru");
    });

  const regionTitle = home?.region?.name || home?.region?.title || home?.region_name || region;
  const regionIn = toPrepositional(regionTitle);

  const categoryName = categorySeo?.name || categorySlug;

  // ✅ ctx для шаблонов ({{region.in}}, {{CITY_IN}} и т.п.)
  const ctx = {
    region: { slug: region, name: regionTitle, in: regionIn },
    category: { slug: categorySlug, name: categoryName },

    // ✅ совместимость со старыми переменными из админки
    CITY: regionTitle,
    CITY_IN: regionIn,
  };

  const h1Raw =
    (categorySeo?.seo_h1 && String(categorySeo.seo_h1).trim()) || `${categoryName} — в ${regionIn}`;
  const h1 = renderTemplate(h1Raw, ctx);

  const categoryId = Number(categorySeo?.id ?? 0);
  const data = await apiGetSafe(
    categoryId > 0
      ? `/public/region/${encodeURIComponent(region)}/products?category_id=${categoryId}`
      : `/public/region/${encodeURIComponent(region)}/products?category_slug=${encodeURIComponent(
          categorySlug
        )}`
  );
  const items: ProductItem[] = Array.isArray(data?.products) ? data.products : [];

  const currentCategory =
    categories.find((c) => c.id === categoryId) ||
    categories.find((c) => c.slug === categorySlug) ||
    null;
  const rawParentId = Number(categorySeo?.parent_id ?? currentCategory?.parent_id ?? 0);
  const tagsParentId = rawParentId > 0 ? rawParentId : categoryId;
  const subcategories = categories
    .filter((c) => Number(c.parent_id ?? 0) === tagsParentId)
    .sort((a, b) => {
      const ao = Number(a.sort_order ?? 100);
      const bo = Number(b.sort_order ?? 100);
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name, "ru");
    });

  /** ✅ Microdata */
  const canonicalAbs = absUrl(`/${region}/products/c/${encodeURIComponent(categorySlug)}`);

  const ldBreadcrumbs = jsonLdBreadcrumb([
    { name: "Главная", item: absUrl(`/${region}`) },
    { name: "Товары", item: absUrl(`/${region}/products`) },
    { name: categoryName, item: canonicalAbs },
  ]);

  const ldPage = jsonLdCollectionPage({ url: canonicalAbs, name: h1 });

  const ldList = jsonLdItemList({
    url: canonicalAbs,
    name: `Товары категории “${categoryName}”`,
    items: items.slice(0, 18).map((p: any) => {
      const nm = String(p?.name || "").trim() || String(p?.slug || p?.id || "").trim();
      const slugOrId = String(p?.slug || p?.id || "").trim();
      return {
        name: nm,
        url: absUrl(`/${region}/products/${encodeURIComponent(slugOrId)}`),
      };
    }),
  });

  const seoTextRendered =
    categorySeo?.seo_text && String(categorySeo.seo_text).trim()
      ? renderTemplate(String(categorySeo.seo_text), ctx)
      : "";

  return (
    <div className={styles.container}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldBreadcrumbs) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldPage) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldList) }} />

      <Breadcrumbs
        items={[
          { label: "Главная", href: `/${region}` },
          { label: "Товары", href: `/${region}/products` },
          { label: categoryName },
        ]}
      />

      <div className={styles.padX}>
        <h1 className={styles.h1}>{h1}</h1>
        {seoTextRendered ? <div className={styles.seoText}>{seoTextRendered}</div> : null}
      </div>

      {parents.length ? (
        <CategoriesTileRow
          title="Категории товаров"
          kind="product"
          items={[
            { label: "Все", href: `/${region}/products`, slug: "" },
            ...parents.map((c) => ({
              label: c.name,
              href: `/${region}/products/c/${encodeURIComponent(c.slug)}`,
              slug: c.slug,
            })),
          ]}
        />
      ) : null}

      {subcategories.length ? (
        <section className={styles.tagsSection}>
          <div className={styles.tagsTitle}>Подкатегории</div>
          <div className={styles.tagList}>
            {subcategories.map((c) => (
              <Link
                key={c.id}
                href={`/${region}/products/c/${encodeURIComponent(c.slug)}`}
                className={styles.tagChip}
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>Товары</h2>

          <Link href={`/${region}/products`} className={styles.viewAll}>
            Посмотреть все
          </Link>
        </div>

        <div className={styles.grid}>
          {items.length === 0 ? (
            <div className={styles.empty}>Нет товаров в категории “{categoryName}”.</div>
          ) : (
            items.slice(0, 18).map((p) => {
              const priceFrom = toNum(p.price_min);
              const companiesCount = Number(p.companies_count ?? 0) || 0;
              const parts: string[] = [];
              if (priceFrom) parts.push(`от ${fmtRub(priceFrom)} ₽`);
              if (companiesCount > 0) {
                parts.push(`Компаний: ${companiesCount}`);
              }

              return (
                <MediaCard
                  key={p.slug || String(p.id)}
                  href={`/${region}/products/${p.slug || p.id}`}
                  title={p.name}
                  meta={parts.length ? parts.join(" · ") : undefined}
                  imageUrl={p.image_url || null}
                />
              );
            })
          )}
        </div>

        <div className={styles.backRow}>
          <Link href={`/${region}`} className={styles.backLink}>
            ← На главную региона
          </Link>
        </div>
      </section>
    </div>
  );
}
