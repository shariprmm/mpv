// /opt/moydompro-repo/apps/web/app/[region]/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import SeoJsonLd from "@/components/SeoJsonLd";
import { buildRegionSeo, jsonLdBreadcrumb, toNextMetadata, absUrl } from "@/lib/seo";
import styles from "./page.module.css";

export const revalidate = 60;

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://api.moydompro.ru";

async function apiGet(path: string) {
  const base = String(API_BASE || "").replace(/\/$/, "");
  const url = base + path;

  const r = await fetch(url, { next: { revalidate } });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`API ${r.status}: ${txt}`);
  }
  return r.json();
}

/**
 * ✅ Safe JSON fetch:
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

/** ✅ safe helper: гарантируем, что вернулся объект (или null) */
async function apiGetSafeObj(path: string) {
  const j = await apiGetSafe(path);
  return j && typeof j === "object" ? j : null;
}

export async function generateMetadata({
  params,
}: {
  params: { region: string };
}): Promise<Metadata> {
  const region = String(params?.region || "").trim() || "moskva";

  try {
    const data = await apiGet(`/home?region_slug=${encodeURIComponent(region)}`);
    const regionName = data?.region?.name || data?.region_name || region;

    const seo = buildRegionSeo({
      regionSlug: region,
      regionName,
    });

    return toNextMetadata(seo);
  } catch {
    return {
      title: `Услуги и товары для дома — ${region} | МойДомПро`,
      description: `Каталог услуг и товаров для дома в регионе ${region}.`,
      alternates: { canonical: absUrl(`/${region}`) },
    };
  }
}

type CatalogItem = {
  id: number;
  name: string;
  slug: string;
  category?: string | null; // legacy
};

type CategoryFlat = {
  id: number;
  slug: string;
  name: string;
  parent_id: number | null;
  is_active?: boolean;
  sort_order?: number;

  // ✅ картинки категорий (из master-админки)
  image_url?: string | null;
  image_thumb_url?: string | null;
};

type ServiceCategoryFlat = {
  id: number;
  slug: string;
  name: string;
  parent_id: number | null;
  sort_order?: number | null;
  is_active?: boolean;

  // ✅ картинки категорий услуг (из master-админки)
  image_url?: string | null;
  image_thumb_url?: string | null;
};

type BlogItem = {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image: string | null;
  published_at: string | null;
  category_slug: string | null;
  category_name: string | null;
};

function uniqSorted(arr: string[]) {
  return Array.from(new Set(arr))
    .map((x) => x.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ru"));
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

/**
 * ✅ fallback name->slug (как в БД)
 */
const FALLBACK_SERVICE_CAT_MAP: Record<string, string> = {
  "Септики и канализация": "septic",
  "Водоснабжение: скважины и колодцы": "water",
  "Дренаж и ливневая канализация": "drainage",
  "Земляные работы и спецтехника": "earthworks",
  "ГНБ и проколы": "gnb",
  "Электрика и слаботочка": "electric",
  "Отопление и котельные": "heating",
  "Заборы, ворота, калитки": "fences",
  "Дороги, заезды и покрытия": "roads",
  "Ландшафт и озеленение": "landscape",
  "Уход за участком и деревья": "care",
  "Сезонные услуги": "seasonal",
  "Строительство и хозпостройки": "buildings",
  "Кровля, фасады, отмостка": "envelope",
  "Вывоз, доставка, материалы": "logistics",
  "Безопасность и связь": "security",
  "Газификация и дымоходы": "gas",
  "Сервис и аварийные выезды": "service",
};

function pickCategoryIcon(label: string, kind: "service" | "product") {
  const s = (label || "").toLowerCase();

  const mapService: Array<[RegExp, string]> = [
    [/безопасн|сигнал|видеонабл/i, "🛡️"],
    [/водоснаб|скваж|колод/i, "💧"],
    [/канализ|септик|станц/i, "🛢️"],
    [/газиф|дымоход/i, "🔥"],
    [/гнб|прокол/i, "🕳️"],
    [/дорог|заезд|покрыт/i, "🛣️"],
    [/дренаж|ливнев/i, "🌧️"],
    [/забор|ворот|калит/i, "🚪"],
    [/землян|спецтех/i, "🚜"],
    [/электр|щит|кабел/i, "⚡"],
    [/отоплен|котел|радиат/i, "♨️"],
    [/ремонт|отделк/i, "🧱"],
    [/вентил|кондиц/i, "🌬️"],
  ];

  const mapProduct: Array<[RegExp, string]> = [
    [/канализ/i, "🚰"],
    [/водоснаб|вода/i, "💧"],
    [/отоплен/i, "🔥"],
    [/электр/i, "⚡"],
    [/дренаж/i, "🌧️"],
    [/септик|станц|биоочист/i, "🛢️"],
    [/насос/i, "🌀"],
    [/забор|ворот/i, "🚪"],
    [/материал|достав/i, "🚚"],
  ];

  const map = kind === "service" ? mapService : mapProduct;
  for (const [re, icon] of map) if (re.test(s)) return icon;

  return kind === "service" ? "🧰" : "🏠";
}

function absMedia(u?: string | null) {
  const s = String(u || "").trim();
  if (!s) return null;

  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) return s.replace(/^\/+/, "/");
  if (s.startsWith("/uploads/")) return s;
  if (s.startsWith("/")) return s;

  return s;
}

function absBlogImage(u?: string | null) {
  const s = String(u || "").trim();
  if (!s) return "";

  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) return s.replace(/^\/+/, "/");
  if (s.startsWith("/")) return s;
  if (s.startsWith("uploads/")) return `/${s}`;

  return s;
}

