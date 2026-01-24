// apps/web/app/sitemap.ts
import type { MetadataRoute } from "next";

// 86400 секунд = 24 часа. Next.js будет кешировать результат на сутки.
export const revalidate = 86400;

const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "").replace(/\/+$/, "") ||
  "https://moydompro.ru";

const API =
  (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

// Типизация для данных из API
type SlugItem = { slug: string };
type CompanyItem = { id: number | string; region_slug: string };
type BlogPost = { slug: string; published_at?: string };

async function safeJson<T>(url: string): Promise<T | null> {
  try {
    // Замените на:
const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // 1. Загружаем все необходимые данные параллельно
  const [
    regionsRes,
    servicesRes,
    productsRes,
    serviceCatsRes,
    productCatsRes,
    companiesRes,
    blogRes
  ] = await Promise.all([
    safeJson<{ items: SlugItem[] }>(`${API}/public/regions`),
    safeJson<{ items: SlugItem[] }>(`${API}/services`), // API уже фильтрует show_on_site: true
    safeJson<{ items: SlugItem[] }>(`${API}/products`), // API уже фильтрует show_on_site: true
    safeJson<{ categories: SlugItem[] }>(`${API}/public/services/categories`),
    safeJson<{ result: SlugItem[] }>(`${API}/product-categories?flat=1`),
    safeJson<{ items: CompanyItem[] }>(`${API}/companies`),
    safeJson<{ items: BlogPost[] }>(`${API}/public/blog?limit=1000`), // Загружаем статьи
  ]);

  const regions = regionsRes?.items ?? [];
  if (!regions.length) return [{ url: `${SITE_URL}/`, lastModified: now }];

  const services = servicesRes?.items ?? [];
  const products = productsRes?.items ?? [];
  const serviceCats = serviceCatsRes?.categories ?? [];
  const productCats = productCatsRes?.result ?? [];
  const companies = companiesRes?.items ?? [];
  const blogPosts = blogRes?.items ?? []; //

  // Базовые статические страницы
  const out: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/sitemap`, lastModified: now, changeFrequency: "weekly", priority: 0.3 },
    { url: `${SITE_URL}/journal`, lastModified: now, changeFrequency: "daily", priority: 0.8 }, // Главная блога
  ];

  // 2. Добавление статей блога (общие для всех регионов)
  for (const post of blogPosts) {
    if (!post?.slug) continue;
    out.push({
      url: `${SITE_URL}/journal/${post.slug}`,
      lastModified: post.published_at ? new Date(post.published_at) : now,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  // 3. Генерация ссылок для каждого региона
  for (const rg of regions) {
    if (!rg?.slug) continue;
    const regBase = `${SITE_URL}/${rg.slug}`;

    // Главные страницы региона
    out.push(
      { url: regBase, lastModified: now, changeFrequency: "daily", priority: 0.9 },
      { url: `${regBase}/services`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
      { url: `${regBase}/products`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
      { url: `${regBase}/companies`, lastModified: now, changeFrequency: "daily", priority: 0.7 }
    );

    // Категории УСЛУГ в регионе
    for (const sc of serviceCats) {
      if (!sc?.slug) continue;
      out.push({
        url: `${regBase}/services/c/${sc.slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    // Категории ТОВАРОВ в регионе
    for (const pc of productCats) {
      if (!pc?.slug) continue;
      out.push({
        url: `${regBase}/products/c/${pc.slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    // Конкретные УСЛУГИ
    for (const s of services) {
      if (!s?.slug) continue;
      out.push({
        url: `${regBase}/services/${s.slug}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }

    // Конкретные ТОВАРЫ
    for (const p of products) {
      if (!p?.slug) continue;
      out.push({
        url: `${regBase}/products/${p.slug}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }

    // Страницы КОМПАНИЙ: привязываем только к родному региону
    const regionCompanies = companies.filter(c => c.region_slug === rg.slug);
    for (const c of regionCompanies) {
      if (!c?.id) continue;
      out.push({
        url: `${regBase}/c/${c.id}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  }

  return out;
}