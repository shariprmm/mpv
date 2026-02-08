import type { Metadata } from "next";
import SeoJsonLd from "@/components/SeoJsonLd";
import { SITE_NAME, absUrl, jsonLdBreadcrumb, jsonLdWebPage } from "@/lib/seo";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${SITE_NAME} — услуги и товары для дома`,
  description: "Каталог услуг, товаров и компаний для загородного дома по регионам.",
  alternates: { canonical: absUrl("/") },
  openGraph: {
    title: `${SITE_NAME} — услуги и товары для дома`,
    description: "Каталог услуг, товаров и компаний для загородного дома по регионам.",
    url: absUrl("/"),
    siteName: SITE_NAME,
    type: "website",
    locale: "ru_RU",
    images: [absUrl("/images/og-default.webp")],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — услуги и товары для дома`,
    description: "Каталог услуг, товаров и компаний для загородного дома по регионам.",
    images: [absUrl("/images/og-default.webp")],
  },
};

async function getHome(region_slug: string) {
  // ВАЖНО:
  // - API_BASE_URL: для server-side внутри docker (http://api:8080)
  // - NEXT_PUBLIC_API_BASE_URL: для клиента/браузера (https://api.moydompro.ru)
  const API =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://api:8080";

  const url = `${API}/home?region_slug=${encodeURIComponent(region_slug)}`;

  const r = await fetch(url, { cache: "no-store" });
  const text = await r.text();

  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!r.ok) {
    const msg = data?.error || data?.message || `HTTP ${r.status}`;
    throw new Error(`${msg} @ ${url}`);
  }

  return data;
}

function money(v: any) {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("ru-RU").format(Number(v)) + " ₽";
}

export default async function Page({ searchParams }: { searchParams?: { region?: string } }) {
  const region_slug = searchParams?.region || "sankt-peterburg";

  let data: any = null;
  let err: string | null = null;

  try {
    data = await getHome(region_slug);
  } catch (e: any) {
    err = e?.message || String(e);
  }

  if (err) {
    return (
      <main className={styles.main}>
        <h1 className={styles.errorTitle}>MoyDomPro</h1>
        <p className={styles.muted}>Главная временно не загрузилась.</p>
        <pre className={styles.errorDetails}>{err}</pre>
        <div className={styles.actions}>
          <a href="/" className={styles.link}>
            <button>Обновить</button>
          </a>
          <a href="https://admin.moydompro.ru/login" className={styles.link}>
            <button>Вход для компаний</button>
          </a>
        </div>
      </main>
    );
  }

  const canonical = absUrl("/");
  const pageName = `${SITE_NAME} — услуги и товары для дома`;
  const pageDesc = "Каталог услуг, товаров и компаний для загородного дома по регионам.";

  const ldBreadcrumbs = jsonLdBreadcrumb([{ name: "Главная", item: canonical }]);
  const ldPage = jsonLdWebPage({
    url: canonical,
    name: pageName,
    description: pageDesc,
    imageUrl: absUrl("/images/og-default.webp"),
  });

  const itemList = (id: string, name: string, items: Array<{ name: string; url: string }>) => ({
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${canonical}#${id}`,
    name,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: items.length,
    itemListElement: items.map((it, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: it.name,
      url: it.url,
    })),
  });

  const serviceItems = (data.top_services || []).map((s: any) => ({
    name: String(s?.name || s?.title || s?.slug || "Услуга"),
    url: absUrl(`/${encodeURIComponent(region_slug)}/services/${encodeURIComponent(String(s?.slug || s?.id || ""))}`),
  }));

  const companyItems = (data.featured_companies || []).map((c: any) => ({
    name: String(c?.name || `Компания #${c?.id || ""}`),
    url: absUrl(`/${encodeURIComponent(region_slug)}/c/${encodeURIComponent(String(c?.id || ""))}`),
  }));

  const dealItems = (data.best_deals || []).map((d: any) => ({
    name: String(d?.name || d?.title || d?.slug || "Предложение"),
    url: absUrl(`/${encodeURIComponent(region_slug)}/products/${encodeURIComponent(String(d?.slug || d?.id || ""))}`),
  }));

  return (
    <main className={styles.main}>
      <SeoJsonLd
        data={[
          ldBreadcrumbs,
          ldPage,
          ...(serviceItems.length ? [itemList("topServices", "Популярные услуги", serviceItems)] : []),
          ...(companyItems.length ? [itemList("featuredCompanies", "Рекомендуемые компании", companyItems)] : []),
          ...(dealItems.length ? [itemList("bestDeals", "Лучшие предложения", dealItems)] : []),
        ]}
      />
      <h1 className={styles.title}>{data?.seo?.h1 || "MoyDomPro"}</h1>
      <p className={`${styles.muted} ${styles.marginTopZero}`}>
        Регион: <b>{data.region?.name}</b>
      </p>

      <section className={styles.section}>
        <a
          href={`/?region=${encodeURIComponent(data.region?.slug || region_slug)}`}
          className={styles.link}
        >
          <button>Обновить</button>
        </a>
        <a href="https://admin.moydompro.ru/login" className={styles.link}>
          <button>Вход для компаний</button>
        </a>
      </section>

      <h2 className={styles.sectionTitle}>Популярные услуги</h2>
      <div className={styles.grid}>
        {(data.top_services || []).map((s: any) => (
          <div key={s.slug} className={styles.card}>
            <div className={styles.cardTitle}>{s.name}</div>
            <div className={`${styles.opacity85} ${styles.marginTopSmall}`}>
              от <b>{money(s.price_min)}</b> до <b>{money(s.price_max)}</b>
            </div>
            <div className={`${styles.opacity7} ${styles.marginTopSmall}`}>
              {s.companies_count} компаний
            </div>
          </div>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>Рекомендуемые компании</h2>
      <div className={styles.grid}>
        {(data.featured_companies || []).map((c: any) => (
          <div key={c.id} className={styles.card}>
            <div className={styles.cardRow}>
              <div className={styles.cardTitle}>{c.name}</div>
              {c.is_verified ? <span className={styles.badge}>Проверенная</span> : null}
            </div>
            <div className={`${styles.muted} ${styles.marginTopSmall}`}>
              ⭐ {c.rating ?? "—"} ({c.reviews_count ?? 0})
            </div>
            <div className={`${styles.opacity85} ${styles.marginTopSmall}`}>
              Цены: от <b>{money(c.price_min)}</b> до <b>{money(c.price_max)}</b>
            </div>
            <div className={styles.tagRow}>
              {(c.service_tags || []).slice(0, 5).map((t: any) => (
                <span key={t.slug} className={styles.tag}>
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>Лучшие предложения</h2>
      <div className={styles.grid}>
        {(data.best_deals || []).map((d: any) => (
          <div key={d.slug} className={styles.card}>
            <div className={styles.cardTitle}>{d.name}</div>
            <div className={`${styles.opacity85} ${styles.marginTopSmall}`}>
              от <b>{money(d.price_from)}</b>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
