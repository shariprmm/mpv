// /apps/web/app/[region]/c/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import type { Metadata } from "next";
import { buildCompanySeo, toNextMetadata } from "@/lib/seo";
import SeoJsonLd from "@/components/SeoJsonLd";
import { jsonLdBreadcrumb, jsonLdCompany, absUrl } from "@/lib/seo";

// ✅ Импортируем ваш компонент
import Breadcrumbs from "@/components/Breadcrumbs";

import Cut from "./_components/Cut";
import Scroller from "./_components/Scroller";
import Collapse from "./_components/Collapse";

import GalleryLightbox from "@/components/GalleryLightbox";
import ReviewsBlock from "./_components/ReviewsBlock";

export async function generateMetadata({
  params,
}: {
  params: { region: string; id: string };
}): Promise<Metadata> {
  const regionSlug = String(params.region || "").trim();
  const id = Number(params.id);

  if (!regionSlug || !Number.isFinite(id) || id <= 0) {
    return { robots: { index: false, follow: false } };
  }

  const base = String(API_BASE || "").replace(/\/$/, "");

  try {
    // важно: берём название региона из БД (как на товарных страницах)
    const r = await fetch(`${base}/companies/${id}`, { next: { revalidate } });
    if (!r.ok) return { robots: { index: false, follow: false } };

    const data = await r.json().catch(() => null);
    const c = data?.company;
    if (!data?.ok || !c) return { robots: { index: false, follow: false } };

    const seo = buildCompanySeo({
      regionSlug,
      regionName: String(c.region_name || regionSlug),
      companyName: String(c.name || "Компания"),
      companyId: id,
    });

    return toNextMetadata(seo);
  } catch {
    return { alternates: { canonical: `https://moydompro.ru/${regionSlug}/c/${id}` } };
  }
}

export const revalidate = 60;

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://api.moydompro.ru";

const PUBLIC_SITE =
  (process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "").replace(/\/+$/, "") ||
  "https://moydompro.ru";

function asStr(v: any) {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  return s.trim();
}

