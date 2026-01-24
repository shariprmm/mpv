// apps/web/app/[region]/services/c/[category]/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import styles from "./page.module.css";

export const revalidate = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://moydompro.ru";

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://api.moydompro.ru";

/**
 * ✅ abs URL for canonical / JSON-LD
 */
function absUrl(path: string) {
  const base = String(SITE_URL).replace(/\/+$/, "");
  const p = String(path || "");
  const norm = p.startsWith("/") ? p : `/${p}`;
  return base + norm;
}

/**
 * ✅ JSON-LD helpers
 */
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

/**
 * Safe JSON fetch:
 * - читает text()
 * - пытается JSON.parse
 * - если в начале мусор/HTML/BOM — обрезает до первого { или [
 */
async function apiGetSafe(path: string) {
  try {
    const base = String(API_BASE || "").replace(/\/$/, "");
    const url = base + path;

    const r = await fetch(url, { next: { revalidate } });
    if (!r.ok) return null;

    const txt = await r.text().catch(() => "");
    if (!txt) return null;

    const firstObj = txt.indexOf("{");
    const firstArr = txt.indexOf("[");
    const cutAt =
      firstObj === -1 ? firstArr : firstArr === -1 ? firstObj : Math.min(firstObj, firstArr);

    const clean = (cutAt >= 0 ? txt.slice(cutAt) : txt).trim();
    if (!clean) return null;

    try {
      return JSON.parse(clean);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

type ServiceItem = {
  id: number;
  name: string;
  slug: string;
  category?: string | null;
  companies_count?: number | null;
  price_min?: number | string | null;
  currency?: string | null;

  image_url?: string | null;
  image?: string | null;
  cover_image?: string | null;
  coverImage?: string | null;
  photo?: string | null;
  photo_url?: string | null;
  photos?: string[] | null;
  images?: string[] | null;
};

type ServiceCategoryFlat = {
  id: number;
  slug: string;
  name: string;
  parent_id: number | null;
  sort_order?: number | null;
  path_name?: string;
  is_active?: boolean;

  // ✅ теперь умеем картинки из мастер-админки
  image_url?: string | null;
  image_thumb_url?: string | null;

  seo_h1?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_text?: string | null;
};

function getApiOrigins() {
  const apiBase =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "https://api.moydompro.ru";
  const apiOrigin = String(apiBase).replace(/\/+$/, "");

  const SITE =
    process.env.SITE_ORIGIN ||
    process.env.NEXT_PUBLIC_SITE_ORIGIN ||
    "https://moydompro.ru";
  const siteOrigin = String(SITE).replace(/\/+$/, "");

  return { apiOrigin, siteOrigin };
}

/**
 * URL сборка для публичных ассетов:
 * uploads -> с основного домена сайта
 * остальное относительное -> через API
 */
function makeAbsPublicUrlFactory(siteOrigin: string, apiOrigin: string) {
  return function absPublicUrl(p: any): string | null {
    if (!p) return null;
    const s = String(p).trim();
    if (!s) return null;

    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("//")) return "https:" + s;

    const path = s.startsWith("/") ? s : `/${s}`;
    if (path.startsWith("/uploads/")) return `${siteOrigin}${path}`;
    return `${apiOrigin}${path}`;
  };
}

function pickServiceImageAbs(svc: any, absPublicUrl: (v: any) => string | null): string | null {
  const direct =
    svc?.image_url ??
    svc?.imageUrl ??
    svc?.image ??
    svc?.cover_image ??
    svc?.coverImage ??
    svc?.photo ??
    svc?.photo_url ??
    null;

  const d = absPublicUrl(direct);
  if (d) return d;

  const arr = svc?.photos ?? svc?.images ?? null;
  if (Array.isArray(arr) && arr.length) {
    const first = absPublicUrl(arr[0]);
    if (first) return first;
  }

  return null;
}

function toNum(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function fmtRub(n: number | null | undefined) {
  if (n === null || n === undefined) return null;
  return new Intl.NumberFormat("ru-RU").format(n);
}

function formatPriceFrom(v?: number | string | null) {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `от ${fmtRub(n)} ₽`;
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

function isBadSlug(v: any) {
  const s = String(v ?? "").trim();
  if (!s) return true;
  return /[А-Яа-я\s]/.test(s);
}

/** ✅ жесткая валидация параметра category */
function isInvalidCategorySlug(v: any) {
  const s = String(v ?? "").trim();
  if (!s) return true;
  return !/^[a-z0-9-]+$/i.test(s);
}

/** железный fallback (как в БД) */
const FALLBACK_SERVICE_CATS: Array<{ id: number; name: string; slug: string }> = [
  { id: 1, name: "Септики и канализация", slug: "septic" },
  { id: 2, name: "Водоснабжение: скважины и колодцы", slug: "water" },
  { id: 3, name: "Дренаж и ливневая канализация", slug: "drainage" },
  { id: 4, name: "Земляные работы и спецтехника", slug: "earthworks" },
  { id: 5, name: "ГНБ и проколы", slug: "gnb" },
  { id: 6, name: "Электрика и слаботочка", slug: "electric" },
  { id: 7, name: "Отопление и котельные", slug: "heating" },
  { id: 8, name: "Заборы, ворота, калитки", slug: "fences" },
  { id: 9, name: "Дороги, заезды и покрытия", slug: "roads" },
  { id: 10, name: "Ландшафт и озеленение", slug: "landscape" },
  { id: 11, name: "Уход за участком и деревья", slug: "care" },
  { id: 12, name: "Сезонные услуги", slug: "seasonal" },
  { id: 13, name: "Строительство и хозпостройки", slug: "buildings" },
  { id: 14, name: "Кровля, фасады, отмостка", slug: "envelope" },
  { id: 15, name: "Вывоз, доставка, материалы", slug: "logistics" },
  { id: 16, name: "Безопасность и связь", slug: "security" },
  { id: 17, name: "Газификация и дымоходы", slug: "gas" },
  { id: 18, name: "Сервис и аварийные выезды", slug: "service" },
];

function CategoryIconLink(props: { href: string; label: string; icon: string; active?: boolean }) {
  const { href, label, icon, active } = props;

  return (
    <Link href={href} className={styles.catLink}>
      <div className={styles.catItem}>
        <div className={`${styles.catCircle} ${active ? styles.catCircleActive : ""}`}>
          <div className={styles.catEmoji}>{icon}</div>
        </div>

        <div className={`${styles.catLabel} ${active ? styles.catLabelActive : ""}`}>{label}</div>
      </div>
    </Link>
  );
}

function ServiceCard(props: {
  href: string;
  title: string;
  meta?: string;
  imageUrl?: string | null;
}) {
  const { href, title, meta, imageUrl } = props;

  return (
    <Link href={href} className={styles.simpleCard}>
      <div className={styles.mediaRow}>
        <div className={styles.cardThumb} aria-hidden={!imageUrl}>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={title}
              width={38}
              height={38}
              loading="lazy"
              className={styles.thumbImage}
            />
          ) : (
            <span className={styles.thumbPlaceholder}>•</span>
          )}
        </div>

        <div className={styles.mediaContent}>
          <div className={styles.simpleCardTitle}>{title}</div>
          {meta ? <div className={styles.simpleCardMeta}>{meta}</div> : null}
        </div>
      </div>
    </Link>
  );
}

/**
 * ✅ Подстановка плейсхолдеров из админки/БД
 */
function applyCityPlaceholders(
  input: string | null | undefined,
  ctx: { city: string; cityIn: string; region?: string; regionIn?: string }
) {
  const s = String(input ?? "");
  if (!s.trim()) return "";

  const rep: Record<string, string> = {
    CITY: ctx.city,
    CITY_IN: ctx.cityIn,
    REGION: ctx.region ?? ctx.city,
    REGION_IN: ctx.regionIn ?? ctx.cityIn,
  };

  return s.replace(/{{\s*([A-Z_]+)\s*}}/g, (m, keyRaw) => {
    const key = String(keyRaw || "").trim().toUpperCase();
    return rep[key] ?? m;
  });
}

function SeoTextBlock({ html }: { html?: string | null }) {
  const s = String(html || "").trim();
  if (!s) return null;

  // Если редактором/вручную уже добавили HTML — не трогаем
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(s);

  const out = looksLikeHtml
    ? s
    : s
        // разбиваем на абзацы по пустым строкам
        .split(/\n{2,}/g)
        .map((p) => p.trim())
        .filter(Boolean)
        // внутри абзаца одиночные переносы превращаем в <br>
        .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("");

  return <div className={styles.seoBlock} dangerouslySetInnerHTML={{ __html: out }} />;
}



function pickFirstString(...vals: any[]): string | null {
  for (const v of vals) {
    const s = typeof v === "string" ? v.trim() : "";
    if (s) return s;
  }
  return null;
}

// ✅ PRIORITY: base SEO over regional overrides.
//
// ВАЖНО: /public/region/.../service-category/... отдаёт SEO в поле `seo`
// (уже смерджено на API: override если есть, иначе base).
// Поэтому `catPublic.seo` считаем БАЗОВЫМ источником для фронта.
//
// 🔁 Как вернуть региональные overrides (если начнёшь отдавать их отдельно):
// 1) в API начни возвращать отдельный объект, например `override`
// 2) поставь USE_REGION_OVERRIDES = true и добавь o.* в pickFirstString ниже
const USE_REGION_OVERRIDES = false;

function extractSeo(catPublic: any, activeCat: ServiceCategoryFlat | null) {
  // ✅ БАЗОВОЕ SEO для фронта:
  // - сначала из activeCat (если /public/services/categories начнёт отдавать seo_* поля)
  // - потом из catPublic.seo (это сейчас главный источник: merged seo)
  // - потом из catPublic.category (на случай если когда-то начнёте отдавать seo_* внутри category)
  const baseSeo = catPublic?.seo || null;

  const c =
    catPublic?.category ||
    catPublic?.cat ||
    catPublic?.seo_category ||
    catPublic ||
    null;

  // ✅ реальный override (если API начнёт отдавать отдельно)
  const o =
    catPublic?.override ||
    catPublic?.seo_override ||
    catPublic?.region_override ||
    catPublic?.region_seo ||
    catPublic?.category_override ||
    null;

  const seo_h1 = pickFirstString(
    activeCat?.seo_h1,
    activeCat?.name,

    baseSeo?.seo_h1,
    baseSeo?.h1,

    c?.seo_h1,
    c?.h1,
    c?.seoH1,
    c?.seo?.h1,
    c?.seo?.seo_h1,

    USE_REGION_OVERRIDES ? o?.seo_h1 : null,
    USE_REGION_OVERRIDES ? o?.h1 : null
  );

  const seo_title = pickFirstString(
    activeCat?.seo_title,

    baseSeo?.seo_title,
    baseSeo?.title,

    c?.seo_title,
    c?.title,
    c?.seoTitle,
    c?.seo?.title,
    c?.seo?.seo_title,

    USE_REGION_OVERRIDES ? o?.seo_title : null,
    USE_REGION_OVERRIDES ? o?.title : null
  );

  const seo_description = pickFirstString(
    activeCat?.seo_description,

    baseSeo?.seo_description,
    baseSeo?.description,

    c?.seo_description,
    c?.description,
    c?.seoDescription,
    c?.seo?.description,
    c?.seo?.seo_description,

    USE_REGION_OVERRIDES ? o?.seo_description : null,
    USE_REGION_OVERRIDES ? o?.description : null
  );

  const seo_text = pickFirstString(
    (activeCat as any)?.seo_text,
    (activeCat as any)?.seoText,

    baseSeo?.seo_text,
    baseSeo?.text,
    baseSeo?.html,

    c?.seo_text,
    c?.text,
    c?.seo_text_html,
    c?.seoText,
    c?.seoTextHtml,
    c?.html,
    c?.content,
    c?.content_html,
    c?.seo?.text,
    c?.seo?.seo_text,
    c?.seo?.seoText,

    USE_REGION_OVERRIDES ? o?.seo_text : null,
    USE_REGION_OVERRIDES ? o?.text : null,
    USE_REGION_OVERRIDES ? o?.html : null
  );

  return { seo_h1, seo_title, seo_description, seo_text };
}



// ✅ утилита: абсолютная ссылка на иконку категории (из БД)
function pickCategoryImageAbs(
  cat: ServiceCategoryFlat,
  absPublicUrl: (v: any) => string | null
): string {
  const fromDb = absPublicUrl(cat?.image_thumb_url || cat?.image_url || null);
  return fromDb || "/images/cat/service-default.png";
}

export async function generateMetadata({
  params,
}: {
  params: { region: string; category: string };
}): Promise<Metadata> {
  const region = String(params?.region || "").trim() || "moskva";
  const activeSlug = decodeURIComponent(String(params?.category || "").trim());

  if (isInvalidCategorySlug(activeSlug)) notFound();

  const home = await apiGetSafe(`/home?region_slug=${encodeURIComponent(region)}`);
  const regionTitle = home?.region?.name || home?.region?.title || home?.region_name || region;
  const regionIn = toPrepositional(regionTitle);

  // ✅ категории услуг берём из публичного эндпоинта (там уже есть image_thumb_url)
  const catsPublic = await apiGetSafe(`/public/services/categories`);
  let allCats: ServiceCategoryFlat[] = Array.isArray(catsPublic?.categories) ? catsPublic.categories : [];

  allCats = allCats.filter((c) => c && c.name && c.slug && !isBadSlug(c.slug) && c.is_active !== false);
  if (!allCats.length) {
    allCats = FALLBACK_SERVICE_CATS.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      parent_id: null,
      sort_order: c.id,
      is_active: true,
      image_url: null,
      image_thumb_url: null,
    }));
  }

  const activeCat = allCats.find((c) => String(c.slug) === activeSlug) || null;
  if (!activeCat) notFound();

  const catPublic =
    (await apiGetSafe(
      `/public/region/${encodeURIComponent(region)}/service-category/${encodeURIComponent(activeSlug)}`
    )) || null;

  const seoRaw = extractSeo(catPublic, activeCat);

  const ctx = { city: regionTitle, cityIn: regionIn, region: regionTitle, regionIn };
  const fallbackTitleBase = activeCat?.name || activeSlug;

  const title = applyCityPlaceholders(
    seoRaw.seo_title || `${fallbackTitleBase} — в {{CITY_IN}} | МойДомПро`,
    ctx
  );

  const description = applyCityPlaceholders(
    seoRaw.seo_description ||
      `Закажите услугу “${fallbackTitleBase}” в {{CITY_IN}}. Сравните предложения компаний.`,
    ctx
  );

  const canonicalAbs = absUrl(`/${region}/services/c/${encodeURIComponent(activeSlug)}`);

  return {
    title,
    description,
    alternates: { canonical: canonicalAbs },
    openGraph: {
      title,
      description,
      url: canonicalAbs,
      type: "website",
    },
  };
}

