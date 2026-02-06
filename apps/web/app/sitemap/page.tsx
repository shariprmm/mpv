// apps/web/app/sitemap/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import styles from "./sitemap.module.css";

export const metadata: Metadata = {
  title: "Карта сайта | МойДомПро",
  description: "Полная структура сайта: регионы, услуги, товары и компании.",
  robots: { index: true, follow: true },
};

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://moydompro.ru").replace(/\/+$/, "");
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.moydompro.ru").replace(/\/+$/, "");

/**
 * Загружает все соответствия slug -> name для корректных анкоров
 */
async function fetchFullDictionary() {
  const dict = new Map<string, string>();

  try {
    const [regions, svcCats, prodCats, services, products] = await Promise.all([
      fetch(`${API_BASE}/public/regions`, { next: { revalidate: 3600 } }).then(r => r.json()),
      fetch(`${API_BASE}/public/services/categories`, { next: { revalidate: 3600 } }).then(r => r.json()),
      fetch(`${API_BASE}/product-categories?flat=1`, { next: { revalidate: 3600 } }).then(r => r.json()),
      fetch(`${API_BASE}/services`, { next: { revalidate: 3600 } }).then(r => r.json()),
      fetch(`${API_BASE}/products`, { next: { revalidate: 3600 } }).then(r => r.json()),
    ]);

    // Наполняем словарь
    regions.items?.forEach((x: any) => dict.set(x.slug, x.name));
    svcCats.categories?.forEach((x: any) => dict.set(x.slug, x.name));
    prodCats.result?.forEach((x: any) => dict.set(x.slug, x.name));
    services.items?.forEach((x: any) => dict.set(x.slug, x.name));
    products.items?.forEach((x: any) => dict.set(x.slug, x.name));
  } catch (e) {
    console.error("Failed to build sitemap dictionary", e);
  }

  return dict;
}

async function fetchSitemapXml(): Promise<string> {
  const url = `${SITE_URL}/sitemap.xml`;
  const r = await fetch(url, { next: { revalidate: 3600 } });
  if (!r.ok) throw new Error(`Failed to fetch sitemap.xml: ${r.status}`);
  return await r.text();
}

function extractLocs(xml: string): string[] {
  const re = /<loc>(.*?)<\/loc>/gim;
  return Array.from(xml.matchAll(re)).map(m => (m[1] || "").trim());
}

function toPath(loc: string): string {
  try { return new URL(loc).pathname; } catch { return loc; }
}

function formatLinkText(path: string, regionSlug: string, dict: Map<string, string>): string {
  if (path === "/" || path === `/${regionSlug}`) return "Главная";
  
  // Определяем тип страницы для префикса
  const isCategory = path.includes('/c/');
  const isService = path.includes('/services');
  const isProduct = path.includes('/products');

  // Извлекаем последний сегмент (slug)
  const segments = path.split('/').filter(Boolean);
  const lastSlug = segments[segments.length - 1];

  if (dict.has(lastSlug)) {
    const name = dict.get(lastSlug)!;
    if (isCategory) return `Категория: ${name}`;
    return name;
  }

  // Fallbacks для системных страниц
  if (path.endsWith("/services")) return "Все услуги";
  if (path.endsWith("/products")) return "Все товары";
  if (path.endsWith("/companies")) return "Все компании";
  if (segments[segments.length - 2] === 'c') return `Компания #${lastSlug}`;

  return lastSlug;
}

type Item = { loc: string; path: string };

export default async function SitemapHtmlPage() {
  const [xmlText, dict] = await Promise.all([
    fetchSitemapXml().catch(() => ""),
    fetchFullDictionary()
  ]);

  const locs = extractLocs(xmlText);
  const items: Item[] = locs.map(loc => ({ loc, path: toPath(loc) }));

  // Группировка по регионам (первый сегмент пути)
  const groups = new Map<string, Item[]>();
  items.forEach(it => {
    const segments = it.path.split('/').filter(Boolean);
    const key = segments[0] || "main";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  });

  const orderedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === "main") return -1;
    const nameA = dict.get(a) || a;
    const nameB = dict.get(b) || b;
    return nameA.localeCompare(nameB, "ru");
  });

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.h1}>Карта сайта</h1>
        <p className={styles.subtitle}>
          Удобная навигация по всем регионам, услугам и товарам проекта.
        </p>
        <div className={styles.anchors}>
          {orderedKeys.map(key => (
            <a key={key} href={`#${key}`} className={styles.anchorPill}>
              {dict.get(key) || (key === "main" ? "Общее" : key)}
            </a>
          ))}
        </div>
      </header>

      <div className={styles.grid}>
        {orderedKeys.map(key => {
          const regionName = dict.get(key) || (key === "main" ? "Общие разделы" : key);
          const list = groups.get(key)!;

          return (
            <section key={key} id={key} className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>{regionName}</h2>
                <span className={styles.count}>{list.length} стр.</span>
              </div>
              <ul className={styles.linkList}>
                {list.map(it => (
                  <li key={it.loc}>
                    <Link href={it.path} className={it.path.split('/').length < 3 ? styles.mainLink : ""}>
                      {formatLinkText(it.path, key, dict)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