function formatRuDate(d?: string | null) {
  const s = String(d || "").trim();
  if (!s) return "";
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return "";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = String(dt.getFullYear());
  return `${dd}.${mm}.${yyyy}`;
}

async function getLatestBlog(limit = 6): Promise<BlogItem[]> {
  try {
    const r = await fetch(
      `${String(API_BASE || "").replace(/\/$/, "")}/public/blog?limit=${limit}&page=1`,
      { next: { revalidate: 300 } }
    );
    if (!r.ok) return [];
    const j = await r.json().catch(() => null);

    const items = (j?.items || j?.posts || j || []) as any[];
    if (!Array.isArray(items)) return [];

    return items
      .map((x) => ({
        id: Number(x?.id || 0),
        slug: String(x?.slug || ""),
        title: String(x?.title || ""),
        excerpt: x?.excerpt ?? null,
        cover_image: x?.cover_image ?? null,
        published_at: x?.published_at ?? null,
        category_slug: x?.category_slug ?? null,
        category_name: x?.category_name ?? null,
      }))
      .filter((x) => x.slug && x.title);
  } catch {
    return [];
  }
}

function formatPriceFrom(v?: number | string | null, currency?: string | null) {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "";
  const num = new Intl.NumberFormat("ru-RU").format(n);
  const cur = String(currency || "RUB").toUpperCase();
  return cur === "RUB" ? `от ${num} ₽` : `от ${num} ${cur}`;
}

