// apps/web/app/[region]/products/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import styles from "./page.module.css";

export const revalidate = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://moydompro.ru";

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://api.moydompro.ru";

async function apiGetSafe(path: string) {
  const base = String(API_BASE || "").replace(/\/$/, "");
  const url = base + path;
  const r = await fetch(url, { next: { revalidate } });
  if (!r.ok) return null;
  return r.json();
}

// ... (типы ProductItem, CategoryFlat оставляем без изменений) ...
type ProductItem = {
  id: number;
  name: string;
  slug: string;
  category?: string | null;
  category_id?: number | null;
  companies_count?: number | null;
  price_min?: number | string | null;
  currency?: string | null;
  image_url?: string | null;
  image?: string | null;
  cover_image?: string | null;
  coverImage?: string | null;
  photos?: string[] | null;
};

type CategoryFlat = {
  id: number;
  slug: string;
  name: string;
  parent_id: number | null;
  is_active?: boolean;
  sort_order?: number;
};

function getApiOrigins() {
  const apiBase = API_BASE;
  const apiOrigin = String(apiBase).replace(/\/+$/, "");
  const SITE = process.env.SITE_ORIGIN || process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://moydompro.ru";
  const siteOrigin = String(SITE).replace(/\/+$/, "");
  return { apiOrigin, siteOrigin };
}

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

function pickProductImageAbs(p: any, absPublicUrl: (v: any) => string | null): string | null {
  const direct = p?.image_url || p?.imageUrl || p?.image || p?.cover_image || p?.coverImage || p?.photo || p?.photo_url || null;
  const d = absPublicUrl(direct);
  if (d) return d;
  const photos = p?.photos || p?.images || null;
  if (Array.isArray(photos) && photos.length) {
    const first = absPublicUrl(photos[0]);
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

function pickCategoryImage(kind: "product" | "service", slug: string, label: string) {
  const s = `${slug} ${label}`.toLowerCase();
  const product: Array<[RegExp, string]> = [
    [/septic|септик|станц|биоочист/i, "/images/cat/product-septic.png"],
    [/water|вода|насос/i, "/images/cat/product-water.png"],
    [/heating|отопл|котел|радиат/i, "/images/cat/product-heating.png"],
    [/electric|электр|кабел|щит/i, "/images/cat/product-electric.png"],
    [/drain|дренаж/i, "/images/cat/product-drainage.png"],
    [/pump|насос/i, "/images/cat/product-water.png"],
    [/fence|забор|ворот/i, "/images/cat/product-fence.png"],
    [/material|материал|достав|песок|щебен|цемент/i, "/images/cat/product-materials.png"],
  ];
  const list = kind === "product" ? product : [];
  for (const [re, img] of list) if (re.test(s)) return img;
  return kind === "product" ? "/images/cat/product-default.png" : "/images/cat/service-default.png";
}

function CategoriesTileRow({ title, items, kind }: { title: string; kind: "product" | "service"; items: Array<{ label: string; href: string; slug?: string }>; }) {
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

// ✅ НОВЫЙ КОМПОНЕНТ КАРТОЧКИ (Как на главной региона)
function MediaCard(props: {
  href: string;
  title: string;
  meta?: string;
  imageUrl?: string | null;
}) {
  const { href, title, meta, imageUrl } = props;

  return (
    <Link href={href} className={styles.simpleCard}>
      <div className={styles.cardThumb}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={title} loading="lazy" />
        ) : (
          <div className={styles.cardThumbPlaceholder}>📦</div>
        )}
      </div>

      <div className={styles.cardInfo}>
        <div className={styles.simpleCardTitle} title={title}>{title}</div>
        {meta ? <div className={styles.simpleCardMeta}>{meta}</div> : null}
      </div>
    </Link>
  );
}

export async function generateMetadata({ params }: { params: { region: string } }): Promise<Metadata> {
  const region = String(params?.region || "").trim() || "moskva";
  const home = await apiGetSafe(`/home?region_slug=${encodeURIComponent(region)}`);
  const regionTitle = String(home?.region?.name || home?.region?.title || home?.region_name || region).trim();
  const regionIn = toPrepositional(regionTitle);
  const title = `Товары для дома и участка — в ${regionIn} | МойДомПро`;
  const description = `Каталог товаров для дома и участка в ${regionIn}: септики, насосы, водоснабжение, дренаж и другое.`;
  const canonical = `${SITE_URL}/${encodeURIComponent(region)}/products`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website", locale: "ru_RU" },
  };
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: { region: string };
  searchParams?: { category?: string; category_id?: string };
}) {
  const region = String(params?.region || "").trim() || "moskva";
  const qCategory = String(searchParams?.category || "").trim();
  if (qCategory) {
    redirect(`/${region}/products/c/${encodeURIComponent(qCategory)}`);
  }

  const home = await apiGetSafe(`/home?region_slug=${encodeURIComponent(region)}`);
  const regionTitle = home?.region?.name || home?.region?.title || home?.region_name || region;
  const regionIn = toPrepositional(regionTitle);
  const h1 = `Товары — в ${regionIn}`;

  const catsResp = await apiGetSafe(`/product-categories?flat=1`);
  const cats: CategoryFlat[] = Array.isArray(catsResp?.result) ? catsResp.result : Array.isArray(catsResp?.items) ? catsResp.items : [];
  const data = await apiGetSafe(`/public/region/${encodeURIComponent(region)}/products`);
  const items: ProductItem[] = Array.isArray(data?.products) ? data.products : [];

  const { apiOrigin, siteOrigin } = getApiOrigins();
  const absPublicUrl = makeAbsPublicUrlFactory(siteOrigin, apiOrigin);

  const parents = cats.filter((c) => c.parent_id == null).sort((a, b) => {
    const ao = a.sort_order ?? 100;
    const bo = b.sort_order ?? 100;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name, "ru");
  });

  return (
    <div className={styles.container}>
      <Breadcrumbs
        items={[
          { label: "Главная", href: `/${region}` },
          { label: "Товары", href: `/${region}/products` },
        ]}
      />

      <div className={styles.h1Wrap}>
        <h1 className={styles.h1}>{h1}</h1>
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

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>Все товары</h2>
          {/* Ссылку "Посмотреть все" убрали, так как мы уже на этой странице */}
        </div>

        {/* ✅ ВЫВОД В ВИДЕ СЕТКИ (GRID) */}
        <div className={styles.grid}>
          {items.length === 0 ? (
            <div className={styles.empty}>Пока нет товаров.</div>
          ) : (
            items.map((p) => {
              const priceFrom = toNum(p.price_min);
              const companiesCount = Number(p.companies_count ?? 0) || 0;
              const imageUrl = pickProductImageAbs(p, absPublicUrl);

              const parts: string[] = [];
              if (priceFrom) parts.push(`от ${fmtRub(priceFrom)} ₽`);
              if (companiesCount > 0) parts.push(`Компаний: ${companiesCount}`);

              return (
                <MediaCard
                  key={p.slug || p.id}
                  href={`/${region}/products/${p.slug || p.id}`}
                  title={p.name}
                  meta={parts.join(" · ")}
                  imageUrl={imageUrl}
                />
              );
            })
          )}
        </div>
      </section>

      <div className={styles.backRow}>
        <Link href={`/${region}`}>← На главную региона</Link>
      </div>
    </div>
  );
}