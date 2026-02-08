// apps/web/app/[region]/services/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import SeoJsonLd from "@/components/SeoJsonLd";
import { absUrl, jsonLdBreadcrumb } from "@/lib/seo";
import styles from "./page.module.css";

export const revalidate = 60;

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://api.moydompro.ru";

const SITE_ORIGIN =
  process.env.SITE_ORIGIN ||
  process.env.NEXT_PUBLIC_SITE_ORIGIN ||
  "https://moydompro.ru";

async function apiGetSafe(path: string) {
  try {
    const base = String(API_BASE || "").replace(/\/$/, "");
    const url = base + path;
    const r = await fetch(url, { next: { revalidate } });
    if (!r.ok) return null;
    return r.json().catch(() => null);
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
  image_url?: string | null;
};

type ServiceCategoryFlat = {
  id: number;
  slug: string;
  name: string;
  parent_id: number | null;
  sort_order?: number | null;
  path_name?: string;
  is_active?: boolean;
  image_url?: string | null;
  image_thumb_url?: string | null;
};

function toNum(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function fmtRub(n: number | null | undefined) {
  if (n == null) return null;
  return new Intl.NumberFormat("ru-RU").format(n);
}

function toPrepositional(city: string) {
  const map: Record<string, string> = {
    москва: "Москве",
    "санкт-петербург": "Санкт-Петербурге",
    петербург: "Петербурге",
    "нижний новгород": "Нижнем Новгороде",
  };
  const s = city.trim();
  return map[s.toLowerCase()] || `${s}е`;
}

function absPublicAsset(u?: string | null) {
  const s = String(u || "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) return "https:" + s;
  const path = s.startsWith("/") ? s : `/${s}`;
  if (path.startsWith("/uploads/")) return String(SITE_ORIGIN).replace(/\/+$/, "") + path;
  return path;
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

function formatPriceFrom(v?: number | string | null) {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `от ${fmtRub(n)} ₽`;
}

// ✅ Логика подбора картинок для услуг
function pickCategoryImage(slug: string, label: string) {
  const s = `${slug} ${label}`.toLowerCase();
  const map: Array<[RegExp, string]> = [
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
    [/vid/, "/images/cat/service-video.webp"], // Видеонаблюдение
  ];
  for (const [re, img] of map) if (re.test(s)) return img;
  return "/images/cat/service-default.png";
}

// ✅ Новый компонент карточки (как на скриншоте)
function ServiceCard(props: {
  href: string;
  title: string;
  meta?: string;
  imageUrl?: string | null;
}) {
  const { href, title, meta, imageUrl } = props;
  const src = absMedia(imageUrl || "");

  return (
    <Link href={href} className={styles.simpleCard}>
      <div className={styles.mediaRow}>
        <div className={styles.cardThumb} aria-hidden={!src}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
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

export async function generateMetadata({ params }: { params: { region: string } }): Promise<Metadata> {
  const region = String(params?.region || "").trim() || "moskva";
  const home = await apiGetSafe(`/home?region_slug=${encodeURIComponent(region)}`);
  const regionTitle = home?.region?.name || region;
  const regionIn = toPrepositional(regionTitle);
  return {
    title: `Услуги для дома — в ${regionIn} | МойДомПро`,
    description: `Каталог услуг для дома в ${regionIn}: категории, цены, компании и предложения.`,
    alternates: { canonical: absUrl(`/${region}/services`) },
  };
}

export default async function ServicesPage({
  params,
  searchParams,
}: {
  params: { region: string };
  searchParams?: { category?: string };
}) {
  const region = params.region || "moskva";
  if (searchParams?.category) {
    redirect(`/${region}/services/c/${encodeURIComponent(searchParams.category)}`);
  }

  const home = await apiGetSafe(`/home?region_slug=${encodeURIComponent(region)}`);
  const regionTitle = home?.region?.name || region;
  const regionIn = toPrepositional(regionTitle);
  const h1 = `Услуги — в ${regionIn}`;

  const catsPublic = await apiGetSafe(`/public/services/categories`);
  let categories: ServiceCategoryFlat[] = Array.isArray(catsPublic?.categories)
    ? catsPublic.categories
    : [];

  if (!categories.length) {
    const catsResp = await apiGetSafe(`/service-categories?flat=1`);
    categories = Array.isArray(catsResp?.result) ? catsResp.result : [];
  }

  categories = (Array.isArray(categories) ? categories : [])
    .filter((c) => c && c.slug && c.name && c.is_active !== false)
    .sort((a, b) => {
      const ao = Number(a.sort_order ?? 100);
      const bo = Number(b.sort_order ?? 100);
      if (ao !== bo) return ao - bo;
      return String(a.path_name || a.name).localeCompare(String(b.path_name || b.name), "ru");
    });

  const data = await apiGetSafe(`/public/region/${encodeURIComponent(region)}/services`);
  const items: ServiceItem[] = Array.isArray(data?.services) ? data.services : [];

  const canonical = absUrl(`/${region}/services`);
  const site = absUrl(`/`);

  const catList = categories
    .slice(0, 120)
    .map((c) => ({ name: c.name, url: absUrl(`/${region}/services/c/${encodeURIComponent(c.slug)}`) }));

  const svcList = items
    .slice(0, 18)
    .map((s) => ({
      name: s.name,
      url: absUrl(`/${region}/services/${encodeURIComponent(s.slug || String(s.id))}`),
    }));

  const itemList = (id: string, name: string, list: Array<{ name: string; url: string }>) => ({
    "@type": "ItemList",
    "@id": absUrl(`/${region}/services#${id}`),
    name,
    itemListOrder: "http://schema.org/ItemListOrderAscending",
    numberOfItems: list.length,
    itemListElement: list.map((it, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: it.name,
      url: it.url,
    })),
  });

  return (
    <div className={styles.pageWrap}>
      <SeoJsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            jsonLdBreadcrumb(
              [
                { name: "Главная", item: absUrl(`/${region}`) },
                { name: "Услуги", item: canonical },
              ],
              canonical + "#breadcrumb",
            ),
            {
              "@type": "WebSite",
              "@id": site + "#website",
              url: site,
              name: "МойДомПро",
            },
            {
              "@type": ["WebPage", "CollectionPage"],
              "@id": canonical + "#webpage",
              url: canonical,
              name: `Услуги для дома в ${regionIn} — МойДомПро`,
              isPartOf: { "@id": site + "#website" },
              breadcrumb: { "@id": canonical + "#breadcrumb" },
            },
            ...(catList.length ? [itemList("categories", `Категории услуг`, catList)] : []),
            ...(svcList.length ? [itemList("topServices", `Популярные услуги`, svcList)] : []),
          ],
        }}
      />

      <Breadcrumbs
        items={[
          { label: "Главная", href: `/${region}` },
          { label: "Услуги", href: `/${region}/services` },
        ]}
      />

      <h1 className={styles.h1}>{h1}</h1>

      {/* Рубрикатор категорий (оставляем как есть, это удобно) */}
      <section className={styles.section}>
        <h2 className={styles.h2}>Категории</h2>
        <div className={styles.rubricatorGrid}>
          <Link href={`/${region}/services`} className={styles.rubricatorTile}>
            <div className={styles.rubricatorTitle}>Все услуги</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.rubricatorImg} src="/images/cat/service-default.png" alt="Все" />
          </Link>
          {categories.map((c) => {
            const img = absPublicAsset(c.image_thumb_url || c.image_url) || pickCategoryImage(c.slug, c.name);
            return (
              <Link key={c.id} href={`/${region}/services/c/${encodeURIComponent(c.slug)}`} className={styles.rubricatorTile}>
                <div className={styles.rubricatorTitle}>{c.name}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.rubricatorImg} src={img} alt={c.name} loading="lazy" />
              </Link>
            );
          })}
        </div>
        <div className={styles.divider} />
      </section>

      {/* Список услуг (сетка обновленных карточек) */}
      <section className={styles.section}>
        <div className={styles.servicesHead}>
          <h2 className={styles.h2}>Популярные услуги</h2>
        </div>

        <div className={styles.grid}>
          {items.length === 0 ? (
            <div className={styles.emptyText}>Пока нет услуг.</div>
          ) : (
            items.map((s) => {
              const parts: string[] = [];
              const price = formatPriceFrom(toNum(s.price_min));
              if (price) parts.push(price);
              if ((Number(s.companies_count) || 0) > 0) {
                parts.push(`Компаний: ${s.companies_count}`);
              }
              return (
                <ServiceCard
                  key={s.slug || s.id}
                  href={`/${region}/services/${s.slug || s.id}`}
                  title={s.name}
                  meta={parts.length ? parts.join(" • ") : undefined}
                  imageUrl={s.image_url || pickCategoryImage(s.slug, s.name)}
                />
              );
            })
          )}
        </div>

        <div className={styles.backRow}>
          <Link href={`/${region}`} className={styles.backLink}>← На главную региона</Link>
        </div>
      </section>
    </div>
  );
}