function pickCategoryImage(kind: "service" | "product", slug: string, label: string) {
  const s = `${slug} ${label}`.toLowerCase();

  const service: Array<[RegExp, string]> = [
    [/septic|септик|канализ/i, "/images/cat/service-septic.webp"],
    [/water|водоснаб|скваж|колод/i, "/images/cat/service-voda.webp"],
    [/drain|дренаж|ливнев/i, "/images/cat/service-drenaj.webp"],
    [/electric|электр|кабел|щит/i, "/images/cat/service-electric.webp"],
    [/heating|отопл|котел|радиат/i, "/images/cat/service-otoplenie.webp"],
    [/fence|забор|ворот|калит/i, "/images/cat/service-fence.png"],
    [/road|дорог|заезд|покрыт/i, "/images/cat/service-road.png"],
    [/landscape|ландшафт|озелен/i, "/images/cat/service-landscape.webp"],
    [/logistics/, "/images/cat/service-logistic.png"],
    [/gnb/, "/images/cat/service-gnb.webp"],
    [/earthworks/, "/images/cat/service-land.webp"],
    [/seasonal/, "/images/cat/service-season.webp"],
    [/service/, "/images/cat/service-sos.webp"],
    [/care/, "/images/cat/service-gnb.webp"],
    [/gas/, "/images/cat/service-gas.webp"],
    [/zaezd/, "/images/cat/service-zaezd.webp"],
    [/fences/, "/images/cat/service-zabor.webp"],
    [/envelope/, "/images/cat/service-fasad.webp"],
    [/buildings/, "/images/cat/service-hoz.webp"],
  ];

  const product: Array<[RegExp, string]> = [
    [/septic|септик|станц/i, "/images/cat/product-septic.png"],
    [/water|вода|насос/i, "/images/cat/product-water.png"],
    [/heating|отопл|котел|радиат/i, "/images/cat/product-heating.png"],
    [/electric|электр|кабел|щит/i, "/images/cat/product-electric.png"],
    [/drain|дренаж/i, "/images/cat/product-drainage.png"],
    [/fence|забор|ворот/i, "/images/cat/product-fence.png"],
    [/material|материал|достав/i, "/images/cat/product-materials.png"],
  ];

  const list = kind === "service" ? service : product;
  for (const [re, img] of list) if (re.test(s)) return img;

  return kind === "service" ? "/images/cat/service-default.png" : "/images/cat/product-default.png";
}

/**
 * ✅ Fixed tiles:
 * - 140x70
 * - 2 rows
 * - horizontal scroll
 *
 * ✅ ВАЖНО: теперь берём изображение из master-админки (image_thumb_url/image_url), если оно есть.
 */
