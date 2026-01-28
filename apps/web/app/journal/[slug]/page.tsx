// apps/web/app/journal/[slug]/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import { ArticleViewer } from "./ArticleViewer"; // ✅ Клиентский компонент для Лайтбокса

// Конфиг
const API = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "https://api.moydompro.ru";
const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://moydompro.ru").replace(/\/+$/, "");
const CONTENT_ORIGIN =
  (
    process.env.NEXT_PUBLIC_CONTENT_ORIGIN ||
    process.env.NEXT_PUBLIC_BLOG_CONTENT_ORIGIN ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "https://moydompro.ru"
  ).replace(/\/+$/, "");

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
  images?: PostImage[];
};

type CategoryItem = {
  slug: string;
  name: string;
};

type PostImage = {
  id: number;
  image_url: string;
  sort_order: number;
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

function normalizeContentImgSrc(src: string) {
  const s = String(src || "").trim();
  if (!s) return s;
  if (/^https?:\/\//i.test(s)) {
    if (/^https?:\/\/rdm-spb\.ru\//i.test(s) && CONTENT_ORIGIN) {
      return s.replace(/^https?:\/\/rdm-spb\.ru/i, CONTENT_ORIGIN);
    }
    return s;
  }
  if (s.startsWith("//")) return `https:${s}`;
  if (s.startsWith("/")) return `${CONTENT_ORIGIN}${s}`;
  return `${CONTENT_ORIGIN}/${s}`;
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

    const src = pickAttr(out, "src") || pickAttr(out, "data-src") || "";
    const normalizedSrc = normalizeContentImgSrc(src);
    if (normalizedSrc && normalizedSrc !== src) {
      out = setOrReplaceAttr(out, "src", normalizedSrc);
      if (hasAttr(out, "data-src")) {
        out = setOrReplaceAttr(out, "data-src", normalizedSrc);
      }
    }

    const existingAlt = pickAttr(out, "alt");
    if (existingAlt) return out;

    const human = srcToHuman(normalizedSrc || src);
    const generated = (human ? `${articleTitle} — ${human}` : `${articleTitle} — фото ${idx}`)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);

    out = setOrReplaceAttr(out, "alt", generated);
    return out;
  });
}

function buildGalleryHtml(images: PostImage[] | undefined, articleTitle: string) {
  if (!images?.length) return "";
  const title = escapeHtml(articleTitle);
  const items = images
    .map((img, idx) => {
      const src = normalizeContentImgSrc(img.image_url);
      const alt = `${title} — фото ${idx + 1}`;
      // Используем классы из page.module.css для горизонтального скролла
      return `
        <figure class="${styles.galleryItem}">
          <img class="${styles.galleryImg}" src="${escapeHtml(src)}" alt="${alt}" loading="lazy" decoding="async" />
        </figure>
      `;
    })
    .join("");

  return `<div class="${styles.gallery}">${items}</div>`;
}

function injectGalleryAfterParagraphs(
  html: string,
  galleryHtml: string,
  paragraphIndex: number
) {
  if (!galleryHtml) return html;
  const raw = String(html || "");
  if (!raw) return galleryHtml;

  const re = /<\/p\s*>/gi;
  let count = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    count += 1;
    if (count === paragraphIndex) {
      const insertAt = match.index + match[0].length;
      return `${raw.slice(0, insertAt)}${galleryHtml}${raw.slice(insertAt)}`;
    }
  }

  return `${raw}${galleryHtml}`;
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
    notFound(); 
  }

  const cover = toAbsPublicUrl(post.cover_image);
  const url = `${SITE_URL}/journal/${post.slug}`;
  const published = post.published_at ? new Date(post.published_at).toISOString() : null;
  
  // 1. Обработка HTML (alt, loading)
  const contentHtml = ensureImgAlts(post.content_html, post.title);
  
  // 2. Генерация HTML галереи
  const galleryHtml = buildGalleryHtml(post.images, post.title);
  
  // 3. Вставка галереи в текст
  const contentWithGallery = injectGalleryAfterParagraphs(
    contentHtml,
    galleryHtml,
    4
  );

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
    dateModified: published,
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
            {/* Breadcrumbs */}
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
                  loading="eager"
                />
              </figure>
            )}

            {/* ✅ Используем ArticleViewer для рендера HTML и обработки кликов по картинкам */}
            <ArticleViewer htmlContent={contentWithGallery} />

            <div className={styles.cta}>
              <div className={styles.ctaTitle}>Нужна помощь с выбором?</div>
              <p>Оставьте заявку, и проверенные компании свяжутся с вами.</p>
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
