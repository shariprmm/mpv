// apps/web/app/[region]/search/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { absUrl } from "@/lib/seo";
import styles from "../page.module.css";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

/** Вспомогательная функция для падежа города */
function toPrepositional(city: string) {
  const s = String(city || "").trim();
  if (!s) return s;
  const lower = s.toLowerCase();

  // Исключения
  const exceptions: Record<string, string> = {
    москва: "Москве",
    "санкт-петербург": "Санкт-Петербурге",
    петербург: "Петербурге",
    "нижний новгород": "Нижнем Новгороде",
    казань: "Казани",
    пермь: "Перми",
    тюмень: "Тюмени",
    тверь: "Твери",
  };
  if (exceptions[lower]) return exceptions[lower];

  // Базовая логика склонения
  if (/[ая]$/i.test(s)) return s.slice(0, -1) + "е";
  if (/й$/i.test(s)) return s.slice(0, -1) + "е";
  if (/ь$/i.test(s)) return s.slice(0, -1) + "и";

  // Если название на английском (slug), возвращаем как есть, чтобы не было "abakane"
  if (/[a-zA-Z]/.test(s)) return s;

  return s + "е";
}

// Отдельная функция для получения имени региона (для метаданных)
async function fetchRegionName(slug: string): Promise<string> {
  try {
    // Используем эндпоинт home, он легкий и возвращает инфо о регионе
    const res = await fetch(`${API}/home?region_slug=${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return slug;
    const data = await res.json();
    return data?.region?.name || slug;
  } catch {
    return slug;
  }
}

async function getSearch(region: string, q: string) {
  const url = `${API}/public/region/${encodeURIComponent(region)}/search?q=${encodeURIComponent(
    q
  )}&limit=20`;
  const r = await fetch(url, { next: { revalidate: 60 } });

  if (!r.ok) {
    return { ok: false, error: `status_${r.status}`, services: [], products: [], companies: [] };
  }

  try {
    return await r.json();
  } catch {
    return { ok: false, error: "parse_error", services: [], products: [], companies: [] };
  }
}

/** 1) SEO Метаданные для страницы поиска */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { region: string };
  searchParams: { q?: string };
}): Promise<Metadata> {
  const query = searchParams.q || "";

  // Получаем русское название региона
  const regionName = await fetchRegionName(params.region);
  const regionIn = toPrepositional(regionName);

  const title = query
    ? `Поиск «${query}» в ${regionIn} | МойДомПро`
    : `Поиск услуг и товаров в ${regionIn}`;

  return {
    title,
    description: `Результаты поиска по запросу ${query} в регионе ${regionName}.`,
    alternates: { canonical: absUrl(`/${params.region}/search?q=${query}`) },
  };
}

/** 2) Компонент карточки (как на главной региона) */
function MediaCard({ title, href, meta, imgSrc }: any) {
  return (
    <Link href={href} className={styles.simpleCard}>
      <div className={styles.mediaRow}>
        <div className={styles.cardThumb}>
          {imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt={title}
              className={`${styles.thumbImage} ${styles.thumbImageCover}`}
            />
          ) : (
            <div className={styles.thumbFallback} />
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

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: { region: string };
  searchParams: { q?: string };
}) {
  const regionSlug = params.region;
  const q = (searchParams?.q || "").trim();

  // Загружаем данные поиска
  const data = q.length >= 2 ? await getSearch(regionSlug, q) : null;

  // Берем русское название из ответа API (data.region.name) или фоллбэк на slug
  const regionName = data?.region?.name || regionSlug;
  const regionIn = toPrepositional(regionName);

  const services = data?.services || [];
  const products = data?.products || [];
  const companies = data?.companies || [];

  return (
    <div className={styles.searchWrap}>
      <h1 className={styles.h1}>Поиск в {regionIn}</h1>

      <form action={`/${regionSlug}/search`} method="GET" className={styles.searchForm}>
        <input
          name="q"
          defaultValue={q}
          placeholder="Найти мастера или товар..."
          className={styles.searchInput}
        />
        <button className={`${styles.btnAction} ${styles.searchButton}`}>Найти</button>
      </form>

      {q.length < 2 ? (
        <div className={styles.searchNotice}>Введите минимум 2 символа для начала поиска.</div>
      ) : !data?.ok && q.length >= 2 ? (
        <div className={styles.searchError}>Ошибка загрузки результатов (Код: {data?.error}).</div>
      ) : (
        <div className={styles.searchGrid}>
          {/* Услуги */}
          <section>
            <h2 className={`${styles.h2} ${styles.sectionTitleSpaced}`}>
              Услуги ({services.length})
            </h2>
            <div className={styles.grid}>
              {services.length ? (
                services.map((s: any) => (
                  <MediaCard
                    key={s.slug}
                    title={s.name}
                    href={`/${regionSlug}/services/${s.slug}`}
                    imgSrc={s.image_url}
                    meta={
                      [
                        s.category_name,
                        s.price_min ? `от ${s.price_min} ₽` : null,
                        s.companies_count ? `компаний: ${s.companies_count}` : null,
                      ]
                        .filter(Boolean)
                        .join(" • ")
                    }
                  />
                ))
              ) : (
                <div className={styles.emptyState}>Ничего не найдено.</div>
              )}
            </div>
          </section>

          {/* Товары */}
          <section>
            <h2 className={`${styles.h2} ${styles.sectionTitleSpaced}`}>
              Товары ({products.length})
            </h2>
            <div className={styles.grid}>
              {products.length ? (
                products.map((p: any) => (
                  <MediaCard
                    key={p.slug}
                    title={p.name}
                    href={`/${regionSlug}/products/${p.slug}`}
                    imgSrc={p.image_url}
                    meta={
                      [
                        p.category_name,
                        p.price_min ? `от ${p.price_min} ₽` : null,
                        p.companies_count ? `компаний: ${p.companies_count}` : null,
                      ]
                        .filter(Boolean)
                        .join(" • ")
                    }
                  />
                ))
              ) : (
                <div className={styles.emptyState}>Ничего не найдено.</div>
              )}
            </div>
          </section>

          {/* Компании */}
          <section>
            <h2 className={`${styles.h2} ${styles.sectionTitleSpaced}`}>
              Компании ({companies.length})
            </h2>
            <div className={styles.grid}>
              {companies.length ? (
                companies.map((c: any) => (
                  <MediaCard
                    key={c.id}
                    title={c.name}
                    href={`/${regionSlug}/c/${c.id}`}
                    imgSrc={c.logo_url}
                    meta={
                      [
                        c.is_verified ? "✅ проверена" : null,
                        c.rating ? `рейтинг ${c.rating}` : null,
                        c.reviews_count ? `${c.reviews_count} отзывов` : null,
                      ]
                        .filter(Boolean)
                        .join(" • ")
                    }
                  />
                ))
              ) : (
                <div className={styles.emptyState}>Ничего не найдено.</div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
