// apps/web/app/[region]/services/[slug]/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Breadcrumbs from "@/components/Breadcrumbs";
import GalleryLightbox from "@/components/GalleryLightbox";
import CompanyCard from "@/components/CompanyCard/CompanyCard";
import { renderTemplate } from "@/lib/renderTemplate";

import {
  SITE_URL,
  buildServiceSeo,
  buildSeoText,
  computeMinMaxFromCompanies,
  jsonLdBreadcrumb,
  jsonLdService,
  jsonLdWebPage,
  regionLoc,
} from "@/lib/seo";

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

// ✅ для страниц, где важен корректный 404 — получаем статус
async function apiGetWithStatus(path: string): Promise<{ status: number; data: any | null }> {
  const base = String(API_BASE || "").replace(/\/$/, "");
  const url = base + path;

  const r = await fetch(url, { next: { revalidate } });
  const status = r.status;

  if (!r.ok) return { status, data: null };

  const data = await r.json().catch(() => null);
  return { status, data };
}

/** ✅ жесткая валидация slug услуги: только латиница/цифры/дефис */
function isInvalidServiceSlug(v: any) {
  const s = String(v ?? "").trim();
  if (!s) return true;
  return !/^[a-z0-9-]+$/i.test(s);
}

function lcFirst(s: string) {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

async function resolveServiceName(regionSlug: string, serviceSlug: string): Promise<string | null> {
  const slug = String(serviceSlug || "").trim();
  if (!slug) return null;

  try {
    const one = await apiGet(`/public/services/${encodeURIComponent(slug)}`);
    const name = String(one?.service?.name || "").trim();
    if (one?.ok && name) return name;
  } catch {}

  try {
    const list = await apiGet(`/public/region/${encodeURIComponent(regionSlug)}/services`);
    const target = slug;
    const seen = new Set<any>();

    function pickSlug(x: any): string {
      return String(x?.slug ?? x?.service_slug ?? x?.serviceSlug ?? x?.code ?? x?.alias ?? x?.id ?? "").trim();
    }
    function pickName(x: any): string {
      return String(x?.name ?? x?.title ?? x?.label ?? "").trim();
    }

    function dfs(node: any): string | null {
      if (!node || typeof node !== "object") return null;
      if (seen.has(node)) return null;
      seen.add(node);

      if (Array.isArray(node)) {
        for (const it of node) {
          const r = dfs(it);
          if (r) return r;
        }
        return null;
      }

      const s = pickSlug(node);
      if (s && s === target) {
        const n = pickName(node);
        if (n) return n;
      }

      if (node.service && typeof node.service === "object") {
        const s2 = pickSlug(node.service);
        if (s2 && s2 === target) {
          const n2 = pickName(node.service);
          if (n2) return n2;
        }
      }

      for (const k of Object.keys(node)) {
        const r = dfs(node[k]);
        if (r) return r;
      }
      return null;
    }

    return dfs(list);
  } catch {
    return null;
  }
}

async function resolveRegionName(regionSlug: string): Promise<string> {
  try {
    const data = await apiGet(`/home?region_slug=${encodeURIComponent(regionSlug)}`);
    return String(data?.region?.name || data?.region?.title || data?.region_name || regionSlug).trim();
  } catch {
    return regionSlug;
  }
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

function normalizeImageUrl(u: any): string | null {
  const s = String(u ?? "").trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("//")) return "https:" + s;
  if (s.startsWith("/")) return s;
  return "/" + s;
}

function normalizePublicImageUrl(u: any): string | null {
  const raw = String(u ?? "").trim();
  if (!raw) return null;
  const s = raw
    .replace(/^https?:\/\/admin\.moydompro\.ru\/?/i, "https://moydompro.ru/")
    .replace(/^\/\/admin\.moydompro\.ru\/?/i, "https://moydompro.ru/");
  return normalizeImageUrl(s);
}

function asArr(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (!v) return [];
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x ?? "").trim()).filter(Boolean);
    } catch {
      if (s.includes(",")) return s.split(",").map((x) => x.trim()).filter(Boolean);
    }
  }
  return [];
}

