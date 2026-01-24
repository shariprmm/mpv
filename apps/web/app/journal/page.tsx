// /apps/web/app/journal/page.tsx
import Link from "next/link";
import styles from "./journal.module.css";

export const revalidate = 120;

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  process.env.API_BASE_URL?.replace(/\/+$/, "") ||
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

function imgUrl(u: string | null) {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return `${API}${u.startsWith("/") ? "" : "/"}${u}`;
}

function formatDate(d: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("ru-RU", { day: "2-digit", month: "long" });
}

/**
 * ✅ Safe JSON fetch (чтобы build не падал, если API вернул HTML/502)
 */
async function fetchJsonSafe(url: string, revalidateSeconds: number) {
  try {
    const r = await fetch(url, { next: { revalidate: revalidateSeconds } });
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

async function getData() {
  const [cats, list] = await Promise.all([
    fetchJsonSafe(`${API}/public/blog/categories`, 300),
    fetchJsonSafe(`${API}/public/blog?limit=12&page=1`, 120),
  ]);

  // ✅ поддержка разных форматов ответа категорий:
  // {categories:[...]} или {items:[...]} или просто [...]
  const categories =
    (Array.isArray(cats?.categories) && cats.categories) ||
    (Array.isArray(cats?.items) && cats.items) ||
    (Array.isArray(cats) && cats) ||
    [];

  const items = (Array.isArray(list?.items) ? list.items : Array.isArray(list) ? list : []) as BlogItem[];
  const total = Number(list?.total || items.length || 0);

  return {
    categories: categories as { slug: string; name: string }[],
    items,
    total,
  };
}

export default async function JournalPage() {
  const { categories, items } = await getData();
  const [featured, ...rest] = items;

  return (
    <main className={styles.page}>
      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroTop}>
            <h1 className={styles.h1}>Журнал</h1>
            <p className={styles.subtitle}>
              Гайды, сравнения и разборы по инженерным системам и услугам для дома.
            </p>
          </div>

          {categories.length > 0 && (
            <nav className={styles.chips} aria-label="Категории журнала">
              <Link className={`${styles.chip} ${styles.chipActive}`} href="/journal">
                Всё
              </Link>

              {categories.slice(0, 10).map((c) => (
                <Link key={c.slug} className={styles.chip} href={`/journal/category/${c.slug}`}>
                  {c.name}
                </Link>
              ))}

              {categories.length > 10 && (
                <Link className={styles.chipGhost} href="/journal/categories">
                  Все категории →
                </Link>
              )}
            </nav>
          )}
        </div>
      </section>

      {/* CONTENT */}
      <section className={styles.container}>
        <div className={styles.grid}>
          {/* LEFT: featured */}
          <div className={styles.leftCol}>
            {featured ? (
              <Link className={styles.featuredCard} href={`/journal/${featured.slug}`}>
                <div className={styles.featuredMedia}>
                  {imgUrl(featured.cover_image) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className={styles.featuredImg}
                      src={imgUrl(featured.cover_image) as string}
                      alt={featured.title}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className={styles.mediaStub} />
                  )}
                </div>

                <div className={styles.featuredBody}>
                  <div className={styles.metaRow}>
                    {featured.category_name ? (
                      <span className={styles.badge}>{featured.category_name}</span>
                    ) : (
                      <span className={styles.badgeGhost}>Статья</span>
                    )}
                    {featured.published_at ? (
                      <span className={styles.metaText}>{formatDate(featured.published_at)}</span>
                    ) : null}
                  </div>

                  <div className={styles.featuredTitle}>{featured.title}</div>

                  {featured.excerpt ? (
                    <div className={styles.featuredExcerpt}>{featured.excerpt}</div>
                  ) : (
                    <div className={styles.featuredExcerptMuted}>
                      Короткое описание появится здесь, когда вы добавите excerpt в админке.
                    </div>
                  )}
                </div>
              </Link>
            ) : (
              <div className={styles.empty}>
                <div className={styles.emptyTitle}>Пока нет материалов</div>
                <div className={styles.emptyText}>
                  Как только вы опубликуете статьи — они появятся здесь.
                </div>
              </div>
            )}

            {/* “подборка” снизу слева */}
            {rest.length > 0 && (
              <div className={styles.block}>
                <div className={styles.blockHeader}>
                  <div className={styles.blockTitle}>Свежие материалы</div>
                  <Link className={styles.blockLink} href="/journal/all">
                    Смотреть всё →
                  </Link>
                </div>

                <div className={styles.cardsList}>
                  {rest.slice(0, 3).map((p) => (
                    <Link key={p.id} className={styles.rowCard} href={`/journal/${p.slug}`}>
                      <div className={styles.rowMedia}>
                        {imgUrl(p.cover_image) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            className={styles.rowImg}
                            src={imgUrl(p.cover_image) as string}
                            alt={p.title}
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className={styles.rowStub} />
                        )}
                      </div>

                      <div className={styles.rowBody}>
                        <div className={styles.rowMeta}>
                          {p.category_name ? <span className={styles.rowCat}>{p.category_name}</span> : null}
                          {p.published_at ? <span className={styles.rowDate}>{formatDate(p.published_at)}</span> : null}
                        </div>
                        <div className={styles.rowTitle}>{p.title}</div>
                        {p.excerpt ? <div className={styles.rowExcerpt}>{p.excerpt}</div> : null}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: sidebar + grid */}
          <aside className={styles.rightCol}>
            <div className={styles.sidebarCard}>
              <div className={styles.sidebarTitle}>Рубрики</div>
              <div className={styles.sidebarList}>
                {categories.slice(0, 12).map((c) => (
                  <Link key={c.slug} className={styles.sidebarLink} href={`/journal/category/${c.slug}`}>
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className={styles.sidebarCard}>
              <div className={styles.sidebarTitle}>Для чего журнал</div>
              <div className={styles.sidebarText}>
                Публикуем практичные разборы: как выбрать подрядчика, сравнить решения и не переплатить.
              </div>
              <div className={styles.sidebarHint}>
                Совет: для максимального CTR добавляйте cover, excerpt и категорию.
              </div>
            </div>

            <div className={styles.sidebarCardAccent}>
              <div className={styles.sidebarTitle}>Нужно выбрать услугу?</div>
              <div className={styles.sidebarText}>
                Перейдите в каталог — там компании, цены и рейтинги по регионам.
              </div>
              <Link className={styles.sidebarCta} href="/r">
                Открыть каталог →
              </Link>
            </div>
          </aside>
        </div>

        {/* GRID BELOW */}
        {rest.length > 0 && (
          <div className={styles.block}>
            <div className={styles.blockHeader}>
              <div className={styles.blockTitle}>Ещё статьи</div>
            </div>

            <div className={styles.cardsGrid}>
              {rest.slice(3).map((p) => (
                <Link key={p.id} className={styles.card} href={`/journal/${p.slug}`}>
                  <div className={styles.cardMedia}>
                    {imgUrl(p.cover_image) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className={styles.cardImg}
                        src={imgUrl(p.cover_image) as string}
                        alt={p.title}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className={styles.mediaStubSmall} />
                    )}
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.cardMeta}>
                      {p.category_name ? (
                        <span className={styles.cardCat}>{p.category_name}</span>
                      ) : (
                        <span className={styles.cardCatGhost}>Статья</span>
                      )}
                      {p.published_at ? <span className={styles.cardDate}>{formatDate(p.published_at)}</span> : null}
                    </div>
                    <div className={styles.cardTitle}>{p.title}</div>
                    {p.excerpt ? <div className={styles.cardExcerpt}>{p.excerpt}</div> : null}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