export default async function ServiceCategoryPage({
  params,
}: {
  params: { region: string; category: string };
}) {
  const region = String(params?.region || "").trim() || "moskva";
  const activeSlug = decodeURIComponent(String(params?.category || "").trim());

  if (isInvalidCategorySlug(activeSlug)) notFound();

  const home = await apiGetSafe(`/home?region_slug=${encodeURIComponent(region)}`);
  const regionTitle = home?.region?.name || home?.region?.title || home?.region_name || region;
  const regionIn = toPrepositional(regionTitle);

  const ctx = { city: regionTitle, cityIn: regionIn, region: regionTitle, regionIn };

  // ✅ категории услуг берём из /public/services/categories (там есть image_thumb_url)
  const catsPublic = await apiGetSafe(`/public/services/categories`);
  let allCats: ServiceCategoryFlat[] = Array.isArray(catsPublic?.categories) ? catsPublic.categories : [];

  allCats = allCats.filter((c) => c && c.name && c.slug && !isBadSlug(c.slug) && c.is_active !== false);

  if (!allCats.length) {
    allCats = FALLBACK_SERVICE_CATS.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      parent_id: null,
      sort_order: c.id,
      is_active: true,
      image_url: null,
      image_thumb_url: null,
    }));
  }

  allCats.sort((a, b) => {
    const ao = Number(a.sort_order ?? 100);
    const bo = Number(b.sort_order ?? 100);
    if (ao !== bo) return ao - bo;
    return String(a.path_name || a.name).localeCompare(String(b.path_name || b.name), "ru");
  });

  const activeCat = allCats.find((c) => String(c.slug) === activeSlug) || null;
  if (!activeCat) notFound();

  const catPublic =
    (await apiGetSafe(
      `/public/region/${encodeURIComponent(region)}/service-category/${encodeURIComponent(activeSlug)}`
    )) || null;

  const seoRaw = extractSeo(catPublic, activeCat);

  const rawH1 = (seoRaw.seo_h1 || activeCat.name || activeSlug).trim();
  const h1 = applyCityPlaceholders(rawH1, ctx);

  const seoText = applyCityPlaceholders(seoRaw.seo_text || "", ctx);

  const data =
    (catPublic && (Array.isArray(catPublic?.services) || Array.isArray(catPublic?.items)) ? catPublic : null) ||
    (await apiGetSafe(
      `/public/region/${encodeURIComponent(region)}/services?category=${encodeURIComponent(activeSlug)}`
    ));

  const items: ServiceItem[] = Array.isArray(data?.services)
    ? data.services
    : Array.isArray(data?.items)
      ? data.items
      : [];

  const { apiOrigin, siteOrigin } = getApiOrigins();
  const absPublicUrl = makeAbsPublicUrlFactory(siteOrigin, apiOrigin);

  // ✅ Microdata
  const canonicalAbs = absUrl(`/${region}/services/c/${encodeURIComponent(activeSlug)}`);

  const ldBreadcrumbs = jsonLdBreadcrumb([
    { name: "Главная", item: absUrl(`/${region}`) },
    { name: "Услуги", item: absUrl(`/${region}/services`) },
    { name: activeCat.name, item: canonicalAbs },
  ]);

  const ldPage = jsonLdCollectionPage({ url: canonicalAbs, name: h1 });

  const ldList = jsonLdItemList({
    url: canonicalAbs,
    name: `Услуги категории “${activeCat.name}”`,
    items: items.slice(0, 18).map((s: any) => {
      const nm = String(s?.name || "").trim() || String(s?.slug || s?.id || "").trim();
      const slugOrId = String(s?.slug || s?.id || "").trim();
      return {
        name: nm,
        url: absUrl(`/${region}/services/${encodeURIComponent(slugOrId)}`),
      };
    }),
  });

  return (
    <div className={styles.pageWrap}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldBreadcrumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldPage) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldList) }} />

      <Breadcrumbs
        items={[
          { label: "Главная", href: `/${region}` },
          { label: "Услуги", href: `/${region}/services` },
          { label: activeCat.name },
        ]}
      />

      <div className={styles.padX}>
        <h1 className={styles.h1}>{h1}</h1>
        <SeoTextBlock html={seoText} />
      </div>

      <section className={styles.section}>
        <h2 className={styles.h2}>Категории</h2>

        <div className={styles.rubricatorGrid}>
          <Link href={`/${region}/services`} className={styles.rubricatorTile}>
            <div className={styles.rubricatorTitle}>Все услуги</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.rubricatorImg}
              src={"/images/cat/service-default.png"}
              alt="Все услуги"
              loading="lazy"
            />
          </Link>

          {allCats.map((c) => {
            const slug = String(c.slug || "").trim();
            const isActive = slug === activeSlug;

            // ✅ приоритет: thumb -> big -> fallback
            const img = pickCategoryImageAbs(c, absPublicUrl);

            return (
              <Link
                key={c.id}
                href={`/${region}/services/c/${encodeURIComponent(slug)}`}
                className={`${styles.rubricatorTile} ${isActive ? styles.rubricatorTileActive : ""}`}
              >
                <div className={styles.rubricatorTitle}>{c.name}</div>

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.rubricatorImg} src={img} alt={c.name} loading="lazy" />
              </Link>
            );
          })}
        </div>

        <div className={styles.divider} />
      </section>

      <section className={styles.section}>
        <div className={styles.servicesHead}>
          <h2 className={styles.h2}>Услуги</h2>

          <Link href={`/${region}/services`} className={styles.viewAllLink}>
            Посмотреть все
          </Link>
        </div>

        <div className={styles.grid}>
          {items.length === 0 ? (
            <div className={styles.emptyText}>Нет услуг в категории "{activeCat.name}".</div>
          ) : (
            items.slice(0, 18).map((s: any) => {
              const parts: string[] = [];
              const price = formatPriceFrom(toNum(s.price_min));
              if (price) parts.push(price);
              if ((Number(s.companies_count) || 0) > 0) {
                parts.push(`Компаний: ${s.companies_count}`);
              }

              const imageUrl = pickServiceImageAbs(s, absPublicUrl);

              return (
                <ServiceCard
                  key={s.slug || s.id}
                  href={`/${region}/services/${s.slug || s.id}`}
                  title={s.name}
                  meta={parts.length ? parts.join(" • ") : undefined}
                  imageUrl={imageUrl}
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