function uniq(arr: (string | null | undefined)[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of arr) {
    const s = String(x ?? "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function absUrlMaybe(u: string) {
  if (/^https?:\/\//i.test(u)) return u;
  const base = String(SITE_URL || "").replace(/\/+$/, "");
  const path = u.startsWith("/") ? u : `/${u}`;
  return `${base}${path}`;
}

function companiesLabel(count: number) {
  const n = Math.abs(Number(count) || 0);
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "компания";
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "компании";
  return "компаний";
}

function pickCompanyPriceFrom(company: any, serviceSlug: string): { priceMin: number | null; currency: string } {
  const directCandidates = [
    company?.price_min,
    company?.price_from,
    company?.min_price,
    company?.minPrice,
    company?.priceMin,
    company?.price,
  ];
  for (const cand of directCandidates) {
    const n = toNum(cand);
    if (n !== null) {
      const cur = String(company?.currency || company?.cur || "RUB");
      return { priceMin: n, currency: cur };
    }
  }
  const items = Array.isArray(company?.items)
    ? company.items
    : Array.isArray(company?.company_items)
      ? company.company_items
      : [];
  const slug = String(serviceSlug || "").trim();
  let best: number | null = null;
  for (const it of items) {
    const itSlug = String(it?.service_slug ?? it?.serviceSlug ?? "").trim();
    const kind = String(it?.kind ?? it?.type ?? "").trim();
    if (kind && kind !== "service") continue;
    if (itSlug && slug && itSlug !== slug) continue;
    const n = toNum(it?.price_min ?? it?.priceMin ?? it?.price_from ?? it?.priceFrom ?? it?.price);
    if (n !== null) best = best === null ? n : Math.min(best, n);
  }
  const cur = String(company?.currency || "RUB");
  return { priceMin: best, currency: cur };
}

function pickCompanyLogoUrl(co: any): string | null {
  return normalizePublicImageUrl(
    co?.logo_url ??
      co?.logo ??
      co?.avatar ??
      co?.image_url ??
      co?.image ??
      co?.cover_image ??
      co?.coverImage ??
      co?.brand_logo ??
      null
  );
}

function pickCompanyCoverUrl(co: any): string | null {
  return normalizePublicImageUrl(co?.cover_image ?? co?.coverImage ?? co?.cover_url ?? co?.cover ?? null);
}

function pickCompanyAddress(co: any): string {
  const addr =
    String(co?.address ?? "").trim() ||
    String(co?.addr ?? "").trim() ||
    String(co?.location ?? "").trim() ||
    String(co?.office_address ?? "").trim();
  const city =
    String(co?.city ?? "").trim() ||
    String(co?.city_name ?? "").trim() ||
    String(co?.town ?? "").trim() ||
    String(co?.locality ?? "").trim();
  const region =
    String(co?.region_name ?? "").trim() ||
    String(co?.area ?? "").trim() ||
    String(co?.oblast ?? "").trim();
  if (addr) return addr;
  const parts = [city, region].filter(Boolean);
  return parts.join(", ");
}

type SpecRow = { name: string; value: string };

function normalizeSpecs(raw: any): SpecRow[] {
  let arr: any[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      return [];
    }
  } else if (raw && typeof raw === "object") {
    arr = Object.entries(raw).map(([k, v]) => ({ name: k, value: String(v ?? "") }));
  }
  const out: SpecRow[] = [];
  for (const it of arr) {
    const name = String(it?.name ?? it?.title ?? it?.key ?? "").trim();
    const value = String(it?.value ?? it?.val ?? it?.text ?? "").trim();
    if (!name || !value) continue;
    out.push({ name, value });
  }
  return out.slice(0, 10);
}

/* =========================
   METADATA
========================= */
export async function generateMetadata({
  params,
}: {
  params: { region: string; slug: string };
}): Promise<Metadata> {
  const regionSlug = String(params?.region || "").trim() || "moskva";
  const serviceSlug = String(params?.slug || "").trim();

  if (isInvalidServiceSlug(serviceSlug)) notFound();

  const regionName = await resolveRegionName(regionSlug);
  let serviceName: string | null = null;

  try {
    const { status, data } = await apiGetWithStatus(
      `/public/region/${encodeURIComponent(regionSlug)}/services/${encodeURIComponent(serviceSlug)}`
    );
    if (status === 404) notFound();

    const nameFromDetail = String(data?.service?.name || "").trim();
    serviceName = nameFromDetail || (await resolveServiceName(regionSlug, serviceSlug));

    if (!serviceName) notFound();

    const ok = data?.ok !== false;
    const companies = ok && Array.isArray(data?.companies) ? data.companies : [];
    const pr = computeMinMaxFromCompanies(companies);

    const seo = buildServiceSeo({
      regionSlug,
      regionName,
      serviceName: serviceName || serviceSlug,
      serviceSlug,
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
      service: { id: data?.service?.id ?? "", slug: serviceSlug, name: serviceName || serviceSlug },
      price: {
        from: pr.priceMin != null ? Math.round(Number(pr.priceMin)) : "",
        to: pr.priceMax != null ? Math.round(Number(pr.priceMax)) : "",
        currency: pr.currency || "RUB",
        from_fmt: pr.priceMin != null ? fmtRub(Math.round(Number(pr.priceMin))) : "",
        to_fmt: pr.priceMax != null ? fmtRub(Math.round(Number(pr.priceMax))) : "",
      },
      companies: { count: companies.length, label: companiesLabel(companies.length) },
    };

    const overrideTitleRaw = String(data?.service?.seo_title ?? "").trim();
    const overrideDescRaw = String(data?.service?.seo_description ?? "").trim();
    const title = (overrideTitleRaw ? renderTemplate(overrideTitleRaw, ctx) : "") || renderTemplate(seo.title, ctx);
    const description = (overrideDescRaw ? renderTemplate(overrideDescRaw, ctx) : "") || renderTemplate(seo.description, ctx);

    return {
      title,
      description,
      alternates: { canonical: seo.canonical },
    };
  } catch {
    serviceName = await resolveServiceName(regionSlug, serviceSlug);
    if (!serviceName) notFound();
    return { title: `${serviceName} в ${regionName}`, description: "" };
  }
}

/* =========================
   PAGE COMPONENT
========================= */
export default async function ServicePage({
  params,
}: {
  params: { region: string; slug: string };
}) {
  const regionSlug = String(params?.region || "").trim();
  const serviceSlug = String(params?.slug || "").trim();

  if (!regionSlug || !serviceSlug) notFound();
  if (isInvalidServiceSlug(serviceSlug)) notFound();

  const { status, data } = await apiGetWithStatus(
    `/public/region/${encodeURIComponent(regionSlug)}/services/${encodeURIComponent(serviceSlug)}`
  );
  if (status === 404) notFound();

  const nameFromDetail = String(data?.service?.name || "").trim();
  const resolvedName = nameFromDetail || (await resolveServiceName(regionSlug, serviceSlug));
  const apiSaysNotFound = data?.ok === false && (data?.error === "service_not_found" || data?.error === "not_found" || data?.error === "region_not_found");

  if (apiSaysNotFound || !resolvedName) notFound();

  const regionName = String(data?.region?.name || "").trim() || (await resolveRegionName(regionSlug));
  const regionIn = regionLoc({ slug: regionSlug, name: regionName });
  const serviceLabel = resolvedName;

  const ok = data?.ok !== false;
  const companies = ok && Array.isArray(data?.companies) ? data.companies : [];
  const pr = computeMinMaxFromCompanies(companies);

  const seo = buildServiceSeo({
    regionSlug,
    regionName,
    serviceName: serviceLabel,
    serviceSlug,
    price: pr,
    companiesCount: companies.length,
  });

  const ldBreadcrumbs = jsonLdBreadcrumb([
    { name: "Главная", item: `${SITE_URL}/${regionSlug}` },
    { name: "Услуги", item: `${SITE_URL}/${regionSlug}/services` },
    { name: serviceLabel, item: seo.canonical },
  ]);

  const ldService = {
    ...jsonLdService({
      url: seo.canonical,
      name: serviceLabel,
      regionName,
      price: pr,
      companiesCount: companies.length,
    }),
    "@id": `${seo.canonical}#service`,
  };

  const ctx = {
    region: { id: data?.region?.id ?? "", slug: regionSlug, name: regionName, in: regionIn },
    service: { id: data?.service?.id ?? "", slug: serviceSlug, name: serviceLabel },
    price: {
      from: pr.priceMin != null ? Math.round(Number(pr.priceMin)) : "",
      to: pr.priceMax != null ? Math.round(Number(pr.priceMax)) : "",
      currency: pr.currency || "RUB",
      from_fmt: pr.priceMin != null ? fmtRub(Math.round(Number(pr.priceMin))) : "",
      to_fmt: pr.priceMax != null ? fmtRub(Math.round(Number(pr.priceMax))) : "",
    },
    companies: { count: companies.length, label: companiesLabel(companies.length) },
  };

  const overrideH1Raw = String(data?.service?.seo_h1 ?? "").trim();
  const overrideH1 = overrideH1Raw ? renderTemplate(overrideH1Raw, ctx) : null;
  const h1 = overrideH1 ? overrideH1 : `${serviceLabel} ${regionIn}`;

  const canonicalDescRaw =
    String(data?.service?.canonical_description ?? "").trim() ||
    String(data?.service?.description ?? "").trim() ||
    String(data?.service?.short_description ?? "").trim() ||
    "";

  const canonicalDesc = canonicalDescRaw ? renderTemplate(canonicalDescRaw, ctx) : "";

  const canonicalImage = normalizePublicImageUrl(
    data?.service?.canonical_image ?? data?.service?.image_url ?? data?.service?.image
  );

  const ldWebPageData = jsonLdWebPage({
    url: seo.canonical,
    name: h1,
    description: canonicalDesc || seo.description,
    imageUrl: canonicalImage ? absUrlMaybe(canonicalImage) : null,
    mainEntityId: `${seo.canonical}#service`,
  });

  const galleryRaw = data?.service?.gallery ?? data?.service?.images ?? data?.service?.photos ?? null;
  const gallery = asArr(galleryRaw).map((x) => normalizePublicImageUrl(x)).filter(Boolean) as string[];
  // Убираем дубликат главного фото из галереи
  const galleryImages = uniq([canonicalImage, ...gallery].filter(Boolean));

  const specs = normalizeSpecs(data?.service?.specs);

  // JSON-LD Images
  const imageObjects = galleryImages.map((u, i) => ({
    "@type": "ImageObject",
    contentUrl: absUrlMaybe(u),
    url: absUrlMaybe(u),
    caption: `${serviceLabel} — фото ${i + 1}`,
  }));

  const ldImages = imageObjects.length
    ? {
        "@context": "https://schema.org",
        "@type": "WebPage",
        url: seo.canonical,
        name: serviceLabel,
        primaryImageOfPage: canonicalImage
          ? { "@type": "ImageObject", contentUrl: absUrlMaybe(canonicalImage) }
          : undefined,
        mainEntity: {
          "@type": "Service",
          name: serviceLabel,
          image: imageObjects.map((x) => x.contentUrl),
        },
        associatedMedia: imageObjects,
      }
    : null;

  // Prepare Companies
  const companiesForCards = companies.map((co: any) => {
    const p = pickCompanyPriceFrom(co, serviceSlug);
    const photos = asArr(co?.photos ?? co?.gallery ?? co?.works).map((x) => normalizePublicImageUrl(x)).filter(Boolean) as string[];
    const desc = String(co?.description ?? co?.short_description ?? "").replace(/\s+/g, " ").trim() || null;
    const cover = pickCompanyCoverUrl(co);

    return {
      id: Number(co?.id),
      name: String(co?.name || "").trim() || `Компания #${String(co?.id)}`,
      is_verified: !!co?.is_verified,
      rating: toNum(co?.rating) ?? null,
      reviews_count: toNum(co?.reviews_count) ?? null,
      logo_url: pickCompanyLogoUrl(co),
      cover_image: cover,
      coverImage: cover,
      address: pickCompanyAddress(co),
      price_min: p.priceMin,
      currency: p.currency || "RUB",
      photos,
      gallery: photos,
      images: photos,
      description: desc,
      short_description: desc,
      items_count: toNum(co?.items_count) ?? null,
    };
  });

  return (
    <div className={styles.wrap}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldBreadcrumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldWebPageData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldService) }} />
      {ldImages ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldImages) }} /> : null}

      <Breadcrumbs
        items={[
          { label: "Главная", href: `/${regionSlug}` },
          { label: "Услуги", href: `/${regionSlug}/services` },
          { label: serviceLabel },
        ]}
      />

      <div className={styles.h1Row}>
        <h1 className={styles.h1}>{h1}</h1>
      </div>

      <div className={styles.pageGrid}>
        
        {/* ЛЕВАЯ КОЛОНКА */}
        <div className={styles.mainColumn}>
          
          {/* 1. ГАЛЕРЕЯ */}
          <section className={styles.galleryBlock}>
            {galleryImages.length > 0 ? (
              <>
                <div className={styles.heroImgWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={galleryImages[0]} alt={serviceLabel} className={styles.heroImg} loading="eager" />
                </div>
                {galleryImages.length > 1 && (
                   <div className={styles.thumbsContainer}>
                     <GalleryLightbox images={galleryImages} altBase={serviceLabel} />
                   </div>
                )}
              </>
            ) : (
               <div className={styles.missingImage}>Изображение отсутствует</div>
            )}
          </section>

          {/* 2. ХАРАКТЕРИСТИКИ */}
          {specs.length > 0 && (
            <section className={styles.specsBlock}>
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

          {/* 3. ОПИСАНИЕ */}
          {canonicalDesc && (
             <section className={styles.descBlock}>
               <h2 className={styles.h2}>Описание</h2>
               <div className={styles.descText} dangerouslySetInnerHTML={{ __html: canonicalDesc }} />
             </section>
          )}
        </div>

        {/* ПРАВАЯ КОЛОНКА (САЙДБАР) */}
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
          </div>
        </aside>
      </div>

      {/* НИЖНЯЯ СЕКЦИЯ: СПИСОК КОМПАНИЙ */}
      <section className={styles.companiesSection} id="companies">
        <h2 className={styles.h2}>Предложения компаний ({companies.length})</h2>
        {companies.length === 0 ? (
           <p className={styles.emptyCompanies}>Пока нет активных предложений по этой услуге в выбранном регионе.</p>
        ) : (
           <div className={styles.companiesListWrapper}>
              <div className={styles.companiesList}>
                  {companiesForCards.map((c) => (
                      <CompanyCard
                          key={c.id}
                          regionSlug={regionSlug}
                          company={c as any}
                          companyHref={`/${regionSlug}/c/${c.id}`}
                      />
                  ))}
              </div>
           </div>
        )}
      </section>

      <div className={styles.backRow}>
        <Link href={`/${regionSlug}/services`} className={styles.backLink}>← Все услуги</Link>
      </div>
    </div>
  );
}