function CategoriesTileRow({
  title,
  items,
  kind,
}: {
  title: string;
  kind: "service" | "product";
  items: Array<{
    label: string;
    href: string;
    slug?: string;

    // ✅ опционально, из API/БД
    image_thumb_url?: string | null;
    image_url?: string | null;
  }>;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.h2}>{title}</h2>
      </div>

      <div className={styles.rubricatorGrid}>
        {items.map((it) => {
          const slug = String(it.slug || "").trim();

          // ✅ приоритет: thumb -> big -> fallback static map
          const fromDb = absMedia(it.image_thumb_url || it.image_url || "");
          const fallback = pickCategoryImage(kind, slug, it.label);
          const img = fromDb || fallback;

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

function MediaCard({
  title,
  href,
  meta,
  imgSrc,
  imgAlt,
  fit = "cover",
}: {
  title: string;
  href: string;
  meta?: string;
  imgSrc?: string | null;
  imgAlt?: string;
  fit?: "cover" | "contain";
}) {
  const src = absMedia(imgSrc || "");

  return (
    <Link href={href} className={styles.simpleCard}>
      <div className={styles.mediaRow}>
        <div className={styles.cardThumb} aria-hidden={!src}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={imgAlt || ""}
              width={38}
              height={38}
              loading="lazy"
              className={`${styles.thumbImage} ${
                fit === "contain" ? styles.thumbImageContain : styles.thumbImageCover
              }`}
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

export default async function RegionPage({
  params,
}: {
  params: { region: string };
}) {
  const region = String(params?.region || "").trim();

  if (!region) {
    return (
      <div className={styles.badRegion}>
        <h1 className={styles.badRegionTitle}>Некорректный регион</h1>
      </div>
    );
  }

  // ✅ ВАЖНО: сервисные категории берём ТОЛЬКО из /public/services/categories
  // Там уже есть image_url и image_thumb_url (как на скрине).
  const [
    data,
    servicesCatalog,
    productCats,
    blogItems,
    serviceCatsPublic,
    regionServicesPublic,
    regionProductsPublic,
  ] = await Promise.all([
    apiGetSafeObj(`/home?region_slug=${encodeURIComponent(region)}`),
    apiGetSafeObj("/services").then((x) => x || { items: [] }),
    apiGetSafeObj("/product-categories?flat=1").then((x) => x || { items: [], result: [] }),
    getLatestBlog(6).catch(() => []),
    apiGetSafeObj("/public/services/categories").then((x) => x || { categories: [] }),

    // ✅ услуги региона (учитывает show_on_site)
    apiGetSafeObj(`/public/region/${encodeURIComponent(region)}/services`).then((x) => x || { services: [] }),

    // ✅ товары региона (учитывает show_on_site)
    apiGetSafeObj(`/public/region/${encodeURIComponent(region)}/products`).then((x) => x || { products: [] }),
  ]);

  if (!data) {
    return (
      <div className={styles.pageWrap}>
        <h1 className={styles.h1}>Каталог услуг и товаров</h1>
        <p className={styles.emptyText}>
          Сейчас страница региона временно недоступна (ошибка загрузки данных). Попробуйте обновить
          страницу позже.
        </p>

        {Array.isArray(blogItems) && blogItems.length > 0 ? (
          <section className={styles.blogSection}>
            <div className={styles.blogHead}>
              <h2 className={styles.blogTitle}>Статьи</h2>
              <Link href="/journal" className={styles.btnAction}>
                Все статьи
              </Link>
            </div>

            <div className={styles.blogRowScroll}>
              {blogItems.slice(0, 6).map((p) => {
                const img = absBlogImage(p.cover_image);
                const date = formatRuDate(p.published_at);

                return (
                  <article key={p.id || p.slug} className={styles.blogCard}>
                    <Link href={`/journal/${p.slug}`} className={styles.blogMedia}>
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={p.title} className={styles.blogImg} loading="lazy" />
                      ) : (
                        <div className={styles.blogImgPh} />
                      )}

                      {(p.category_name || p.category_slug) && (
                        <div className={styles.blogBadge}>{p.category_name || "Статья"}</div>
                      )}
                    </Link>

                    <div className={styles.blogBody}>
                      <h3 className={styles.blogCardTitle}>
                        <Link href={`/journal/${p.slug}`} className={styles.blogCardLink}>
                          {p.title}
                        </Link>
                      </h3>

                      {p.excerpt ? <p className={styles.blogExcerpt}>{p.excerpt}</p> : null}

                      <div className={styles.blogBottom}>
                        {date ? <div className={styles.blogDate}>{date}</div> : <div />}
                        <Link href={`/journal/${p.slug}`} className={styles.blogMore}>
                          Подробнее →
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  const regionTitle =
    (data as any)?.region?.name ||
    (data as any)?.region?.title ||
    (data as any)?.region_name ||
    region;

  const servicesItems: CatalogItem[] = Array.isArray((servicesCatalog as any)?.items)
    ? (servicesCatalog as any).items
    : [];

  const catsFlat: CategoryFlat[] = Array.isArray((productCats as any)?.result)
    ? (productCats as any).result
    : Array.isArray((productCats as any)?.items)
      ? (productCats as any).items
      : [];

  // ✅ распарсили /public/services/categories
  const serviceCatsFlat: ServiceCategoryFlat[] = Array.isArray((serviceCatsPublic as any)?.categories)
    ? ((serviceCatsPublic as any).categories as any[])
        .map((c) => ({
          id: Number(c?.id || 0),
          slug: String(c?.slug || ""),
          name: String(c?.name || ""),
          parent_id: c?.parent_id == null ? null : Number(c.parent_id),
          sort_order: c?.sort_order == null ? null : Number(c.sort_order),
          is_active: c?.is_active ?? true,
          image_url: c?.image_url ?? null,
          image_thumb_url: c?.image_thumb_url ?? null,
        }))
        .filter((c) => c.id && c.slug && c.name)
    : [];

  const companies =
    (Array.isArray((data as any)?.featured_companies) && (data as any).featured_companies) ||
    (Array.isArray((data as any)?.companies) && (data as any).companies) ||
    [];

  // ✅ Берём услуги из публичного регионального роута (там show_on_site уже учтён)
  // ВЫВОДИМ ВСЕ, НЕ СКРЫВАЕМ
  const services =
    (Array.isArray((regionServicesPublic as any)?.services) && (regionServicesPublic as any).services) ||
    (Array.isArray((data as any)?.top_services) && (data as any).top_services) ||
    (Array.isArray((data as any)?.services) && (data as any).services) ||
    [];

  // ✅ товары для блока "Товары" на главной региона
  // ВЫВОДИМ ВСЕ, НЕ СКРЫВАЕМ
  const products =
    (Array.isArray((regionProductsPublic as any)?.products) && (regionProductsPublic as any).products) ||
    (Array.isArray((data as any)?.top_products) && (data as any).top_products) ||
    (Array.isArray((data as any)?.products) && (data as any).products) ||
    [];

  const nameToSlug = new Map<string, string>();
  for (const c of serviceCatsFlat) {
    const n = String((c as any)?.name || "").trim();
    const s = String((c as any)?.slug || "").trim();
    if (n && s && !isBadSlug(s)) nameToSlug.set(n, s);
  }

  const topServiceCats: Array<{
    label: string;
    href: string;
    slug: string;
    image_thumb_url?: string | null;
    image_url?: string | null;
  }> = (() => {
    const fromDb = serviceCatsFlat
      .filter(
        (c) =>
          c &&
          c.name &&
          c.is_active !== false &&
          c.parent_id == null &&
          !isBadSlug(c.slug)
      )
      .sort((a, b) => {
        const ao = Number(a.sort_order ?? 100);
        const bo = Number(b.sort_order ?? 100);
        if (ao !== bo) return ao - bo;
        return String(a.name).localeCompare(String(b.name), "ru");
      })
      .slice(0, 30)
      .map((c) => {
        const slug = String(c.slug).trim();
        return {
          label: c.name,
          slug,
          href: `/${region}/services/c/${encodeURIComponent(slug)}`,
          image_thumb_url: c.image_thumb_url ?? null,
          image_url: c.image_url ?? null,
        };
      });

    if (fromDb.length) return fromDb;

    // fallback legacy (на случай если /public/services/categories пуст)
    const legacyNames = uniqSorted(
      servicesItems.map((x) => String((x as any).category || "").trim()).filter(Boolean)
    ).slice(0, 30);

    return legacyNames.map((name) => {
      const slug =
        String(nameToSlug.get(name) || "").trim() ||
        String(FALLBACK_SERVICE_CAT_MAP[name] || "").trim();

      return {
        label: name,
        slug,
        href: slug
          ? `/${region}/services/c/${encodeURIComponent(slug)}`
          : `/${region}/services?category=${encodeURIComponent(name)}`,
        image_thumb_url: null,
        image_url: null,
      };
    });
  })();

  const topProductCats = catsFlat
    .filter((c) => c && (c as any).parent_id == null)
    .sort((a, b) => {
      const ao = (a as any).sort_order ?? 100;
      const bo = (b as any).sort_order ?? 100;
      if (ao !== bo) return ao - bo;
      return String((a as any).name).localeCompare(String((b as any).name), "ru");
    })
    .slice(0, 30);

  const regionIn = toPrepositional(regionTitle);
  const h1 = `Услуги для загородного дома в ${regionIn}`;

  return (
    <div className={styles.pageWrap}>
      {(() => {
        const canonical = absUrl(`/${region}`);
        const site = absUrl(`/`);
        const regionName = String(regionTitle || region).trim();
        const regionInLd = toPrepositional(regionName);
        const pageName = `Услуги и товары для дома в ${regionInLd} — МойДомПро`;
        const pageDesc = `Каталог услуг, товаров и компаний для дома в ${regionInLd}: сравнение предложений, цены и отзывы.`;

        const itemList = (id: string, name: string, items: Array<{ name: string; url: string }>) => ({
          "@type": "ItemList",
          "@id": absUrl(`/${region}#${id}`),
          name,
          itemListOrder: "http://schema.org/ItemListOrderAscending",
          numberOfItems: items.length,
          itemListElement: items.map((it, idx) => ({
            "@type": "ListItem",
            position: idx + 1,
            name: it.name,
            url: it.url,
          })),
        });

        const serviceCatItems = (topServiceCats || []).map((c) => ({
          name: String(c.label),
          url: absUrl(c.href),
        }));

        const productCatItems = (topProductCats || []).map((c: any) => ({
          name: String(c?.name || ""),
          url: absUrl(`/${region}/products/c/${encodeURIComponent(String(c?.slug || ""))}`),
        }));

        const companyItems = (companies || []).slice(0, 12).map((c: any) => ({
          name: String(c?.name || `Компания #${c?.id}`),
          url: absUrl(`/${region}/c/${c?.id}`),
        }));

        const serviceItems = (services || []).slice(0, 12).map((s: any) => ({
          name: String(s?.name || s?.title || s?.slug || `Услуга #${s?.id}`),
          url: absUrl(`/${region}/services/${encodeURIComponent(String(s?.slug || s?.code || s?.id))}`),
        }));

        const productItems = (products || []).slice(0, 12).map((p: any) => ({
          name: String(p?.name || p?.title || p?.slug || `Товар #${p?.id}`),
          url: absUrl(`/${region}/products/${encodeURIComponent(String(p?.slug || p?.code || p?.id))}`),
        }));

        const searchTarget = absUrl(`/${region}/search?q={search_term_string}`);

        return (
          <SeoJsonLd
            data={{
              "@context": "https://schema.org",
              "@graph": [
                jsonLdBreadcrumb([
                  { name: "Главная", item: canonical },
                  { name: regionName, item: canonical },
                ]),
                {
                  "@type": "WebSite",
                  "@id": site + "#website",
                  url: site,
                  name: "МойДомПро",
                  potentialAction: {
                    "@type": "SearchAction",
                    target: searchTarget,
                    "query-input": "required name=search_term_string",
                  },
                },
                {
                  "@type": ["WebPage", "CollectionPage"],
                  "@id": canonical + "#webpage",
                  url: canonical,
                  name: pageName,
                  description: pageDesc,
                  isPartOf: { "@id": site + "#website" },
                  inLanguage: "ru-RU",
                  breadcrumb: { "@id": canonical + "#breadcrumb" },
                  primaryImageOfPage: {
                    "@type": "ImageObject",
                    url: absUrl("/images/og-default.png"),
                  },
                },
                ...(serviceCatItems.length
                  ? [itemList("serviceCategories", `Категории услуг в ${regionInLd}`, serviceCatItems)]
                  : []),
                ...(productCatItems.length
                  ? [itemList("productCategories", `Категории товаров в ${regionInLd}`, productCatItems)]
                  : []),
                ...(companyItems.length ? [itemList("companies", `Компании в ${regionInLd}`, companyItems)] : []),
                ...(serviceItems.length ? [itemList("topServices", `Популярные услуги в ${regionInLd}`, serviceItems)] : []),
                ...(productItems.length ? [itemList("topProducts", `Популярные товары в ${regionInLd}`, productItems)] : []),
              ],
            }}
          />
        );
      })()}

      <h1 className={styles.h1}>{h1}</h1>

      {topServiceCats.length ? (
        <CategoriesTileRow
          title="Категории услуг"
          kind="service"
          items={topServiceCats.map((c) => ({
            label: c.label,
            href: c.href,
            slug: c.slug,
            image_thumb_url: c.image_thumb_url ?? null,
            image_url: c.image_url ?? null,
          }))}
        />
      ) : null}

      {topProductCats.length ? (
        <CategoriesTileRow
          title="Категории товаров"
          kind="product"
          items={topProductCats.map((c) => ({
            label: (c as any).name,
            href: `/${region}/products/c/${encodeURIComponent((c as any).slug)}`,
            slug: (c as any).slug,
            image_thumb_url: (c as any).image_thumb_url ?? null,
            image_url: (c as any).image_url ?? null,
          }))}
        />
      ) : null}

      {/* Компании */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>Компании</h2>
          <Link href={`/${region}/c`} className={styles.btnAction}>
            Все компании
          </Link>
        </div>

        {companies.length === 0 ? (
          <p className={styles.emptyText}>Пока нет компаний.</p>
        ) : (
          <div className={styles.grid}>
            {companies.slice(0, 12).map((c: any) => {
              const parts: string[] = [];
              if (c.is_verified) parts.push("Проверенная");
              const p = formatPriceFrom(c.price_min ?? null, c.currency ?? "RUB");
              if (p) parts.push(p);
              return (
                <MediaCard
                  key={c.id}
                  title={c.name || `Компания #${c.id}`}
                  href={`/${region}/c/${c.id}`}
                  imgSrc={c.logo_url}
                  imgAlt={c.name || ""}
                  fit="contain"
                  meta={parts.length ? parts.join(" • ") : undefined}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Услуги */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>Услуги</h2>
          <Link href={`/${region}/services`} className={styles.btnAction}>
            Все услуги
          </Link>
        </div>

        {services.length === 0 ? (
          <p className={styles.emptyText}>Пока нет услуг в прайсах компаний этого региона.</p>
        ) : (
          <div className={styles.grid}>
            {services.slice(0, 12).map((s: any) => {
              const parts: string[] = [];
              const p = formatPriceFrom(s.price_min ?? null, s.currency ?? "RUB");
              if (p) parts.push(p);
              
              // ✅ СКРЫВАЕМ НАДПИСЬ, ЕСЛИ 0 КОМПАНИЙ
              if ((Number(s.companies_count) || 0) > 0) {
                parts.push(`Компаний: ${s.companies_count}`);
              }

              return (
                <MediaCard
                  key={s.slug || s.id}
                  title={s.name || s.title || s.slug}
                  href={`/${region}/services/${s.slug || s.code || s.id}`}
                  imgSrc={s.image_url}
                  imgAlt={s.name || ""}
                  meta={parts.length ? parts.join(" • ") : undefined}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Товары */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>Товары</h2>
          <Link href={`/${region}/products`} className={styles.btnAction}>
            Все товары
          </Link>
        </div>

        {products.length === 0 ? (
          <p className={styles.emptyText}>Пока нет товаров в прайсах компаний этого региона.</p>
        ) : (
          <div className={styles.grid}>
            {products.slice(0, 12).map((p: any) => {
              const parts: string[] = [];
              const pr = formatPriceFrom(p.price_min ?? null, p.currency ?? "RUB");
              if (pr) parts.push(pr);

              // ✅ СКРЫВАЕМ НАДПИСЬ, ЕСЛИ 0 КОМПАНИЙ
              if ((Number(p.companies_count) || 0) > 0) {
                parts.push(`Компаний: ${p.companies_count}`);
              }

              return (
                <MediaCard
                  key={p.slug || p.id}
                  title={p.name || p.title || p.slug}
                  href={`/${region}/products/${p.slug || p.code || p.id}`}
                  imgSrc={p.image_url}
                  imgAlt={p.name || ""}
                  meta={parts.length ? parts.join(" • ") : undefined}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Статьи */}
      {Array.isArray(blogItems) && blogItems.length > 0 ? (
        <section className={styles.blogSection}>
          <div className={styles.blogHead}>
            <h2 className={styles.blogTitle}>Статьи</h2>
            <Link href="/journal" className={styles.btnAction}>
              Все статьи
            </Link>
          </div>

          {/* ✅ Горизонтальная прокрутка вместо grid */}
          <div className={styles.blogRowScroll}>
            {blogItems.slice(0, 6).map((p) => {
              const img = absBlogImage(p.cover_image);
              const date = formatRuDate(p.published_at);

              return (
                <article key={p.id || p.slug} className={styles.blogCard}>
                  <Link href={`/journal/${p.slug}`} className={styles.blogMedia}>
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={p.title} className={styles.blogImg} loading="lazy" />
                    ) : (
                      <div className={styles.blogImgPh} />
                    )}

                    {(p.category_name || p.category_slug) && (
                      <div className={styles.blogBadge}>{p.category_name || "Статья"}</div>
                    )}
                  </Link>

                  <div className={styles.blogBody}>
                    <h3 className={styles.blogCardTitle}>
                      <Link href={`/journal/${p.slug}`} className={styles.blogCardLink}>
                        {p.title}
                      </Link>
                    </h3>

                    {p.excerpt ? <p className={styles.blogExcerpt}>{p.excerpt}</p> : null}

                    <div className={styles.blogBottom}>
                      {date ? <div className={styles.blogDate}>{date}</div> : <div />}
                      <Link href={`/journal/${p.slug}`} className={styles.blogMore}>
                        Подробнее →
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
