// apps/web/app/journal/category/[slug]/page.tsx
import Link from "next/link";
import styles from "./page.module.css";

export const revalidate = 120;

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

type BlogItem = {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image: string | null;
  published_at: string | null;
  category_slug: string | null;
  category_name: string | null;
};

type CategoryItem = { slug: string; name: string };

function absImg(u: string | null | undefined) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return API + (s.startsWith("/") ? s : `/${s}`);
}

function fmtDate(d: string | null | undefined) {
  const s = String(d || "").trim();
  if (!s) return "";
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("ru-RU");
}

async function getCategoryPage(slug: string) {
  const [catsRes, listRes] = await Promise.all([
    fetch(`${API}/public/blog/categories`, { next: { revalidate: 300 } }),
    fetch(
      `${API}/public/blog?limit=24&page=1&category=${encodeURIComponent(slug)}`,
      { next: { revalidate } }
    ),
  ]);

  const cats = await catsRes.json().catch(() => null);
  const list = await listRes.json().catch(() => null);

  const categories = (cats?.categories || []) as CategoryItem[];
  const items = (list?.items || []) as BlogItem[];
  const current = categories.find((c) => c.slug === slug) || null;

  return { categories, items, current };
}

export default async function JournalCategoryPage({
  params,
}: {
  params: { slug: string };
}) {
  const { categories, items, current } = await getCategoryPage(params.slug);

  const featured = items.length ? items[0] : null;
  const rest = items.length > 1 ? items.slice(1) : [];

  return (
    <main className={styles.wrap}>
      <div className={styles.shell}>
        <div className={styles.backRow}>
          <Link href="/journal" className={styles.backLink}>
            ← Журнал
          </Link>
        </div>

        <h1 className={styles.h1}>{current?.name || "Рубрика"}</h1>

        {categories.length > 0 && (
          <div className={styles.pills}>
            {categories.slice(0, 12).map((c) => {
              const active = c.slug === params.slug;
              return (
                <Link
                  key={c.slug}
                  href={`/journal/category/${c.slug}`}
                  className={`${styles.pill} ${active ? styles.pillActive : ""}`}
                >
                  {c.name}
                </Link>
              );
            })}
          </div>
        )}

        {/* Featured */}
        {featured ? (
          <Link href={`/journal/${featured.slug}`} className={styles.featured}>
            <div
              className={styles.featuredImg}
              style={{
                backgroundImage: featured.cover_image
                  ? `url(${absImg(featured.cover_image)})`
                  : "none",
              }}
              aria-label={featured.title}
            >
              <div className={styles.featuredOverlay} />
            </div>

            <div className={styles.featuredBody}>
              <div className={styles.featuredTop}>
                {featured.category_name ? (
                  <span className={styles.badge}>{featured.category_name}</span>
                ) : null}
              </div>

              <div className={styles.featuredTitle}>{featured.title}</div>

              {featured.excerpt ? (
                <div className={styles.featuredExcerpt}>{featured.excerpt}</div>
              ) : null}

              <div className={styles.featuredMeta}>
                <span className={styles.date}>{fmtDate(featured.published_at)}</span>
                <span className={styles.more}>Подробнее →</span>
              </div>
            </div>
          </Link>
        ) : (
          <div className={styles.empty}>В этой рубрике пока нет статей.</div>
        )}

        {/* Rest grid */}
        {rest.length ? (
          <div className={styles.grid}>
            {rest.map((p) => (
              <Link key={p.id} href={`/journal/${p.slug}`} className={styles.card}>
                <div
                  className={styles.cardImg}
                  style={{
                    backgroundImage: p.cover_image ? `url(${absImg(p.cover_image)})` : "none",
                  }}
                  aria-label={p.title}
                >
                  {!p.cover_image ? <div className={styles.cardImgStub} /> : null}
                  {p.category_name ? (
                    <div className={styles.cardBadge}>{p.category_name}</div>
                  ) : null}
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>{p.title}</div>
                  {p.excerpt ? <div className={styles.cardExcerpt}>{p.excerpt}</div> : null}

                  <div className={styles.cardMeta}>
                    <span className={styles.date}>{fmtDate(p.published_at)}</span>
                    <span className={styles.more}>Подробнее →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}
