import styles from "./page.module.css";

type Region = { id: number; name: string; slug: string };
type Service = { id: number; name: string; slug: string; category: string };
type Company = {
  id: number;
  name: string;
  rating: string | number;
  reviews_count: number;
  is_verified: boolean;
  region_slug: string;
  price_min: number | null;
  price_max: number | null;
};

async function getJson(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

function asNumber(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { region: string; service: string };
  searchParams?: { sort?: string };
}) {
  const apiBase = process.env.API_BASE_URL || "http://api:8080";

  const regionSlug = params.region;
  const serviceSlug = params.service;
  const sort = searchParams?.sort === "price" ? "price" : "rating";

  const regionsRes = await getJson(`${apiBase}/regions`);
  const servicesRes = await getJson(`${apiBase}/services`);
  const companiesRes = await getJson(
    `${apiBase}/companies?region_slug=${encodeURIComponent(regionSlug)}&service_slug=${encodeURIComponent(
      serviceSlug
    )}&sort=${encodeURIComponent(sort)}`
  );

  const regions: Region[] = regionsRes.items || [];
  const services: Service[] = servicesRes.items || [];
  const companies: Company[] = companiesRes.items || [];

  const regionObj = regions.find((r) => r.slug === regionSlug);
  const serviceObj = services.find((s) => s.slug === serviceSlug);

  const lowPrice =
    companies.length > 0
      ? Math.min(...companies.map((c) => c.price_min ?? Number.POSITIVE_INFINITY))
      : null;
  const highPrice =
    companies.length > 0 ? Math.max(...companies.map((c) => c.price_max ?? 0)) : null;

  const low = lowPrice !== null && lowPrice !== Number.POSITIVE_INFINITY ? asNumber(lowPrice) : null;
  const high = highPrice !== null ? asNumber(highPrice) : null;

  // JSON-LD: Service + Offer + AggregateOffer + ServiceChannel + ItemList (компании)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: serviceObj?.name || serviceSlug,
    areaServed: {
      "@type": "AdministrativeArea",
      name: regionObj?.name || regionSlug,
    },
    availableChannel: {
      "@type": "ServiceChannel",
      serviceUrl: `https://moydompro.ru/r/${regionSlug}/services/${serviceSlug}`,
      availableLanguage: "ru-RU",
      serviceLocation: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: regionObj?.name || regionSlug,
        },
      },
    },
    offers:
      companies.length && (low != null || high != null)
        ? [
            {
              "@type": "AggregateOffer",
              priceCurrency: "RUB",
              lowPrice: low ?? undefined,
              highPrice: high ?? undefined,
              offerCount: companies.length,
              url: `https://moydompro.ru/r/${regionSlug}/services/${serviceSlug}`,
            },
            {
              "@type": "Offer",
              priceCurrency: "RUB",
              price: low ?? high ?? undefined,
              url: `https://moydompro.ru/r/${regionSlug}/services/${serviceSlug}`,
            },
          ]
        : undefined,
    provider: {
      "@type": "Organization",
      name: "МойДомPRO",
    },
  };

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: companies.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      url: `https://moydompro.ru/c/${c.id}`,
    })),
  };

  return (
    <main className={styles.main}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />

      <h1 className={styles.title}>
        {serviceObj?.name || serviceSlug} — {regionObj?.name || regionSlug}
      </h1>

      <div className={styles.meta}>
        Сортировка: <b>{sort === "price" ? "по цене" : "по рейтингу"}</b>
        {companies.length && low != null && high != null ? (
          <>
            {" "}· Диапазон цен: <b>{low}</b>–<b>{high}</b> RUB · Компаний: <b>{companies.length}</b>
          </>
        ) : null}
      </div>

      <div className={styles.tabs}>
        <a
          href={`/r/${regionSlug}/services/${serviceSlug}?sort=rating`}
          className={styles.tabLink}
        >
          <span className={styles.tabPill}>По рейтингу</span>
        </a>
        <a
          href={`/r/${regionSlug}/services/${serviceSlug}?sort=price`}
          className={styles.tabLink}
        >
          <span className={styles.tabPill}>По цене</span>
        </a>
      </div>

      {companies.length ? (
        <div className={styles.list}>
          {companies.map((c) => (
            <a key={c.id} href={`/c/${c.id}`} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitle}>{c.name}</div>
                {c.is_verified ? <span className={styles.cardBadge}>✅ Проверенная</span> : null}
                <span className={styles.cardRating}>
                  ⭐ {Number(c.rating).toFixed(2)} ({c.reviews_count})
                </span>
              </div>

              <div className={styles.cardMeta}>
                Цена: <b>{c.price_min ?? "—"}</b> – <b>{c.price_max ?? "—"}</b> RUB
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>Пока нет данных по этому региону и услуге.</div>
      )}
    </main>
  );
}
