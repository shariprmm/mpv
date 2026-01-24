import Link from "next/link";
import type { Metadata } from "next";

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

async function resolveRegionName(regionSlug: string): Promise<string> {
  try {
    const data = await apiGet(`/home?region_slug=${encodeURIComponent(regionSlug)}`);
    return String(data?.region?.name || data?.region?.title || data?.region_name || regionSlug).trim();
  } catch {
    return regionSlug;
  }
}

function regionIn(name: string) {
  return `в ${name}`;
}

function fmtMoney(n: any) {
  const v = n === null || n === undefined ? null : Number(n);
  if (v === null || !Number.isFinite(v)) return "—";
  return String(v);
}

type CompanyRow = {
  id: number;
  name: string;
  rating?: number | null;
  reviews_count?: number | null;
  is_verified?: boolean | null;
  price_min?: number | null;
  currency?: string | null;
};

async function getCompanies(regionSlug: string): Promise<CompanyRow[]> {
  const data = await apiGet(`/companies?region_slug=${encodeURIComponent(regionSlug)}&sort=rating`);
  return Array.isArray(data?.items) ? data.items : [];
}

export async function generateMetadata({
  params,
}: {
  params: { region: string };
}): Promise<Metadata> {
  const regionSlug = String(params?.region || "").trim() || "moskva";
  const regionName = await resolveRegionName(regionSlug);

  const title = `Компании ${regionIn(regionName)} — MoyDomPro`;
  const description = `Все компании и подрядчики ${regionIn(regionName)}. Сравнивайте рейтинг и цены, выбирайте исполнителя и оставляйте заявку.`;

  return {
    title,
    description,
    alternates: { canonical: `https://moydompro.ru/${regionSlug}/c` },
  };
}

export default async function CompaniesRegionPage({
  params,
}: {
  params: { region: string };
}) {
  const regionSlug = String(params?.region || "").trim() || "moskva";
  const regionName = await resolveRegionName(regionSlug);

  let companies: CompanyRow[] = [];
  try {
    companies = await getCompanies(regionSlug);
  } catch {
    companies = [];
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.breadcrumbs}>
        <Link href={`/${regionSlug}`} className={styles.crumb}>
          Главная
        </Link>
        <span className={styles.sep}>/</span>
        <span className={styles.crumbActive}>Компании</span>
      </div>

      <div className={styles.head}>
        <h1 className={styles.h1}>Компании {regionIn(regionName)}</h1>
        <div className={styles.sub}>
          Всего: <b>{companies.length}</b>
        </div>
      </div>

      {companies.length === 0 ? (
        <div className={styles.empty}>Пока нет компаний {regionIn(regionName)}.</div>
      ) : (
        <div className={styles.grid}>
          {companies.map((c) => (
            <div key={c.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.titleRow}>
                  <Link className={styles.title} href={`/${regionSlug}/c/${c.id}`}>
                    {c.name || `Компания #${c.id}`}
                  </Link>
                  {c.is_verified ? <span className={styles.badge}>✅</span> : null}
                </div>

                <div className={styles.meta}>
                  <span>
                    Рейтинг: <b>{c.rating != null ? Number(c.rating).toFixed(1) : "—"}</b>
                  </span>
                  <span className={styles.dot}>•</span>
                  <span>
                    Отзывов: <b>{c.reviews_count ?? 0}</b>
                  </span>
                </div>
              </div>

              <div className={styles.priceRow}>
                <div className={styles.priceLabel}>Цена от</div>
                <div className={styles.priceVal}>
                  {fmtMoney(c.price_min)} {c.currency || "RUB"}
                </div>
              </div>

              <div className={styles.actions}>
                <Link className={styles.btn} href={`/${regionSlug}/c/${c.id}`}>
                  Открыть компанию
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.back}>
        <Link href={`/${regionSlug}`}>← На главную города</Link>
      </div>
    </div>
  );
}
