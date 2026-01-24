// /web/app/journal/[slug]/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import styles from "./page.module.css";

// Конфиг
const API = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "https://api.moydompro.ru";
const SITE_URL = "https://moydompro.ru";

// Типы
type Post = {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  content_html: string;
  cover_image: string | null;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  category_slug: string | null;
  category_name: string | null;
};

type CategoryItem = {
  slug: string;
  name: string;
};

// --- Helpers ---

function toAbsPublicUrl(u: string | null) {
  const s = String(u || "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) return "https:" + s;
  if (s.startsWith("/")) return `${SITE_URL}${s}`;
  return `${SITE_URL}/${s}`;
}

function srcToHuman(src: string) {
  try {
    const clean = String(src || "").split("?")[0];
    const file = decodeURIComponent(clean.split("/").pop() || "").trim();
    const base = file
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return base || "";
  } catch {
    return "";
  }
}

// Проставляет alt, loading="lazy" и decoding="async" для картинок в контенте
function ensureImgAlts(html: string, articleTitle: string) {
  const raw = String(html || "");
  if (!raw) return raw;

  let idx = 0;

  const pickAttr = (tag: string, name: string) => {
    const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
    return (m?.[2] || m?.[3] || m?.[4] || "").trim();
  };

  const hasAttr = (tag: string, name: string) => new RegExp(`\\b${name}\\s*=`, "i").test(tag);

  const setOrReplaceAttr = (tag: string, name: string, value: string) => {
    const safe = String(value || "").replace(/"/g, "&quot;");
    if (hasAttr(tag, name)) {
      return tag.replace(
        new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
        `${name}="${safe}"`
      );
    }
    if (/\/>\s*$/i.test(tag)) return tag.replace(/\/>\s*$/i, ` ${name}="${safe}" />`);
    return tag.replace(/>\s*$/i, ` ${name}="${safe}">`);
  };

  const ensureAttr = (tag: string, name: string, value: string) => {
    if (hasAttr(tag, name)) return tag;
    return setOrReplaceAttr(tag, name, value);
  };

  return raw.replace(/<img\b[^>]*\/?>/gi, (tag) => {
    idx++;
    // Игнорируем декоративные
    if (/\brole\s*=\s*("presentation"|'presentation'|presentation)\b/i.test(tag)) return tag;
    if (/\baria-hidden\s*=\s*("true"|'true'|true)\b/i.test(tag)) return tag;

    let out = tag;
    out = ensureAttr(out, "loading", "lazy");
    out = ensureAttr(out, "decoding", "async");

    const existingAlt = pickAttr(out, "alt");
    if (existingAlt) return out;

    const src = pickAttr(out, "src") || pickAttr(out, "data-src") || "";
    const human = srcToHuman(src);
    const generated = (human ? `${articleTitle} — ${human}` : `${articleTitle} — фото ${idx}`)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);

    out = setOrReplaceAttr(out, "alt", generated);
    return out;
  });
}

// --- Data Fetching ---

async function getPost(slug: string): Promise<Post | null> {
  try {
    const r = await fetch(`${API}/public/blog/${encodeURIComponent(slug)}`, {
      next: { revalidate: 120 },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return (j?.post || null) as Post | null;
  } catch {
    return null;
  }
}

async function getCategories(): Promise<CategoryItem[]> {
  try {
    const r = await fetch(`${API}/public/blog/categories`, { next: { revalidate: 600 } });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j?.categories) ? j.categories : [];
  } catch {
    return [];
  }
}

// --- Metadata ---

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) return { title: "Статья не найдена" };

  const url = `${SITE_URL}/journal/${post.slug}`;
  const img = toAbsPublicUrl(post.cover_image);

  return {
    title: post.seo_title || post.title,
    description: post.seo_description || post.excerpt || undefined,
    alternates: { canonical: url },
    openGraph: {
      title: post.seo_title || post.title,
      description: post.seo_description || post.excerpt || undefined,
      url,
      type: "article",
      images: img ? [img] : undefined,
    },
  };
}

// --- Page Component ---

export default async function JournalPostPage({ params }: { params: { slug: string } }) {
  const [post, categories] = await Promise.all([getPost(params.slug), getCategories()]);

  if (!post) {
    notFound(); // Используем стандартную 404 Next.js
  }

  const cover = toAbsPublicUrl(post.cover_image);
  const url = `${SITE_URL}/journal/${post.slug}`;
  const published = post.published_at ? new Date(post.published_at).toISOString() : null;
  
  // Обработка HTML контента
  const contentHtml = ensureImgAlts(post.content_html, post.title);

  // JSON-LD
  const ldBreadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Журнал", item: `${SITE_URL}/journal` },
      ...(post.category_slug && post.category_name
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: post.category_name,
              item: `${SITE_URL}/journal/category/${post.category_slug}`,
            },
          ]
        : []),
      { "@type": "ListItem", position: post.category_slug ? 3 : 2, name: post.title, item: url },
    ],
  };

  const ldArticle = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: post.title,
    description: post.seo_description || post.excerpt || undefined,
    image: cover ? [cover] : undefined,
    datePublished: published,
    dateModified: published, // Можно добавить updated_at если есть
    author: { "@type": "Organization", name: "МойДомПро" },
    publisher: {
      "@type": "Organization",
      name: "МойДомПро",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/uploads/logo.png` },
    },
  };

  return (
    <main className={styles.wrap}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldBreadcrumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldArticle) }} />

      <div className={styles.shell}>
        <div className={styles.grid}>
          {/* Main Content */}
          <section className={styles.content}>
            {/* Breadcrumbs link style */}
            <div className={styles.crumbs}>
              <Link href="/journal" className={styles.crumbLink}>Журнал</Link>
              {post.category_slug && post.category_name && (
                <>
                  <span className={styles.crumbSep}>/</span>
                  <Link href={`/journal/category/${post.category_slug}`} className={styles.crumbLink}>
                    {post.category_name}
                  </Link>
                </>
              )}
            </div>

            <h1 className={styles.h1}>{post.title}</h1>

            {post.excerpt && <div className={styles.lead}>{post.excerpt}</div>}

            {cover && (
              <figure className={styles.coverFigure}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={styles.coverImg}
                  src={cover}
                  alt={post.title}
                  loading="eager" // Обложку грузим сразу
                />
              </figure>
            )}

            {/* ✅ Сама статья с настроенными стилями */}
            <div className={styles.articleBody} dangerouslySetInnerHTML={{ __html: contentHtml }} />

            <div className={styles.cta}>
              <div className={styles.ctaTitle}>Нужна помощь с выбором?</div>
              <p>Оставьте заявку, и проверенные компании свяжутся с вами.</p>
              {/* Тут можно кнопку/форму */}
            </div>
          </section>

          {/* Sidebar */}
          <aside className={styles.sidebar}>
            <div className={styles.sideCard}>
              <div className={styles.sideTitle}>Категории</div>
              <nav className={styles.sideNav}>
                {categories.map((c) => (
                  <Link key={c.slug} href={`/journal/category/${c.slug}`} className={styles.sideLink}>
                    {c.name}
                  </Link>
                ))}
                <Link href="/journal" className={`${styles.sideLink} ${styles.sideLinkAll}`}>
                  Все статьи
                </Link>
              </nav>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}