function toPublicUploadsUrl(u: string | null | undefined) {
  const s0 = asStr(u);
  if (!s0) return "";
  if (/^https?:\/\//i.test(s0)) return s0;
  const s = s0.startsWith("uploads/") ? `/${s0}` : s0;
  if (s.startsWith("/uploads/")) return `${PUBLIC_SITE}${s}`;
  return s0;
}

/**
 * ✅ Safe JSON fetch:
 * - читает text()
 * - пытается JSON.parse
 * - если в начале мусор/HTML/BOM — обрезает до первого { или [
 * - на любом сбое возвращает null (чтобы SSR не падал)
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
      firstObj === -1
        ? firstArr
        : firstArr === -1
          ? firstObj
          : Math.min(firstObj, firstArr);

    const clean = cutAt > 0 ? txt.slice(cutAt) : txt;

    try {
      return JSON.parse(clean);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

function formatInt(n: number) {
  try {
    return new Intl.NumberFormat("ru-RU").format(n);
  } catch {
    return String(n);
  }
}

function formatPrice(price: number | null | undefined, currency?: string | null) {
  if (price == null || !Number.isFinite(Number(price))) return null;
  const cur = (currency || "RUB").toUpperCase();
  const num = formatInt(Math.round(Number(price)));
  if (cur === "RUB" || cur === "RUR") return `${num} ₽`;
  return `${num} ${cur}`;
}

function normalizeTelHref(phone: string) {
  const p = String(phone || "").replace(/[^\d+]/g, "");
  return p ? `tel:${p}` : "";
}

function parsePhotos(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x || "")).filter(Boolean);
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      if (Array.isArray(p)) return p.map((x) => String(x || "")).filter(Boolean);
    } catch {}
  }
  return [];
}

type CompanyApi = {
  id: number;
  name: string;
  logo_url?: string | null;

  region_name?: string | null;
  region_slug?: string | null;

  address?: string | null;
  phone?: string | null;

  rating?: number | string | null;
  reviews_count?: number | null;

  is_verified?: boolean;

  description?: string | null;
  about?: string | null;
  photos?: any;

  age?: number | null;
  contact_hours?: string | null;
  last_seen_human?: string | null;

  vk_url?: string | null;
  tg_url?: string | null;
  youtube_url?: string | null;

  lat?: number | null;
  lng?: number | null;
  areas?: string[] | null;
};

type CompanyItemApi = {
  id: number;
  kind: "service" | "product" | "custom";
  currency: string | null;

  price_min: number | null;
  price_max: number | null;

  service_name?: string | null;
  service_slug?: string | null;

  product_name?: string | null;
  product_slug?: string | null;

  custom_title?: string | null;

  description?: string | null;
  photos?: any;
};

type PortfolioItem = {
  id: number;
  title: string;
  description: string | null;
  photos: any;
  price?: number | null;
  currency?: string | null;
};

type PortfolioNormalized = {
  id: number;
  title: string;
  description: string | null;
  photos: string[];
  price: number | null;
  currency: string | null;
};

export default async function CompanyProfilePage({
  params,
}: {
  params: { region: string; id: string };
}) {
  const regionSlug = asStr(params.region);
  const id = Number(params.id);
  if (!regionSlug || !Number.isFinite(id) || id <= 0) return notFound();

  const data = await apiGetSafe(`/companies/${id}`);
  if (!data?.ok || !data?.company) return notFound();

  const company: CompanyApi = data.company;

  // ===== SEO JSON-LD (внутри компонента!) =====
  const pageUrl = absUrl(`/${regionSlug}/c/${company.id}`);

  const ldBreadcrumb = jsonLdBreadcrumb([
    { name: "МойДомПро", item: absUrl("/") },
    { name: company.region_name || regionSlug, item: absUrl(`/${regionSlug}`) },
    { name: company.name, item: pageUrl },
  ]);

  const ldCompany = jsonLdCompany({
    url: pageUrl,
    name: company.name,
    regionName: company.region_name || regionSlug,
    rating: typeof company.rating === "string" ? Number(company.rating) : (company.rating ?? null),
    reviewsCount: company.reviews_count ?? null,
  });


  const items: CompanyItemApi[] = Array.isArray(data.items) ? data.items : [];

  const portfolioRes = await apiGetSafe(`/companies/${id}/portfolio`);
  const portfolioRaw: PortfolioItem[] = Array.isArray(portfolioRes?.items)
    ? portfolioRes.items
    : [];

  const reviewsRes = await apiGetSafe(`/public/companies/${id}/reviews?limit=20`);
  const reviews = Array.isArray(reviewsRes?.items) ? reviewsRes.items : [];
  const reviewsStats = reviewsRes?.stats || { reviews_count: 0, rating_avg: 0 };

  const ratingAvgNum = Number(reviewsStats?.rating_avg);
  const ratingAvg = Number.isFinite(ratingAvgNum) && ratingAvgNum > 0 ? ratingAvgNum : 0;

  const ratingsCount = Number(reviewsStats?.total_count || 0); // ВСЕ оценки
  const textReviewsCount = Number(reviewsStats?.reviews_count || 0); // ТОЛЬКО с текстом


  const logo = toPublicUploadsUrl(company.logo_url);

  const ratingNum = Number(company.rating);
  const rating = Number.isFinite(ratingNum) && ratingNum > 0 ? ratingNum.toFixed(1) : null;

  const reviewsCount = company.reviews_count ? Number(company.reviews_count) : 0;
  const telHref = company.phone ? normalizeTelHref(company.phone) : "";

  const aboutText = asStr(company.description ?? company.about);

  const companyPhotos = parsePhotos(company.photos)
    .map(toPublicUploadsUrl)
    .filter(Boolean)
    .slice(0, 80);

  const services = items.filter((x) => x.kind === "service");
  const products = items.filter((x) => x.kind === "product");
  const customs = items.filter((x) => x.kind === "custom");

  const portfolioNormalized: PortfolioNormalized[] = [
    ...(companyPhotos.length
      ? [
          {
            id: -1,
            title: "Фотографии",
            description: null,
            photos: companyPhotos,
            price: null,
            currency: null,
            } as PortfolioNormalized,
        ]
      : []),
    ...portfolioRaw.slice(0, 60).map((p) => {
      const photos = parsePhotos(p.photos).map(toPublicUploadsUrl).filter(Boolean);
      return {
        id: Number(p.id),
        title: asStr(p.title) || "Работа",
        description: p.description ? asStr(p.description) : null,
        photos,
        price: p.price ?? null,
        currency: p.currency ?? "RUB",
      };
    }),
  ].filter((p) => p.photos.length);

  // ✅ Подготавливаем крошки
  const crumbs = [
    { label: "Главная", href: "/" },
    { label: company.region_name || regionSlug, href: `/${regionSlug}` },
    { label: "Компании", href: `/${regionSlug}/companies` },
    { label: company.name },
  ];

  return (
    <main className={styles.LayoutMain}>
      <SeoJsonLd data={ldBreadcrumb} />
      <SeoJsonLd data={ldCompany} />

      <div className={styles.ContentWrap}>
        
        {/* ✅ Выводим хлебные крошки */}
        <Breadcrumbs items={crumbs} />

        <div className={styles.ContentInner}>
          <div className={styles.ContentLeft}>
            <div className={styles.PublicProfileLeft}>
              {/* ===== WorkerAbout2 ===== */}
              <section className={`${styles.Card} ${styles.WorkerAbout2} ${styles.MainBlock}`}>
                <div className={styles.WorkerAbout2Head}>
                  <div className={styles.Avatar}>
                    {logo ? (
                      <img
                        className={styles.AvatarThumb}
                        src={logo}
                        width={120}
                        height={120}
                        alt={company.name}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className={styles.AvatarStub} aria-hidden="true">
                        {asStr(company.name).slice(0, 1).toUpperCase() || "C"}
                      </div>
                    )}
                  </div>

                  <div className={styles.WorkerAbout2Info}>
                    <div className={styles.TitleXXL}>{company.name}</div>

                    <div className={styles.SplittedItems}>
                      <span className={styles.SplittedItem}>
                        <span className={styles.WorkerGeoAddress}>
                          {company.region_name || regionSlug}
                        </span>
                      </span>
                      <span className={styles.SplittedDivider}>·</span>
                      <span className={styles.SplittedItem}>
                        <span className={styles.GreyText}>
                          {company.last_seen_human ? company.last_seen_human : "В сети недавно"}
                        </span>
                      </span>
                    </div>

                    <div className={styles.WorkerControls}>
                      <div className={styles.WorkerControlsRow}>
                        {telHref ? (
                          <a className={`${styles.Btn} ${styles.BtnAction}`} href={telHref}>
                            Телефон
                          </a>
                        ) : (
                          <button className={`${styles.Btn} ${styles.BtnAction}`} disabled>
                            Телефон
                          </button>
                        )}

                        <Link
                          className={`${styles.Btn} ${styles.BtnNormal}`}
                          href={`/${regionSlug}/c/${company.id}?chat=1`}
                        >
                          Чат
                        </Link>

                        <Link
                          className={`${styles.Btn} ${styles.BtnNormal}`}
                          href={`/${regionSlug}/c/${company.id}?offer=1`}
                        >
                          Предложить заказ
                        </Link>
                      </div>

                      <button className={styles.ComplainBtn} title="Ещё" aria-label="Ещё">
                        ⋮
                      </button>
                    </div>
                  </div>
                </div>

                {aboutText ? (
                  <div className={styles.WorkerAbout2Item}>
                    <div className={styles.WorkerAbout2About}>
                      <Cut
                        text={aboutText}
                        collapsedLines={3}
                        moreLabel="Развернуть"
                        lessLabel="Свернуть"
                      />
                    </div>
                  </div>
                ) : null}

                {company.age ? (
                  <div className={styles.WorkerAbout2Item}>
                    <span className={styles.BoldLabel}>Возраст:&nbsp;</span>
                    <span className={styles.TextM}>{company.age} лет</span>
                  </div>
                ) : null}

                {company.contact_hours ? (
                  <div className={styles.WorkerAbout2Item}>
                    <span className={styles.BoldLabel}>Удобное время для связи:&nbsp;</span>
                    <span className={styles.TextM}>{company.contact_hours}</span>
                  </div>
                ) : null}
              </section>

              {/* ===== Portfolio ===== */}
              {portfolioNormalized.length ? (
                <section className={`${styles.Card} ${styles.MainBlock}`} id="public_portfolio_list">
                  <h3 className={styles.TitleXL}>Примеры работ</h3>

                  <div className={styles.PortfolioList}>
                    {portfolioNormalized
                      .filter((p) => !/дренаж\s*12\s*соток/i.test(p.title || "")) // ✅ удаляем полностью
                      .slice(0, 40)
                      .map((p) => {
                        const price = formatPrice(p.price ?? null, p.currency ?? "RUB");

                        return (
                          <article key={p.id} className={styles.PortfolioItem}>
                            <div className={styles.PortfolioHeadRow}>
                              <div className={styles.PortfolioTitle} title={p.title}>
                                {p.title}
                              </div>
                            </div>

                            {/* ✅ Галерея как на /products/... */}
                            <GalleryLightbox images={p.photos} altBase={p.title || "Фото"} />
                          </article>
                        );
                      })}
                  </div>
                </section>
              ) : null}

              {/* ===== Items ===== */}
              <section className={`${styles.MainBlock}`} id="worker_specialization_list">
                {services.length ? (
                  <Collapse title="Услуги" defaultOpen>
                    <div className={styles.SpecializationCard}>
                      <div className={styles.ServicesList} id="services">
                        {services.map((it) => (
                          <ProfileServiceCard
                            key={it.id}
                            it={it}
                            regionSlug={regionSlug}
                            companyId={company.id}
                          />
                        ))}
                      </div>
                    </div>
                  </Collapse>
                ) : null}

                {products.length ? (
                  <Collapse title="Товары" defaultOpen={false}>
                    <div className={styles.SpecializationCard} id="products">
                      <div className={styles.ServicesList}>
                        {products.map((it) => (
                          <ProfileServiceCard
                            key={it.id}
                            it={it}
                            regionSlug={regionSlug}
                            companyId={company.id}
                          />
                        ))}
                      </div>
                    </div>
                  </Collapse>
                ) : null}

                {customs.length ? (
                  <Collapse title="Другое" defaultOpen={false}>
                    <div className={styles.SpecializationCard} id="customs">
                      <div className={styles.ServicesList}>
                        {customs.map((it) => (
                          <ProfileServiceCard
                            key={it.id}
                            it={it}
                            regionSlug={regionSlug}
                            companyId={company.id}
                          />
                        ))}
                      </div>
                    </div>
                  </Collapse>
                ) : null}
              </section>

              {/* ===== Reviews ===== */}
              <section id="reviewsAnchor" className={`${styles.Card} ${styles.MainBlock}`}>
                <ReviewsBlock
                  regionSlug={regionSlug}
                  companyId={company.id}
                  initialItems={reviews}
                  initialStats={reviewsStats}
                />
              </section>

              <div className={styles.AllowParsing}>
                Пользователь дал согласие на распространение его персональных данных, указанных в его объявлениях
              </div>
            </div>
          </div>

          {/* ===== Right column ===== */}
          <div className={styles.ContentRight}>
            <div className={styles.PublicProfileRight}>
              <div className={`${styles.RightBlock} ${styles.RightReviews}`}>
                <div className={styles.GreenRatingLine} />
                <div className={styles.RightReviewsLink}>
                  <div className={styles.RatingStarsRow} aria-label={`Рейтинг ${ratingAvg.toFixed(1)} из 5`}>
                    <StarsGold value={ratingAvg} />
                    <span className={styles.RatingValue}>{ratingAvg ? ratingAvg.toFixed(1) : "—"}</span>
                  </div>

                  <div className={styles.GreyText}>
                    {ratingsCount ? `${ratingsCount} оценок` : "0 оценок"}
                    {textReviewsCount ? ` · ${textReviewsCount} отзывов` : " · 0 отзывов"}
                  </div>
                </div>
              </div>

              <div className={`${styles.RightBlock} ${styles.UgcCardRight}`}>
                <div className={styles.UgcTitle}>Вы сотрудничали с этим специалистом?</div>
                <div className={styles.UgcDesc}>Оцените его работу</div>
                <button className={`${styles.Btn} ${styles.BtnNormal}`}>Оценить</button>
              </div>

              <div className={styles.RightBlock}>
                <div className={styles.AchievementsList}>
                  <AchievementRow text="Паспорт проверен" />
                  <AchievementRow text="Работает по договору" />
                  <AchievementRow text="Даёт гарантию" />
                </div>

                <div className={styles.RightContacts}>
                  {company.address ? (
                    <>
                      <div className={styles.RightContactsLabel}>Адрес</div>
                      <div className={styles.RightContactsText}>{company.address}</div>
                    </>
                  ) : null}

                  <div className={styles.RightContactsLinks}>
                    {company.vk_url ? (
                      <a className={styles.PillLink} href={company.vk_url} target="_blank" rel="noreferrer">
                        VK
                      </a>
                    ) : null}
                    {company.tg_url ? (
                      <a className={styles.PillLink} href={company.tg_url} target="_blank" rel="noreferrer">
                        Telegram
                      </a>
                    ) : null}
                    {company.youtube_url ? (
                      <a className={styles.PillLink} href={company.youtube_url} target="_blank" rel="noreferrer">
                        YouTube
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function StarsGold({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  const full = Math.floor(v);
  const frac = v - full;

  // простая логика: 0.5+ считаем как "полузвезда" визуально через градиент
  return (
    <span className={styles.StarsGold} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => {
        const isFull = i <= full;
        const isHalf = !isFull && i === full + 1 && frac >= 0.25 && frac < 0.75;
        const isAlmostFull = !isFull && i === full + 1 && frac >= 0.75;

        return (
          <span
            key={i}
            className={`${styles.StarGold} ${isFull || isAlmostFull ? styles.StarGoldOn : ""} ${
              isHalf ? styles.StarGoldHalf : ""
            }`}
          >
            ★
          </span>
        );
      })}
    </span>
  );
}


function AchievementRow({ text }: { text: string }) {
  return (
    <div className={styles.AchievementRow}>
      <div className={styles.AchievementIcon} aria-hidden="true">
        ✓
      </div>
      <div className={styles.AchievementText}>{text}</div>
    </div>
  );
}

function ProfileServiceCard({
  it,
  regionSlug,
  companyId,
}: {
  it: CompanyItemApi;
  regionSlug: string;
  companyId: number;
}) {
  const name =
    it.kind === "service"
      ? asStr(it.service_name)
      : it.kind === "product"
        ? asStr(it.product_name)
        : asStr(it.custom_title) || "Без названия";

  const price = formatPrice(it.price_min, it.currency || "RUB");
  const photos = parsePhotos(it.photos).map(toPublicUploadsUrl).filter(Boolean);

  const href =
    it.kind === "product" && asStr(it.product_slug)
      ? `/${regionSlug}/products/${asStr(it.product_slug)}`
      : it.kind === "service" && asStr(it.service_slug)
        ? `/${regionSlug}/services/${asStr(it.service_slug)}`
        : `/${regionSlug}/c/${companyId}#customs`;

  return (
    <div className={styles.ProfileServiceCard}>
      <div className={styles.ProfileServiceMain}>
        <div className={styles.ProfileServiceLeft}>
          <div className={styles.ProfileServiceTitleRow}>
            <Link className={styles.ProfileServiceTitleLink} href={href}>
              {name || "Без названия"}
            </Link>
          </div>

          {it.description ? (
            <div className={styles.ProfileServiceDescr}>
              {asStr(it.description).slice(0, 160)}
              {asStr(it.description).length > 160 ? "…" : ""}
            </div>
          ) : null}
        </div>

        <div className={styles.ProfileServiceRight}>
          <div className={styles.ProfileServicePrice}>
            {price ? `от ${price}` : "по договорённости"}
          </div>
        </div>
      </div>

      {photos.length ? (
        <div className={styles.ProfileServiceGallery}>
          <Scroller itemWidth={64} itemGap={12} height={64}>
            {photos.slice(0, 30).map((src, idx) => (
              <div key={src + idx} className={styles.PhotoNoClick} aria-hidden="true">
                <img
                  className={styles.PhotoThumb}
                  src={src}
                  width={64}
                  height={64}
                  alt={`${name || "Фото услуги"} — фото ${idx + 1}`}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
              </div>
            ))}
          </Scroller>
        </div>
      ) : null}
    </div>
  );
}
